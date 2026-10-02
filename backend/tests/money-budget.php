<?php
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';
use App\{ApiError, MoneyBudget};

$count = 0;
$now = 1780000000000;
$observe = new MoneyBudget('observe');
$hold = new MoneyBudget('hold');
function assertMoney(bool $ok, string $message): void
{
    global $count;
    $count++;
    if (!$ok) {
        throw new RuntimeException($message);
    }
}
function moneyHold(callable $operation, string $label): void
{
    try {
        $operation();
    } catch (ApiError $error) {
        assertMoney(
            $error->status === 422 && ($error->details['code'] ?? null) === 'save_money_review',
            $label,
        );
        assertMoney(
            ($error->details['moneyBudget']['mode'] ?? null) === 'hold',
            'hold includes safe owner metadata',
        );
        return;
    }
    throw new RuntimeException($label . ' did not hold');
}
$baseline = $observe->reconcile(null, 0, $now);
assertMoney(
    $baseline['credit'] === 10000 && $baseline['debt'] === 0 && $baseline['highWater'] === 0,
    'baseline gets one initial allowance',
);
$boundary = $hold->reconcile($baseline, 10000, $now);
assertMoney(
    $boundary['credit'] == 0 && $boundary['lastCheck']['status'] === 'within_estimate',
    'exact boundary is allowed',
);
moneyHold(
    fn() => $hold->reconcile($baseline, 10001, $now),
    'one base coin past boundary needs review only in hold mode',
);
$review = $observe->reconcile($baseline, 10001, $now);
assertMoney(
    $review['debt'] == 1 && $review['lastCheck']['status'] === 'review',
    'observation preserves progress and tracks debt',
);
assertMoney(
    $review['reviewCount'] === 1 && $review['lastReview']['serverAt'] === $now,
    'new excessive source creates a durable review record',
);
$repeated = $observe->reconcile($review, 10001, $now);
assertMoney(
    $repeated['debt'] == 1 && $repeated['lastCheck']['newGrossCharge'] == 0,
    'rapid retry cannot forgive debt or renew burst',
);
assertMoney(
    $repeated['reviewCount'] === 1 && $repeated['lastReview'] === $review['lastReview'],
    'unchanged retry does not create another review record',
);
$further = $observe->reconcile($repeated, 10002, $now);
assertMoney($further['debt'] == 2, 'rapid new source consumes actual remaining credit');
$recovered = $observe->reconcile($further, 10002, $now + 1);
assertMoney($recovered['debt'] == 1, 'one server millisecond replenishes one base coin');
$paid = $observe->reconcile($recovered, 10002, $now + 1000);
assertMoney(
    $paid['debt'] == 0 &&
        $paid['lastCheck']['status'] === 'within_estimate' &&
        $paid['reviewCount'] === 2 &&
        $paid['lastReview'] === $further['lastReview'],
    'elapsed time pays debt without erasing previous review evidence',
);
$afterRestore = $observe->reconcile($paid, 0, $now + 1000);
assertMoney(
    $afterRestore['reviewCount'] === 2 && $afterRestore['lastReview'] === $further['lastReview'],
    'old branch restore preserves latest-town review record',
);
$backwards = $observe->reconcile($baseline, 0, $now - 5000);
assertMoney(
    $backwards['serverAt'] === $now &&
        $backwards['credit'] === 10000 &&
        $backwards['lastCheck']['elapsedMs'] === 0,
    'backwards time cannot mint allowance',
);
$negative = $observe->reconcile($baseline, 0, -1);
assertMoney(
    $negative['serverAt'] === $now && $negative['credit'] === 10000,
    'negative clock cannot reset server high-water',
);
$resumed = $observe->reconcile($backwards, 0, $now + 1000);
assertMoney($resumed['credit'] == 11000, 'clock recovery credits only previously uncounted time');
$active = $baseline;
for ($i = 1; $i <= 20; $i++) {
    $active = $hold->reconcile($active, 0, $now + $i * 1000);
}
$complete = $hold->reconcile($active, 25000, $now + 20000);
assertMoney(
    $complete['credit'] == 5000,
    'intermediate active-puzzle syncs retain unused allowance',
);
$offline = $hold->reconcile($baseline, 100000000, $now + 72 * 3600000);
assertMoney($offline['credit'] == 159210000, 'three offline days accrue without bucket cap');
$restored = $hold->reconcile($boundary, 0, $now);
assertMoney(
    $restored['credit'] == 0 && $restored['highWater'] == 10000,
    'old branch restore cannot reset latest town ledger',
);
$replay = $hold->reconcile($restored, 10000, $now);
assertMoney(
    $replay['credit'] == 0 && $replay['lastCheck']['newGrossCharge'] == 0,
    'known cumulative branch replay is not charged twice',
);
moneyHold(
    fn() => $hold->reconcile($replay, 10001, $now),
    'new gain past restored high-water consumes allowance',
);
$upgrade = $hold->reconcile(null, 20000, $now, $now - 10000);
assertMoney($upgrade['credit'] == 0, 'pre-guard upgrade uses trusted previous cloud time');
$_ENV['SAVE_MONEY_GUARD_MODE'] = 'hold';
moneyHold(
    fn() => (new MoneyBudget())->reconcile($baseline, 10001, $now),
    'server-only environment enables hold',
);
$_ENV['SAVE_MONEY_GUARD_MODE'] = 'anything-else';
assertMoney(
    (new MoneyBudget())->reconcile($baseline, 10001, $now)['lastCheck']['mode'] === 'observe',
    'unknown setting safely defaults to observation',
);
unset($_ENV['SAVE_MONEY_GUARD_MODE']);
echo "Money budget checks passed ($count assertions).\n";
