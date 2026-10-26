<?php
require __DIR__ . '/support.php';
use App\{ApiController, ApiError, Auth, Database, PublicTown, SaveService};
use Doctrine\DBAL\Configuration;
use Doctrine\DBAL\Driver;
use Doctrine\DBAL\Driver\Middleware\{AbstractConnectionMiddleware, AbstractDriverMiddleware};

// Its own address keeps the shared 127.0.0.1 sign-in limit for the other suites.
$signInIp = [
    'REMOTE_ADDR' =>
        '127.' . random_int(1, 254) . '.' . random_int(1, 254) . '.' . random_int(1, 254),
];

// Aborts the next `$times` statements starting with `$armed` as deadlocks, as both
// databases report them, so the real entry points must replay their whole transaction.
final class InjectedDeadlocks implements Driver\Middleware
{
    public ?string $armed = null;
    public int $times = 0;
    public int $thrown = 0;
    public function arm(string $sql, int $times = 1): void
    {
        $this->armed = $sql;
        $this->times = $times;
    }
    public function wrap(Driver $driver): Driver
    {
        return new class ($driver, $this) extends AbstractDriverMiddleware {
            public function __construct(Driver $driver, private InjectedDeadlocks $faults)
            {
                parent::__construct($driver);
            }
            public function connect(array $params): Driver\Connection
            {
                return new class (parent::connect($params), $this->faults) extends
                    AbstractConnectionMiddleware
                {
                    public function __construct(
                        Driver\Connection $connection,
                        private InjectedDeadlocks $faults,
                    ) {
                        parent::__construct($connection);
                    }
                    public function prepare(string $sql): Driver\Statement
                    {
                        $this->faults->check($sql);
                        return parent::prepare($sql);
                    }
                    public function query(string $sql): Driver\Result
                    {
                        $this->faults->check($sql);
                        return parent::query($sql);
                    }
                    public function exec(string $sql): int|string
                    {
                        $this->faults->check($sql);
                        return parent::exec($sql);
                    }
                };
            }
        };
    }
    public function check(string $sql): void
    {
        if ($this->armed === null || !str_starts_with($sql, $this->armed)) {
            return;
        }
        if (--$this->times <= 0) {
            $this->armed = null;
        }
        $this->thrown++;
        // PostgreSQL reports SQLSTATE 40P01 and MySQL error 1213.
        throw new class ('Injected deadlock') extends Driver\AbstractException {
            public function __construct(string $message)
            {
                parent::__construct($message, '40P01', 1213);
            }
        };
    }
}

