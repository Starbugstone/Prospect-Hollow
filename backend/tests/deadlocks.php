<?php
require __DIR__ . '/support.php';
use App\{ApiError, Auth, Database};

// Force the same player -> identity/link -> player cycle as account operations
// racing a sign-in. Barriers arrange locks, rather than relying on random timing.
try {
    // A persistent deadlock still fails after one retry and rolls back every
    // attempted write. Authentication errors must never be retried.
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
            $attempts === ($failure === $deadlock ? 2 : 1),
            'only deadlocks retry, and only once',
        );
        check(
            $db
                ->get()
                ->fetchOne('SELECT email_hash FROM identities WHERE email_hash=?', [$marker]) ===
                false,
            'failed attempts leave no committed writes',
        );
    }
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
        $owner = account();
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
    echo "Deadlock retry checks passed ($count assertions).\n";
} finally {
    cleanup();
}
