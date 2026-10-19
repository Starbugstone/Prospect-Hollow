<?php
// Consume a larger-than-memory export in chunks under the production 128 MB limit.
require __DIR__ . '/support.php';
use App\SaveService;
use Symfony\Component\HttpFoundation\StreamedResponse;

ini_set('memory_limit', '128M');
$documents = [];
$rawBytes = 0;
function exportDocument(string $marker, int $bytes, bool $upload = false): string
{
    $base = substr(json_encode(profile()), 0, -1);
    $bulk = str_repeat('x', $bytes);
    return $base .
        ($upload
            ? ',"integrity":{"actions":[{"padding":"' . $bulk . '"}]}'
            : ',"padding":"' . $bulk . '"') .
        ',"exportMarker":"' .
        $marker .
        '"}';
}
function rememberDocument(string $json): string
{
    global $documents, $rawBytes;
    preg_match('/"exportMarker":"([^"]+)"/', $json, $marker);
    $documents[$marker[1]] = ($documents[$marker[1]] ?? 0) + 1;
    $rawBytes += strlen($json);
    return $json;
}
function exportTemps(): array
{
    return glob(sys_get_temp_dir() . '/php*') ?: [];
}
try {
    $owner = account();
    $other = account();
    $foreign = status(
        200,
        callApi('POST', 'towns', townBody('Foreign Export'), $other),
        'foreign town',
    );
    $db->get()->insert('town_sync_rejections', [
        'id' => bin2hex(random_bytes(16)),
        'town_id' => $foreign['townId'],
        'rejected_at' => time() * 1000,
        'revision' => 1,
        'code' => 'test',
        'field' => null,
        'message' => 'FOREIGN_PRIVATE',
        'upload' => '{"secret":"FOREIGN_PRIVATE"}',
        'cloud' => '{}',
        'expected' => null,
    ]);
    status(401, callApi('GET', 'account/export'), 'export requires a session');
    $empty = status(200, callApi('GET', 'account/export', null, $owner), 'another owner export');
    check(
        $empty['refusedCloudSaves'] === [],
        'a different owner cannot export the foreign comparison',
    );

    // Soft-deleted towns do not consume a slot, but their saves and histories remain
    // exportable. Nine towns exercise keyset pages and five history rows apiece.
    $cloud = exportDocument('EXPORT-CLOUD', 768 * 1024);
    $upload = exportDocument('EXPORT-UPLOAD', 7680 * 1024, true);
    check(
        strlen($upload) < SaveService::MAX_UPLOAD_BYTES,
        'the rejected upload fits the real upload limit',
    );
    for ($i = 0; $i < 9; $i++) {
        $town = status(
            200,
            callApi('POST', 'towns', townBody('Export Town ' . $i), $owner),
            'export town',
        );
        $id = $town['townId'];
        $current = exportDocument('EXPORT-CURRENT-' . $i, 768 * 1024);
        $db->get()->update(
            'towns',
            ['profile' => rememberDocument($current), 'revision' => 6],
            ['id' => $id],
        );
        unset($current);
        for ($revision = 1; $revision <= 5; $revision++) {
            $history = exportDocument('EXPORT-HISTORY-' . $i . '-' . $revision, 768 * 1024);
            $db->get()->insert('town_history', [
                'town_id' => $id,
                'revision' => $revision,
                'saved_at' => time() - $revision,
                'profile' => rememberDocument($history),
            ]);
            unset($history);
        }
        if ($i < 6) {
            SaveService::tombstone($db->get(), $id);
        } else {
            for ($rejection = 0; $rejection < 5; $rejection++) {
                $db->get()->insert('town_sync_rejections', [
                    'id' => bin2hex(random_bytes(16)),
                    'town_id' => $id,
                    'rejected_at' => time() * 1000 - $rejection * 60000,
                    'revision' => 6,
                    'code' => 'test',
                    'field' => 'town.coins',
                    'message' => 'EXPORT-REJECTION-' . $i . '-' . $rejection,
                    'upload' => rememberDocument($upload),
                    'cloud' => rememberDocument($cloud),
                    'expected' => rememberDocument($cloud),
                ]);
            }
        }
    }
    unset($upload, $cloud);
    $baseline = exportTemps();
    $reply = callApi(
        'GET',
        'account/export',
        null,
        $owner,
        [
            'HTTP_ORIGIN' => 'capacitor://localhost',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $owner['cookie'],
        ],
        false,
    );
    $response = $reply['response'];
    check(
        $reply['status'] === 200 && $response instanceof StreamedResponse,
        'large export returns a streaming response',
    );
    check(
        $response->headers->get('Content-Type') === 'application/json',
        'stream keeps the JSON media type',
    );
    check(
        str_contains($response->headers->get('Cache-Control'), 'no-store') &&
            str_contains($response->headers->get('Cache-Control'), 'private'),
        'stream remains private and uncacheable',
    );
    check(
        $response->headers->get('X-Content-Type-Options') === 'nosniff' &&
            $response->headers->get('Referrer-Policy') === 'no-referrer',
        'stream keeps privacy response headers',
    );
    check(
        $response->headers->get('Access-Control-Allow-Origin') === 'capacitor://localhost',
        'native sessions keep their CORS headers',
    );
    check(
        !$db->get()->isTransactionActive(),
        'no player transaction remains during client download',
    );
    $temporary = array_values(array_diff(exportTemps(), $baseline));
    check(count($temporary) === 1, 'one temporary export file exists before streaming');

    $bytes = 0;
    $found = [];
    $tail = '';
    $first = '';
    $last = '';
    ob_start(function (string $chunk) use (&$bytes, &$found, &$tail, &$first, &$last): string {
        $bytes += strlen($chunk);
        $first = $first === '' ? substr($chunk, 0, 32) : $first;
        $last = substr($chunk, -2);
        $scan = $tail . $chunk;
        preg_match_all(
            '/EXPORT-(?:CURRENT|HISTORY|CLOUD|UPLOAD|REJECTION)[A-Za-z0-9-]*|FOREIGN_PRIVATE/',
            $scan,
            $matches,
            PREG_OFFSET_CAPTURE,
        );
        $consumed = 0;
        foreach ($matches[0] as [$marker, $offset]) {
            // A final partial token waits for the next chunk.
            if ($offset + strlen($marker) === strlen($scan)) {
                break;
            }
            $found[$marker] = ($found[$marker] ?? 0) + 1;
            $consumed = $offset + strlen($marker);
        }
        $tail = substr(substr($scan, $consumed), -64);
        return '';
    }, 65536);
    try {
        $response->sendContent();
        ob_end_flush();
    } catch (Throwable $error) {
        ob_end_clean();
        throw $error;
    }
    check(
        $bytes > 128 * 1024 * 1024 && $bytes > $rawBytes,
        'the complete export exceeds the process memory limit',
    );
    check(
        str_starts_with($first, '{"exportedAt":') && $last === ']}',
        'the streamed document has its expected JSON envelope',
    );
    foreach ($documents as $marker => $copies) {
        check(
            ($found[$marker] ?? 0) === $copies,
            'exports every retained raw document: ' . $marker,
        );
    }
    for ($i = 6; $i < 9; $i++) {
        for ($j = 0; $j < 5; $j++) {
            check(
                ($found['EXPORT-REJECTION-' . $i . '-' . $j] ?? 0) === 1,
                'exports each rejection once',
            );
        }
    }
    check(!isset($found['FOREIGN_PRIVATE']), 'streamed data stays scoped to its owner');
    check(!file_exists($temporary[0]), 'stream completion deletes the temporary file');
    check(
        memory_get_peak_usage(true) < 128 * 1024 * 1024,
        'export completes below the production memory limit',
    );
    ob_start();
    $response->sendContent();
    check(ob_get_clean() === '', 'the response streams only once');
    unset($reply, $response);

    $abandoned = callApi('GET', 'account/export', null, $owner, [], false);
    $temporary = array_values(array_diff(exportTemps(), $baseline));
    check(count($temporary) === 1, 'an unsent response owns its temporary file');
    unset($abandoned);
    gc_collect_cycles();
    check(!file_exists($temporary[0]), 'abandoning the response deletes its temporary file');

    $db->get()->update('towns', ['profile' => '{'], ['id' => $id]);
    status(
        500,
        callApi('GET', 'account/export', null, $owner),
        'malformed stored JSON fails before streaming',
    );
    check(exportTemps() === $baseline, 'failed export creation deletes its temporary file');
    $bucket = $auth->hash('export:' . $owner['id'] . ':' . intdiv(time(), 3600));
    $db->get()->update('limits', ['hits' => 10], ['bucket' => $bucket]);
    $limited = callApi('GET', 'account/export', null, $owner);
    status(429, $limited, 'export rate limiting happens before streaming');
    check(
        $limited['response']->headers->get('Retry-After') === '60' && exportTemps() === $baseline,
        'rate-limited export writes no temporary file',
    );
    echo 'Bounded export checks passed (' .
        $count .
        ' assertions, ' .
        $bytes .
        ' bytes, peak ' .
        memory_get_peak_usage(true) .
        ").\n";
} finally {
    cleanup();
}
