<?php
declare(strict_types=1);
require_once __DIR__.'/../src/ApiError.php';
require_once __DIR__.'/../src/PuzzleEngine.php';
require_once __DIR__.'/../src/Content.php';
use App\PuzzleEngine;
function check(bool $condition,string $message): void { if(!$condition)throw new RuntimeException($message); }
function deterministic(): PuzzleEngine {
    $seed=793;return new PuzzleEngine(function(int $max) use(&$seed):int {$seed=$seed*16807%2147483647;return (int)floor((($seed-1)/2147483646)*$max);});
}
function boardTypes(array $board): array {return array_map(fn($g)=>$g['type']??null,$board);}
$content=new App\Content();$engine=new PuzzleEngine();
foreach($content->data['levels'] as $level) {
    $state=$engine->initial($level,'normal');
    check(!$engine->matches($state['board'],$state['cols'],$state['rows']),'Initial board contains a match: '.$level['id']);
    check($engine->hasMove($state),'Initial level is not playable: '.$level['id']);
}
// Independent JavaScript oracles cover every authored level and all six fusion pairs.
$script=dirname(__DIR__,2).'/scripts/puzzle-fixtures.mjs';
$fixturePath=$argv[1]??null;
if($fixturePath) $json=file_get_contents($fixturePath);
else {
    $output=[];$exit=0;exec('node '.escapeshellarg($script),$output,$exit);
    check($exit===0,'JavaScript fixture generator failed');$json=implode("\n",$output);
}
$fixtures=json_decode($json,true,512,JSON_THROW_ON_ERROR);$resolutions=0;
foreach($fixtures as $fixture) {
    $engine=deterministic();$l=$fixture['level'];$name=$fixture['name'];
    $actual=$engine->evaluate($l['board'],$l['tiles'],$l['boardCols'],$l['boardRows'],$fixture['a'],$fixture['b'],$fixture['activate']);
    $actualMatches=array_map(fn($m)=>array_intersect_key($m,array_flip(['type','indices','orientation'])),$actual['matches']);
    check(boardTypes($actual['board'])===$fixture['expected']['board'],"$name: swapped board mismatch");
    check($actualMatches===$fixture['expected']['matches'],"$name: match detection mismatch");
    check($actual['bonuses']==$fixture['expected']['bonuses'],"$name: bonus creation mismatch");
    if($fixture['resolution']) {
        $resolutions++;$state=$engine->initial($l,'normal');$engine->resolve($state,$actual);$expected=$fixture['resolution'];
        check(boardTypes($state['board'])===$expected['board'],"$name: resolved board mismatch");
        check($state['tiles']===$expected['tiles'],"$name: tile damage mismatch");
        check($state['oreOrders']===$expected['oreOrders'],"$name: ore objective mismatch");
        check(array_sum(array_map(fn($t)=>($t['health']??0)+($t['chainHealth']??0)+($t['signalHealth']??0),$state['tiles']))===$expected['remainingLayers'],"$name: layer count mismatch");
        check($state['score']===$expected['score'],"$name: scoring mismatch");
        check($state['jewels']===$expected['jewels'],"$name: jewel collection mismatch");
        check($state['remainingRelics']===$expected['remainingRelics'],"$name: relic collection mismatch");
        check(array_column($state['steps'],'cleared')===$expected['clears'],"$name: cascade clears mismatch");
    }
}
// Rejected inputs cannot mutate any part of the supplied authoritative state.
$engine=new PuzzleEngine();$s=$engine->initial($content->level(1),'normal');$before=$s;
foreach([[-1,0,false],[0,0,false],[0,8,false],[0,0,true]] as [$a,$b,$activate]) {
    try{$engine->move($s,$a,$b,$activate);throw new RuntimeException('Illegal move accepted');}catch(App\ApiError $e){check($e->status===422,'Unexpected error');}
    check($s===$before,'Rejected move mutated the run');
}
$anchored=$before;$anchored['tiles'][0]['chainHealth']=1;$anchored['board'][0]['type']='bomb';
check(!$engine->evaluate($anchored['board'],$anchored['tiles'],$anchored['cols'],$anchored['rows'],0,0,true)['matches'],'Chained bonus activated');
$anchored['tiles'][0]=['state'=>'FROZEN','type'=>'standard','health'=>1];
check(!$engine->evaluate($anchored['board'],$anchored['tiles'],$anchored['cols'],$anchored['rows'],0,1)['matches'],'Frozen gem swapped');
// Automatic shuffles must preserve movable gems and never damage tiles or grant scores.
$s=$before;$oldTypes=boardTypes($s['board']);sort($oldTypes);$engine->shuffle($s);$newTypes=boardTypes($s['board']);sort($newTypes);
check($oldTypes===$newTypes&&$s['tiles']===$before['tiles']&&$s['score']===0&&$s['jewels']===0,'Shuffle altered rewards or tiles');
check(!$engine->matches($s['board'],$s['cols'],$s['rows'])&&$engine->hasMove($s),'Shuffle is not settled and playable');
// Optional speed targets and move statistics never end a mine with outstanding ore.
$s=$engine->initial($content->level(241),'normal');
foreach($s['tiles'] as &$tile){$tile['health']=0;$tile['chainHealth']=0;$tile['signalHealth']=0;}unset($tile);
$s['remainingRelics']=0;$s['oreOrders']=[['color'=>'ruby','target'=>100000,'progress'=>0]];
$s['moves']=1000;$s['startedAt']=time()-3600;
$engine->power($s,'shuffle',null);
check(!$s['cleared']&&$s['status']==='active','Ore objectives cannot be skipped by clearing tile layers or passing a speed target');
$s['oreOrders'][0]['progress']=100000;$engine->power($s,'shuffle',null);
check($s['cleared'],'All objectives permit completion beyond 1000 moves');
echo 'Puzzle checks passed: '.count($content->data['levels']).' playable levels, '.count($fixtures).' JS parity evaluations, '.$resolutions." full cascade parity resolutions and mutation guards.\n";
