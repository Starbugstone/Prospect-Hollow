<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\{Request, Cookie, JsonResponse};

/**
 * Admin accounts are separate from players. Signing in is staged on one short session:
 * password, then the authenticator code, then any required password change and
 * authenticator enrollment. Only a "full" session may read player data.
 */
final class AdminAuth
{
    // Actor recorded for bin/admin.php; parentheses can never appear in a username.
    public const SERVER = '(server)';
    private const IDLE = 3600,
        LIFETIME = 43200,
        PENDING = 600,
        MAX_CODE_ATTEMPTS = 5;
    private static ?string $dummy = null;
    public function __construct(private Database $database, private Auth $auth) {}

    public function cookieName(): string
    {
        return str_starts_with($this->auth->origin(), 'https:')
            ? '__Host-cascade-admin'
            : 'cascade_admin_local';
    }
    // The panel is a same-origin browser page only: native app origins are never accepted.
    public function guardOrigin(Request $r): void
    {
        if (
            $r->headers->get('Origin') !== $this->auth->origin() ||
            in_array($r->headers->get('Sec-Fetch-Site'), ['cross-site', 'same-site'], true)
        ) {
            throw new ApiError(403, 'Request origin is not allowed.');
        }
    }
    public static function username(mixed $name): string
    {
        $name = is_string($name) ? strtolower(trim($name)) : '';
        if (!preg_match('/^[a-z0-9][a-z0-9._-]{2,31}$/D', $name)) {
            throw new ApiError(
                422,
                'Use 3–32 lowercase letters, digits, dots, dashes or underscores for the username.',
            );
        }
        return $name;
    }
    private static function password(mixed $password, string $username): string
    {
        if (!is_string($password) || mb_strlen($password) < 12 || strlen($password) > 256) {
            throw new ApiError(422, 'Use a password of 12 to 256 characters.');
        }
        if (str_contains(strtolower($password), $username)) {
            throw new ApiError(422, 'The password must not contain the username.');
        }
        return $password;
    }
    // Pre-hashing keeps long passphrases intact when only bcrypt (72 bytes) is available.
    private static function prepared(string $password): string
    {
        return base64_encode(hash('sha256', $password, true));
    }
    private static function algorithm(): string
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }
    private static function hashPassword(string $password): string
    {
        return password_hash(self::prepared($password), self::algorithm());
    }
    private static function verifyPassword(string $password, ?string $hash): bool
    {
        // Unknown usernames still pay for one hash so timing does not reveal them.
        $valid = password_verify(
            self::prepared($password),
            $hash ?? (self::$dummy ??= self::hashPassword(bin2hex(random_bytes(16)))),
        );
        return $hash !== null && $valid;
    }
    public static function temporaryPassword(): string
    {
        $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $text = '';
        for ($i = 0; $i < 20; $i++) {
            $text .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return implode('-', str_split($text, 5));
    }

    // Authenticator secrets are encrypted with a key derived from APP_SECRET.
    private function key(): string
    {
        return hex2bin($this->auth->hash('admin-totp-key'));
    }
    private function seal(string $secret): string
    {
        $iv = random_bytes(12);
        $cipher = openssl_encrypt(
            $secret,
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );
        return base64_encode($iv . $tag . $cipher);
    }
    private function unseal(string $sealed): string
    {
        $raw = base64_decode($sealed, true);
        $secret =
            $raw === false
                ? false
                : openssl_decrypt(
                    substr($raw, 28),
                    'aes-256-gcm',
                    $this->key(),
                    OPENSSL_RAW_DATA,
                    substr($raw, 0, 12),
                    substr($raw, 12, 16),
                );
        if ($secret === false) {
            throw new \RuntimeException('The admin authenticator secret cannot be read.');
        }
        return $secret;
    }

    public function audit(
        string $admin,
        string $action,
        ?string $target = null,
        ?string $detail = null,
    ): void {
        $this->database->get()->insert('admin_audit', [
            'at' => time(),
            'admin' => substr($admin, 0, 32),
            'action' => $action,
            'target' => $target,
            'detail' => $detail === null ? null : mb_substr($detail, 0, 255),
        ]);
    }

    // After the code (or with none enrolled yet): a temporary password must be replaced, then an authenticator set up.
    private static function stageAfterCode(array $admin): string
    {
        return $admin['must_change'] ? 'change' : ($admin['totp_enabled'] ? 'full' : 'enroll');
    }
    private function issue(array $admin, string $stage): JsonResponse
    {
        $token = bin2hex(random_bytes(32));
        $csrf = $this->auth->hash('admin-csrf:' . $token);
        $now = time();
        $this->database->get()->insert('admin_sessions', [
            'token_hash' => $this->auth->hash('admin:' . $token),
            'admin_id' => $admin['id'],
            'csrf_hash' => $this->auth->hash($csrf),
            'stage' => $stage,
            'attempts' => 0,
            'created_at' => $now,
            'used_at' => $now,
            'expires_at' => $now + self::PENDING,
        ]);
        $response = new JsonResponse(['stage' => $stage, 'csrf' => $csrf]);
        // A browser-session cookie: the server enforces idle and absolute expiry.
        $response->headers->setCookie(
            Cookie::create($this->cookieName(), $token)
                ->withPath('/')
                ->withSecure(str_starts_with($this->auth->origin(), 'https:'))
                ->withHttpOnly(true)
                ->withSameSite('strict')
                ->withExpires(0),
        );
        return $response;
    }
    private function advance(Connection $db, array $session): array
    {
        $admin = $db->fetchAssociative('SELECT * FROM admins WHERE id=?', [$session['admin_id']]);
        $stage = self::stageAfterCode($admin);
        $now = time();
        $db->update(
            'admin_sessions',
            [
                'stage' => $stage,
                'attempts' => 0,
                'expires_at' => $now + ($stage === 'full' ? self::LIFETIME : self::PENDING),
            ],
            ['token_hash' => $session['token_hash']],
        );
        if ($stage === 'full') {
            $db->update('admins', ['last_login_at' => $now], ['id' => $admin['id']]);
            $this->audit($admin['username'], 'signed_in');
        }
        return ['stage' => $stage];
    }
    public function session(Request $r, bool $mutation = false, array $stages = ['full']): array
    {
        $token = $r->cookies->get($this->cookieName(), '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
            throw new ApiError(401, 'Please sign in.');
        }
        $db = $this->database->get();
        $now = time();
        $session = $db->fetchAssociative(
            'SELECT s.*,a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND s.used_at>?',
            [$this->auth->hash('admin:' . $token), $now, $now - self::IDLE],
        );
        if (!$session) {
            throw new ApiError(401, 'Please sign in.');
        }
        if (
            $mutation &&
            !hash_equals(
                $session['csrf_hash'],
                $this->auth->hash($r->headers->get('X-CSRF-Token', '')),
            )
        ) {
            throw new ApiError(403, 'Refresh this page before trying again.');
        }
        if (!in_array($session['stage'], $stages, true)) {
            throw new ApiError(403, 'Finish signing in first.', ['stage' => $session['stage']]);
        }
        if ((int) $session['used_at'] < $now - 60) {
            $db->update(
                'admin_sessions',
                ['used_at' => $now],
                ['token_hash' => $session['token_hash']],
            );
        }
        $session['csrf'] = $this->auth->hash('admin-csrf:' . $token);
        return $session;
    }
    public function me(Request $r): array
    {
        $s = $this->session($r, false, ['totp', 'change', 'enroll', 'full']);
        return [
            'admin' => ['id' => $s['admin_id'], 'username' => $s['username']],
            'stage' => $s['stage'],
            'csrf' => $s['csrf'],
        ];
    }
    public function login(Request $r, array $body): JsonResponse
    {
        SaveService::keys($body, ['username', 'password']);
        $username = is_string($body['username'] ?? null) ? strtolower(trim($body['username'])) : '';
        $this->auth->limit('admin-login:' . ($r->getClientIp() ?? 'unknown'), 10, 900);
        $this->auth->limit('admin-user:' . $username, 20, 900);
        $admin = preg_match('/^[a-z0-9._-]{3,32}$/D', $username)
            ? $this->database
                ->get()
                ->fetchAssociative('SELECT * FROM admins WHERE username=?', [$username])
            : false;
        if (
            !self::verifyPassword(
                is_string($body['password'] ?? null) ? $body['password'] : '',
                $admin ? $admin['password_hash'] : null,
            )
        ) {
            if ($admin) {
                $this->audit($username, 'sign_in_failed');
            }
            throw new ApiError(401, 'Wrong username or password.');
        }
        if (password_needs_rehash($admin['password_hash'], self::algorithm())) {
            $this->database
                ->get()
                ->update(
                    'admins',
                    ['password_hash' => self::hashPassword($body['password'])],
                    ['id' => $admin['id']],
                );
        }
        return $this->issue($admin, $admin['totp_enabled'] ? 'totp' : self::stageAfterCode($admin));
    }
    // Wrong codes count against the session; the failure is recorded outside the rollback.
    private function checkCode(Request $r, array $body, string $stage, callable $accept): array
    {
        SaveService::keys($body, ['code']);
        $s = $this->session($r, true, [$stage]);
        $this->auth->limit('admin-code:' . $s['admin_id'], 10, 900);
        $code = is_string($body['code'] ?? null) ? preg_replace('/\s+/', '', $body['code']) : '';
        $db = $this->database->get();
        $result = $db->transactional(function ($db) use ($s, $code, $accept) {
            $admin = $db->fetchAssociative('SELECT * FROM admins WHERE id=? FOR UPDATE', [
                $s['admin_id'],
            ]);
            if (!$admin['totp_secret']) {
                return null;
            }
            $step = Totp::verify(
                $this->unseal($admin['totp_secret']),
                $code,
                (int) $admin['totp_step'],
            );
            if ($step === null) {
                return null;
            }
            $accept($db, $admin, $step);
            return $this->advance($db, $s);
        });
        if ($result !== null) {
            return $result;
        }
        if ((int) $s['attempts'] + 1 >= self::MAX_CODE_ATTEMPTS) {
            $db->delete('admin_sessions', ['token_hash' => $s['token_hash']]);
            $this->audit($s['username'], 'code_attempts_exceeded');
            throw new ApiError(401, 'Too many wrong codes. Sign in again.');
        }
        $db->update(
            'admin_sessions',
            ['attempts' => (int) $s['attempts'] + 1],
            ['token_hash' => $s['token_hash']],
        );
        throw new ApiError(
            422,
            'That code is not valid. Check the time on your phone and try the newest code.',
        );
    }
    public function verifyCode(Request $r, array $body): array
    {
        return $this->checkCode(
            $r,
            $body,
            'totp',
            fn($db, $admin, $step) => $db->update(
                'admins',
                ['totp_step' => $step],
                ['id' => $admin['id']],
            ),
        );
    }
    public function enrollment(Request $r): array
    {
        $s = $this->session($r, false, ['enroll']);
        $db = $this->database->get();
        $admin = $db->fetchAssociative('SELECT * FROM admins WHERE id=?', [$s['admin_id']]);
        if ($admin['totp_secret']) {
            $secret = $this->unseal($admin['totp_secret']);
        } else {
            $secret = Totp::secret();
            $db->update(
                'admins',
                ['totp_secret' => $this->seal($secret)],
                ['id' => $admin['id'], 'totp_enabled' => 0],
            );
        }
        $host = parse_url($this->auth->origin(), PHP_URL_HOST);
        return [
            'secret' => $secret,
            'uri' => Totp::uri('Prospect Hollow', $admin['username'] . '@' . $host, $secret),
        ];
    }
    public function enroll(Request $r, array $body): array
    {
        return $this->checkCode($r, $body, 'enroll', function ($db, $admin, $step) {
            $db->update(
                'admins',
                ['totp_enabled' => 1, 'totp_step' => $step],
                ['id' => $admin['id']],
            );
            $this->audit($admin['username'], 'authenticator_enrolled');
        });
    }
    // A required change needs no current password: it was just proven. Otherwise it does.
    public function changePassword(Request $r, array $body): array
    {
        SaveService::keys($body, ['current', 'password']);
        $s = $this->session($r, true, ['change', 'full']);
        return $this->database->get()->transactional(function ($db) use ($s, $body) {
            $admin = $db->fetchAssociative('SELECT * FROM admins WHERE id=? FOR UPDATE', [
                $s['admin_id'],
            ]);
            if (
                $s['stage'] === 'full' &&
                !self::verifyPassword(
                    is_string($body['current'] ?? null) ? $body['current'] : '',
                    $admin['password_hash'],
                )
            ) {
                throw new ApiError(422, 'Your current password is not correct.');
            }
            $password = self::password($body['password'] ?? null, $admin['username']);
            if (self::verifyPassword($password, $admin['password_hash'])) {
                throw new ApiError(422, 'Choose a password you have not used here.');
            }
            $db->update(
                'admins',
                ['password_hash' => self::hashPassword($password), 'must_change' => 0],
                ['id' => $admin['id']],
            );
            $db->executeStatement('DELETE FROM admin_sessions WHERE admin_id=? AND token_hash<>?', [
                $admin['id'],
                $s['token_hash'],
            ]);
            $this->audit($admin['username'], 'password_changed');
            return $s['stage'] === 'change' ? $this->advance($db, $s) : ['stage' => 'full'];
        });
    }
    public function logout(Request $r): JsonResponse
    {
        $s = $this->session($r, true, ['totp', 'change', 'enroll', 'full']);
        $this->database->get()->delete('admin_sessions', ['token_hash' => $s['token_hash']]);
        $response = new JsonResponse(['ok' => true]);
        $response->headers->clearCookie(
            $this->cookieName(),
            '/',
            null,
            str_starts_with($this->auth->origin(), 'https:'),
            true,
            'strict',
        );
        return $response;
    }

    // Account management, shared by the panel and bin/admin.php (actor SERVER).
    public function all(): array
    {
        return array_map(
            fn($a) => [
                'id' => $a['id'],
                'username' => $a['username'],
                'createdAt' => (int) $a['created_at'],
                'createdBy' => $a['created_by'],
                'lastLoginAt' => $a['last_login_at'] === null ? null : (int) $a['last_login_at'],
                'authenticator' => (bool) $a['totp_enabled'],
                'mustChangePassword' => (bool) $a['must_change'],
            ],
            $this->database->get()->fetchAllAssociative('SELECT * FROM admins ORDER BY username'),
        );
    }
    public function find(string $username): array
    {
        $admin = $this->database
            ->get()
            ->fetchAssociative('SELECT * FROM admins WHERE username=?', [
                self::username($username),
            ]);
        if (!$admin) {
            throw new ApiError(404, 'No admin has that username.');
        }
        return $admin;
    }
    private function other(string $actor, string $id): array
    {
        $admin = $this->database->get()->fetchAssociative('SELECT * FROM admins WHERE id=?', [$id]);
        if (!$admin) {
            throw new ApiError(404, 'No admin has that ID.');
        }
        if ($admin['username'] === $actor) {
            throw new ApiError(409, 'Use your own account settings for yourself.');
        }
        return $admin;
    }
    public function create(string $actor, mixed $username): array
    {
        $username = self::username($username);
        $password = self::temporaryPassword();
        try {
            $this->database->get()->insert('admins', [
                'id' => bin2hex(random_bytes(16)),
                'username' => $username,
                'password_hash' => self::hashPassword($password),
                'must_change' => 1,
                'totp_enabled' => 0,
                'totp_step' => 0,
                'created_at' => time(),
                'created_by' => $actor,
            ]);
        } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException) {
            throw new ApiError(409, 'That username is already an admin.');
        }
        $this->audit($actor, 'admin_created', $username);
        return ['username' => $username, 'password' => $password];
    }
    // Resets sign everyone out of that account; the temporary password must be replaced.
    public function resetPassword(string $actor, string $id): array
    {
        $admin = $this->other($actor, $id);
        $password = self::temporaryPassword();
        $db = $this->database->get();
        $db->update(
            'admins',
            ['password_hash' => self::hashPassword($password), 'must_change' => 1],
            ['id' => $id],
        );
        $db->delete('admin_sessions', ['admin_id' => $id]);
        $this->audit($actor, 'admin_password_reset', $admin['username']);
        return ['username' => $admin['username'], 'password' => $password];
    }
    public function resetAuthenticator(string $actor, string $id): array
    {
        $admin = $this->other($actor, $id);
        $db = $this->database->get();
        $db->update(
            'admins',
            ['totp_secret' => null, 'totp_enabled' => 0, 'totp_step' => 0],
            ['id' => $id],
        );
        $db->delete('admin_sessions', ['admin_id' => $id]);
        $this->audit($actor, 'admin_authenticator_reset', $admin['username']);
        return ['ok' => true];
    }
    public function delete(string $actor, string $id): array
    {
        $admin = $this->other($actor, $id);
        return $this->database->get()->transactional(function ($db) use ($actor, $admin) {
            // Serialize concurrent removals so the panel can never delete the last admin.
            $ids = $db->fetchFirstColumn('SELECT id FROM admins ORDER BY id FOR UPDATE');
            if (count($ids) < 2 && $actor !== self::SERVER) {
                throw new ApiError(409, 'Keep at least one admin.');
            }
            $db->delete('admins', ['id' => $admin['id']]);
            $this->audit($actor, 'admin_deleted', $admin['username']);
            return ['ok' => true];
        });
    }
}
