<?php
declare(strict_types=1);
namespace App;

use Symfony\Component\HttpFoundation\{JsonResponse, StreamedResponse};

/** Spools JSON without expanding stored save documents or buffering the download. */
final class JsonExport
{
    /** @var resource */
    private $stream;

    public function __construct()
    {
        $stream = tmpfile();
        if ($stream === false) {
            throw new \RuntimeException('The account export could not be created.');
        }
        $this->stream = $stream;
    }

    public function __destruct()
    {
        if (is_resource($this->stream)) {
            fclose($this->stream);
        }
    }

    /** Database save columns already contain validated JSON, including null. */
    public static function stored(?string $json): \Closure
    {
        if ($json !== null && !json_validate($json)) {
            throw new \RuntimeException('A stored export document contains invalid JSON.');
        }
        return static fn(self $writer) => $writer->append($json ?? 'null');
    }

    /** Arrays keep their JSON shape; generators emit lists one entry at a time. */
    public function write(mixed $value): void
    {
        if ($value instanceof \Closure) {
            $value($this);
        } elseif (is_array($value) || $value instanceof \Traversable) {
            $list = !is_array($value) || array_is_list($value);
            $this->append($list ? '[' : '{');
            $first = true;
            foreach ($value as $key => $entry) {
                if (!$first) {
                    $this->append(',');
                }
                $first = false;
                if (!$list) {
                    $this->append(json_encode((string) $key, JSON_THROW_ON_ERROR) . ':');
                }
                $this->write($entry);
            }
            $this->append($list ? ']' : '}');
        } else {
            $this->append(
                json_encode($value, JSON_THROW_ON_ERROR | JsonResponse::DEFAULT_ENCODING_OPTIONS),
            );
        }
    }

    private function append(string $json): void
    {
        $length = strlen($json);
        $offset = 0;
        while ($offset < $length) {
            $written = fwrite($this->stream, $offset === 0 ? $json : substr($json, $offset));
            if ($written === false || $written === 0) {
                throw new \RuntimeException('The account export could not be written.');
            }
            $offset += $written;
        }
    }

    /** Authorization and all database reads finish before a response can be sent. */
    public function response(): StreamedResponse
    {
        return new StreamedResponse(
            function (): void {
                try {
                    rewind($this->stream);
                    while (!feof($this->stream)) {
                        $chunk = fread($this->stream, 65536);
                        if ($chunk === false) {
                            throw new \RuntimeException('The account export could not be read.');
                        }
                        echo $chunk;
                    }
                } finally {
                    fclose($this->stream);
                }
            },
            200,
            ['Content-Type' => 'application/json'],
        );
    }
}
