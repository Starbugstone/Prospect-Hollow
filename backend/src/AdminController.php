<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\{Request, JsonResponse};
use Symfony\Component\Routing\Attribute\Route;

/** The /admin panel's API. Every data route needs a fully signed-in admin session. */
final class AdminController
{
    private const QUERIES = [
        'GET players' => ['q', 'page', 'sort'],
        'GET towns' => ['q', 'page', 'filter'],
        'GET audit' => ['page'],
    ];
    public function __construct(
        private Auth $auth,
        private AdminAuth $admin,
        private AdminService $service,
    ) {}

    #[Route('/api/admin/{path}', name: 'admin', requirements: ['path' => '.*'])]
    public function __invoke(Request $r, string $path): JsonResponse
    {
        try {
            $this->auth->guardHost($r);
            if (
                (int) $r->headers->get('Content-Length', '0') > 65536 ||
                strlen($r->getContent()) > 65536
            ) {
                throw new ApiError(413, 'Request is too large.');
            }
            $method = $r->getMethod();
            $body = [];
            if (!in_array($method, ['GET', 'POST', 'PATCH', 'DELETE'], true)) {
                throw new ApiError(405, 'Method is not allowed.');
            }
            if ($method !== 'GET') {
                $this->admin->guardOrigin($r);
                if (
                    strtolower(trim(explode(';', $r->headers->get('Content-Type', ''))[0])) !==
                    'application/json'
                ) {
                    throw new ApiError(415, 'Use application/json.');
                }
                try {
                    $object = json_decode($r->getContent(), false, 16, JSON_THROW_ON_ERROR);
                } catch (\JsonException) {
                    throw new ApiError(400, 'Invalid JSON.');
                }
                if (!($object instanceof \stdClass)) {
                    throw new ApiError(422, 'Request must be a JSON object.');
                }
                $body = (array) $object;
            }
            $query = $r->query->all();
            if (
                array_diff(array_keys($query), self::QUERIES[$method . ' ' . $path] ?? []) ||
                array_filter($query, fn($v) => !is_string($v) || mb_strlen($v) > 100)
            ) {
                throw new ApiError(422, 'Unsupported query parameters.');
            }
            $this->auth->limit('admin-http:' . ($r->getClientIp() ?? 'unknown'), 300, 60);
            $result = match ($method . ' ' . $path) {
                'GET me' => $this->admin->me($r),
                'POST login' => $this->admin->login($r, $body),
                'POST login/code' => $this->admin->verifyCode($r, $body),
                'GET login/authenticator' => $this->admin->enrollment($r),
                'POST login/authenticator' => $this->admin->enroll($r, $body),
                'POST password' => $this->admin->changePassword($r, $body),
                'POST logout' => $this->empty($body, fn() => $this->admin->logout($r)),
                default => $this->route($r, $method, $path, $body, $query),
            };
            $response = $result instanceof JsonResponse ? $result : new JsonResponse($result);
        } catch (ApiError $e) {
            $response = new JsonResponse(['error' => $e->getMessage()] + $e->details, $e->status);
        } catch (\Throwable $e) {
            error_log(json_encode(['event' => 'admin_request_failed', 'type' => get_class($e)]));
            $response = new JsonResponse(['error' => 'The admin request failed.'], 500);
        }
        foreach (
            [
                'Cache-Control' => 'no-store, private',
                'X-Content-Type-Options' => 'nosniff',
                'Referrer-Policy' => 'no-referrer',
                'X-Robots-Tag' => 'noindex, nofollow',
            ]
            as $name => $value
        ) {
            $response->headers->set($name, $value);
        }
        if ($response->getStatusCode() === 429) {
            $response->headers->set('Retry-After', '60');
        }
        return $response;
    }
    private function empty(array $body, callable $action): mixed
    {
        SaveService::keys($body, []);
        return $action();
    }
    private function route(
        Request $r,
        string $method,
        string $path,
        array $body,
        array $query,
    ): mixed {
        $actor = $this->admin->session($r, $method !== 'GET')['username'];
        if ($method . ' ' . $path === 'GET stats') {
            return $this->service->overview();
        }
        if ($method . ' ' . $path === 'GET players') {
            return $this->service->players($query);
        }
        if ($method . ' ' . $path === 'GET towns') {
            return $this->service->towns($query);
        }
        if ($method . ' ' . $path === 'GET audit') {
            return $this->service->auditLog($query);
        }
        if ($method . ' ' . $path === 'GET admins') {
            return ['admins' => $this->admin->all(), 'self' => $actor];
        }
        if ($method . ' ' . $path === 'POST admins') {
            SaveService::keys($body, ['username']);
            return $this->admin->create($actor, $body['username'] ?? null);
        }
        if (preg_match('~^players/([a-f0-9]{32})(?:/(sign-out))?$~D', $path, $m)) {
            return match ($method . ' ' . ($m[2] ?? '')) {
                'GET ' => $this->service->player($m[1]),
                'POST sign-out' => $this->empty(
                    $body,
                    fn() => $this->service->signOutPlayer($actor, $m[1]),
                ),
                'DELETE ' => $this->service->deletePlayer($actor, $m[1], $body),
                default => throw new ApiError(405, 'Method is not allowed.'),
            };
        }
        if (preg_match('~^towns/([a-f0-9-]{36})(?:/(restore))?$~D', $path, $m)) {
            return match ($method . ' ' . ($m[2] ?? '')) {
                'GET ' => $this->service->townDetail($m[1]),
                'PATCH ' => $this->service->updateTown($actor, $m[1], $body),
                'DELETE ' => $this->service->deleteTown($actor, $m[1], $body),
                'POST restore' => $this->service->restoreTown($actor, $m[1], $body),
                default => throw new ApiError(405, 'Method is not allowed.'),
            };
        }
        if (
            preg_match(
                '~^admins/([a-f0-9]{32})(?:/(reset-password|reset-authenticator))?$~D',
                $path,
                $m,
            )
        ) {
            return match ($method . ' ' . ($m[2] ?? '')) {
                'POST reset-password' => $this->empty(
                    $body,
                    fn() => $this->admin->resetPassword($actor, $m[1]),
                ),
                'POST reset-authenticator' => $this->empty(
                    $body,
                    fn() => $this->admin->resetAuthenticator($actor, $m[1]),
                ),
                'DELETE ' => $this->empty($body, fn() => $this->admin->delete($actor, $m[1])),
                default => throw new ApiError(405, 'Method is not allowed.'),
            };
        }
        throw new ApiError(404, 'Endpoint not found.');
    }
}
