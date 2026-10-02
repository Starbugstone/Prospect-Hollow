<?php
declare(strict_types=1);
namespace App;

/** A deliberately generous plausibility estimate, never proof of puzzle play. */
final class MoneyBudget
{
    public const INITIAL_CREDIT = 10000;
    public const CREDIT_PER_SECOND = 1000;
    private const EPSILON = 0.000001;
    private string $mode;

    public function __construct(?string $mode = null)
    {
        $this->mode = ($mode ?? Env::get('SAVE_MONEY_GUARD_MODE')) === 'hold' ? 'hold' : 'observe';
    }
    public static function initial(int $now): array
    {
        return [
            'version' => 1,
            'serverAt' => max(0, $now),
            'credit' => self::INITIAL_CREDIT,
            'debt' => 0,
            'highWater' => 0,
            'reviewCount' => 0,
            'lastReview' => null,
        ];
    }
    /** Only the latest database ledger is authoritative, including during recovery. */
    public function reconcile(
        ?array $latest,
        float $branchGross,
        int $now,
        ?int $previousServerAt = null,
        array $sources = [],
    ): array {
        $ledger = $latest ?? self::initial($previousServerAt ?? $now);
        $previousAt = $ledger['serverAt'];
        $elapsed = max(0, max(0, $now) - $previousAt);
        $replenished = ($elapsed / 1000) * self::CREDIT_PER_SECOND;
        $charge = max(0, $branchGross - $ledger['highWater']);
        $allowance = $ledger['credit'] - $ledger['debt'] + $replenished;
        $remaining = $allowance - $charge;
        if (abs($remaining) < self::EPSILON) {
            $remaining = 0;
        }
        $check = [
            'version' => 1,
            'mode' => $this->mode,
            'status' => $remaining < 0 ? 'review' : 'within_estimate',
            'previousServerAt' => $previousAt,
            'serverAt' => max(0, $now),
            'elapsedMs' => $elapsed,
            'carriedCredit' => $ledger['credit'],
            'carriedDebt' => $ledger['debt'],
            'replenished' => $replenished,
            'newGrossCharge' => $charge,
            'estimatedAllowance' => $allowance,
            'debt' => max(0, -$remaining),
            'newMintedCoins' => $sources['mintedCoins'] ?? 0,
            'newReservedCoins' => $sources['reservedCoins'] ?? 0,
            'maxMultiplier' => $sources['maxMultiplier'] ?? 1,
        ];
        if ($remaining < 0 && $this->mode === 'hold') {
            throw new ApiError(
                422,
                'This cloud update needs a money review. Your local progress and the last cloud save are safe.',
                ['code' => 'save_money_review', 'moneyBudget' => $check],
            );
        }
        $newReview = $remaining < 0 && $charge > self::EPSILON;
        return [
            'version' => 1,
            'serverAt' => max($previousAt, max(0, $now)),
            'credit' => max(0, $remaining),
            'debt' => max(0, -$remaining),
            'highWater' => max($ledger['highWater'], $branchGross),
            'lastCheck' => $check,
            'reviewCount' => ($ledger['reviewCount'] ?? 0) + (int) $newReview,
            'lastReview' => $newReview ? $check : $ledger['lastReview'] ?? null,
        ];
    }
}
