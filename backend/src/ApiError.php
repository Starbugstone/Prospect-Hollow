<?php
declare(strict_types=1);
namespace App;
final class ApiError extends \RuntimeException {
    public function __construct(public readonly int $status, string $message, public readonly array $details=[]) { parent::__construct($message); }
}