// Force the same player -> identity/link -> player cycle as account operations
// racing a sign-in. Barriers arrange locks, rather than relying on random timing.
try {
    // A persistent deadlock still fails after a bounded number of attempts and rolls back
    // every attempted write. Authentication errors must never be retried.
    $driverError = new class ('deadlock') extends RuntimeException implements
        Doctrine\DBAL\Driver\Exception
    {
        public function getSQLState(): ?string
        {
            return '40001';
        }
    };
    $deadlock = new Doctrine\DBAL\Exception\DeadlockException($driverError, null);
    foreach ([$deadlock, new ApiError(401, 'Expired link.')] as $failure) {
        $attempts = 0;
        $marker = bin2hex(random_bytes(32));
        $started = hrtime(true);
        try {
            Database::retryOnDeadlock($db->get(), function ($connection) use (
                $marker,
                $failure,
                &$attempts,
            ) {
                $attempts++;
                $connection->insert('identities', ['email_hash' => $marker]);
                throw $failure;
            });
            throw new RuntimeException('The failed transaction unexpectedly committed.');
        } catch (Throwable $error) {
            check(
                $error === $failure,
                'the original failure reaches the caller after bounded retry',
            );
        }
        check(
            $attempts === ($failure === $deadlock ? Database::DEADLOCK_ATTEMPTS : 1),
            'only deadlocks retry, up to the attempt limit',
        );
        // Each replay first waits at least 5 ms, so the winner can commit.
        check(
            $failure !== $deadlock ||
                hrtime(true) - $started >= (Database::DEADLOCK_ATTEMPTS - 1) * 5000000,
            'replays pause before running again',
        );
        check(
            $db
                ->get()
                ->fetchOne('SELECT email_hash FROM identities WHERE email_hash=?', [$marker]) ===
                false,
            'failed attempts leave no committed writes',
        );
    }
    // Deadlocks on every attempt but the last still commit the work once.
    $attempts = 0;
    $marker = bin2hex(random_bytes(32));
    $result = Database::retryOnDeadlock($db->get(), function ($connection) use (
        $marker,
        $deadlock,
        &$attempts,
    ) {
        $attempts++;
        $connection->insert('identities', ['email_hash' => $marker]);
        if ($attempts < Database::DEADLOCK_ATTEMPTS) {
            throw $deadlock;
        }
        return 'committed';
    });
    check(
        $result === 'committed' && $attempts === Database::DEADLOCK_ATTEMPTS,
        'repeated deadlocks are replayed until the work commits',
    );
    check(
        (int) $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM identities WHERE email_hash=?', [$marker]) === 1,
        'the replayed work commits its writes once',
    );
    $db->get()->delete('identities', ['email_hash' => $marker]);
    $db->get()->beginTransaction();
    $attempts = 0;
    try {
        Database::retryOnDeadlock($db->get(), function () use ($deadlock, &$attempts) {
            $attempts++;
            throw $deadlock;
        });
    } catch (Doctrine\DBAL\Exception\DeadlockException) {
        check($attempts === 1, 'nested work leaves retry to its outer transaction');
    } finally {
        $db->get()->rollBack();
    }
    foreach (['email change', 'account erasure', 'sign-out'] as $operation) {
        $owner = account($signInIp);
        $player = $db->get()->fetchAssociative('SELECT * FROM players WHERE id=?', [$owner['id']]);
        $token = bin2hex(random_bytes(32));
        $hash = $auth->hash($token);
        $db->get()->insert('login_intents', [
            'token_hash' => $hash,
            'email' => $player['email'],
            'expires_at' => time() + 900,
        ]);
        $db->get()->close();
        [$parent, $child] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
        stream_set_timeout($parent, 15);
        stream_set_timeout($child, 15);
        $pid = pcntl_fork();
        if ($pid < 0) {
            throw new RuntimeException('Could not fork sign-in.');
        }
        if ($pid === 0) {
            fclose($parent);
            $database = new Database();
            $connection = $database->get();
            $login = new Auth($database);
            $attempts = 0;
            if (fgets($child) !== "player locked\n") {
                exit(20);
            }
            try {
                Database::retryOnDeadlock($connection, function () use (
                    $connection,
                    $login,
                    $player,
                    $hash,
                    $child,
                    &$attempts,
                ) {
                    $attempts++;
                    $login->lockIdentity($connection, $player['email']);
                    $intent = $connection->fetchAssociative(
                        'SELECT * FROM login_intents WHERE token_hash=? FOR UPDATE',
                        [$hash],
                    );
                    if (!$intent) {
                        throw new ApiError(401, 'This link has expired or was already used.');
                    }
                    if ($attempts === 1) {
                        fwrite($child, "identity locked\n");
                        if (fgets($child) !== "issue session\n") {
                            throw new RuntimeException('Missing sign-in barrier.');
                        }
                    }
                    $connection->delete('login_intents', ['token_hash' => $hash]);
                    $connection->insert('sessions', [
                        'token_hash' => bin2hex(random_bytes(32)),
                        'player_id' => $player['id'],
                        'csrf_hash' => str_repeat('a', 64),
                        'created_at' => time(),
                        'expires_at' => time() + 3600,
                    ]);
                });
                $status = 200;
            } catch (ApiError $error) {
                $status = $error->status;
            } catch (Throwable $error) {
                fwrite($child, json_encode(['error' => get_class($error)]) . "\n");
                exit(21);
            }
            fwrite($child, json_encode(['status' => $status, 'attempts' => $attempts]) . "\n");
            fclose($child);
            exit(0);
        }
        fclose($child);
        $attempts = 0;
        $changedEmail = 'changed-' . bin2hex(random_bytes(6)) . '@example.test';
        Database::retryOnDeadlock($db->get(), function ($connection) use (
            $player,
            $auth,
            $parent,
            $operation,
            $changedEmail,
            &$attempts,
        ) {
            $attempts++;
            $connection->fetchOne('SELECT id FROM players WHERE id=? FOR UPDATE', [$player['id']]);
            if ($attempts === 1) {
                fwrite($parent, "player locked\n");
                if (fgets($parent) !== "identity locked\n") {
                    throw new RuntimeException('Missing account barrier.');
                }
                fwrite($parent, "issue session\n");
            }
            if ($operation === 'email change') {
                $connection->update('players', ['email' => $changedEmail], ['id' => $player['id']]);
            }
            if ($operation !== 'sign-out') {
                $connection->delete('identities', [
                    'email_hash' => $auth->identityHash($player['email']),
                ]);
            }
            $connection->delete('login_intents', ['email' => $player['email']]);
            if ($operation === 'account erasure') {
                $connection->delete('players', ['id' => $player['id']]);
            }
            if ($operation === 'sign-out') {
                $connection->delete('sessions', ['player_id' => $player['id']]);
            }
        });
        $result = json_decode((string) fgets($parent), true);
        fclose($parent);
        pcntl_waitpid($pid, $exit);
        check(
            pcntl_wifexited($exit) && pcntl_wexitstatus($exit) === 0,
            $operation . ' sign-in process completed: ' . json_encode($result),
        );
        check(
            in_array($result['status'], [200, 401], true),
            $operation . ' has a valid sign-in outcome',
        );
        check(
            $attempts + $result['attempts'] === 3,
            $operation . ' retries exactly one aborted transaction',
        );
        check(
            $db->get()->getTransactionNestingLevel() === 0,
            $operation . ' leaves no open transaction',
        );
        $saved = $db->get()->fetchAssociative('SELECT * FROM players WHERE id=?', [$player['id']]);
        check(
            $operation === 'account erasure'
                ? $saved === false
                : $saved['email'] ===
                    ($operation === 'email change' ? $changedEmail : $player['email']),
            $operation . ' commits the account operation',
        );
        $sessions = (int) $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM sessions WHERE player_id=?', [$player['id']]);
        check(
            $sessions <= ($operation === 'email change' ? 2 : 0),
            $operation . ' does not duplicate sessions or undo erasure/sign-out',
        );
    }
    // The real sign-in, save, email-change and sign-out routes each replay a
    // transaction the database aborted, without duplicating its writes.
    $faults = new InjectedDeadlocks();
    $flaky = new Database((new Configuration())->setMiddlewares([$faults]));
    $flakyAuth = new Auth($flaky);
    $flakyPublic = new PublicTown($flaky, $flakyAuth);
    $realApi = $api;
    $api = new ApiController(
        $flakyAuth,
        new SaveService($flaky, $flakyAuth, $flakyPublic),
        $flakyPublic,
        $flaky,
    );
    try {
        $sessions = fn(string $id): int => (int) $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM sessions WHERE player_id=?', [$id]);
        $faults->arm('DELETE FROM login_intents');
        $owner = account($signInIp);
        check($faults->thrown === 1, 'sign-in met a deadlock');
        check($sessions($owner['id']) === 1, 'the replayed sign-in issues one session');

        $towns = fn(): int => (int) $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM towns WHERE player_id=?', [$owner['id']]);
        $faults->arm('INSERT INTO towns');
        status(
            200,
            callApi('POST', 'towns', townBody('Deadlock Retry'), $owner),
            'save after a deadlock',
        );
        check($faults->thrown === 2, 'the save met a deadlock');
        check($towns() === 1, 'the replayed save stores one town');

        // Deadlocks in a row are replayed while attempts remain; then the request fails
        // without storing anything, and the player's local progress waits for a retry.
        $faults->arm('INSERT INTO towns', Database::DEADLOCK_ATTEMPTS - 1);
        status(
            200,
            callApi('POST', 'towns', townBody('Deadlock Again'), $owner),
            'save after repeated deadlocks',
        );
        check(
            $faults->thrown === 1 + Database::DEADLOCK_ATTEMPTS,
            'the save met a deadlock on every attempt but the last',
        );
        check($towns() === 2, 'the repeatedly replayed save stores one town');
        $faults->arm('INSERT INTO towns', Database::DEADLOCK_ATTEMPTS);
        status(
            500,
            callApi('POST', 'towns', townBody('Deadlock Exhausted'), $owner),
            'save after a deadlock on every attempt',
        );
        check(
            $faults->thrown === 1 + 2 * Database::DEADLOCK_ATTEMPTS && $faults->armed === null,
            'the save stops after the attempt limit',
        );
        check($towns() === 2, 'the exhausted save stores nothing');
        $thrown = $faults->thrown;

        $token = bin2hex(random_bytes(32));
        $changed = 'retried-' . bin2hex(random_bytes(6)) . '@example.test';
        $db->get()->insert('email_changes', [
            'token_hash' => $auth->hash($token),
            'player_id' => $owner['id'],
            'email' => $changed,
            'expires_at' => time() + 900,
        ]);
        $faults->arm('UPDATE players SET email');
        status(
            200,
            callApi('POST', 'account/email/confirm', ['token' => $token], [], $signInIp),
            'email change after a deadlock',
        );
        check($faults->thrown === $thrown + 1, 'the email change met a deadlock');
        check(
            $db->get()->fetchOne('SELECT email FROM players WHERE id=?', [$owner['id']]) ===
                $changed,
            'the replayed email change commits',
        );

        $faults->arm('DELETE FROM sessions');
        $signedOut = callApi('POST', 'auth/logout', new stdClass(), $owner, $signInIp);
        check(
            $signedOut['status'] === 200 && $faults->thrown === $thrown + 2,
            'sign-out after a deadlock',
        );
        check($sessions($owner['id']) === 0, 'the replayed sign-out removes its session');
    } finally {
        $api = $realApi;
    }
    echo "Deadlock retry checks passed ($count assertions).\n";
} finally {
    cleanup();
}
