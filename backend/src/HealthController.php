<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\{Request, JsonResponse};
use Symfony\Component\Routing\Attribute\Route;

/** Readiness contract used by the verified o2switch deployment controller. */
final class HealthController {
    public function __construct(private Database $database, private Auth $auth) {}

    #[Route('/api/health', name: 'release_health', methods: ['GET'])]
    public function __invoke(Request $request): JsonResponse {
        $headers = ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff'];
        $marker = dirname(__DIR__).'/public/release.txt';
        $release = is_file($marker) ? trim(file_get_contents($marker)) : '';
        if (preg_match('/^[a-f0-9]{40}-[0-9]{14}-[a-f0-9]{8}$/D', $release)) {
            $headers['X-Release-Id'] = $release;
        }
        try {
            $this->auth->guardHost($request);
            $db = $this->database->get();
            if ((int) $db->fetchOne('SELECT COUNT(*) FROM schema_versions WHERE version=10') !== 1) {
                throw new \RuntimeException('Schema not ready.');
            }
            $db->fetchOne('SELECT id FROM towns LIMIT 1');
            return new JsonResponse(['status' => 'ok'], 200, $headers);
        } catch (ApiError $error) {
            return new JsonResponse(['status' => 'unavailable'], $error->status, $headers);
        } catch (\Throwable) {
            return new JsonResponse(['status' => 'unavailable'], 503, $headers);
        }
    }
}
