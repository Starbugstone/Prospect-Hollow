<?php
declare(strict_types=1);
require_once __DIR__.'/../src/ApiError.php';
require_once __DIR__.'/../src/Content.php';
require_once __DIR__.'/../src/TownService.php';
require_once __DIR__.'/../src/ProfileService.php';
use App\{ApiError,Content,TownService};
$content=new Content();$town=new TownService($content);$checks=0;
function check(bool $ok,string $message): void {global $checks;$checks++;if(!$ok)throw new RuntimeException($message);}
function denied(callable $fn,string $message): void {try{$fn();}catch(ApiError $e){check(in_array($e->status,[409,422],true),$message);return;}throw new RuntimeException('Accepted: '.$message);}
function runFor(int $level=1): array {return ['level'=>$level,'score'=>0,'maxCascade'=>0,'startedAt'=>time()-1000,'jewels'=>0,'board'=>[],'comboCounts'=>[],'multiMatchCounts'=>[]];}
$fixtures=json_decode(file_get_contents(__DIR__.'/../content/town-parity.json'),true,512,JSON_THROW_ON_ERROR);
check($fixtures['contentVersion']===$content->data['version'],'fixtures match catalog');
foreach($fixtures['towns'] as $fixture) {
 $p=$content->fresh();$p['town']=$fixture['town'];$p['firstStartUsed']=(bool)array_sum($p['town']['buildings']);
 [$population,$happiness]=$town->population($p['town']);
 check($population===$fixture['population'],$fixture['name'].' population');
 check($happiness===$fixture['happiness'],$fixture['name'].' happiness');
 check($town->incomeRate($p['town'])===$fixture['income'],$fixture['name'].' income');
 check($town->capacities($p['town'])===$fixture['capacities'],$fixture['name'].' capacities');
 foreach($fixture['offers'] as $id=>$expected) {
  try{$offer=$town->offer($p,$id);}catch(ApiError $e){check(!$expected || !$expected['available'],$fixture['name'].' unexpected rejection '.$id);continue;}
  check((bool)($expected['available']??false),$fixture['name'].' unavailable offer '.$id);
  foreach(['stage','cost','runs','type','targetEra','eraLevel','requiresPower'] as $key)check(($offer[$key]??null)===($expected[$key]??null),$fixture['name'].' '.$id.' '.$key.' '.json_encode([$offer[$key]??null,$expected[$key]??null]));
 }
}
foreach($fixtures['stars'] as $f)check($town->stars($f['score'],$f['target'],$f['combo'])===$f['expected'],'star formula');
foreach($fixtures['payouts'] as $f) {
 $run=runFor($f['level']);$run['jewels']=$f['jewels'];$run['board']=array_fill(0,$f['bonusGems'],['type'=>'bomb']);$run['comboCounts']=$f['comboCounts'];$run['multiMatchCounts']=$f['multiMatchCounts'];
 check($town->payout($run)===$f['expected'],'mining payout');
}
$p=$content->fresh();$first=$town->offer($p,'well');check($first['cost']===0 && $first['runs']===0,'first small building free and instant');
$town->action($p,'town.upgrade',['id'=>'well','stage'=>0]);check($p['town']['buildings']['well']===1,'instant build completed');
$p['town']['coins']=100000;$before=$p['town']['coins'];$town->action($p,'town.upgrade',['id'=>'well','stage'=>1]);
check(isset($p['town']['projects']['well']),'second stage needs work');check($p['town']['coins']<$before,'server debits quoted price');
denied(function()use($town,&$p){$town->action($p,'town.finish',['id'=>'well','stage'=>2]);},'premature finish');
for($i=0;$i<2;$i++)$town->victory($p,runFor(),'work-'.$i);
check($p['town']['buildings']['well']===1,'work does not auto-finish');$town->action($p,'town.finish',['id'=>'well','stage'=>2]);
check($p['town']['buildings']['well']===2,'explicit finish');
denied(function()use($town,&$p){$town->action($p,'town.finish',['id'=>'well','stage'=>2]);},'duplicate finish');
$p['builderHammers']=1;$before=$p['town']['coins'];$town->action($p,'town.hammer',['id'=>'well','stage'=>2]);
check($p['town']['coins']===$before && $p['builderHammers']===0 && $p['town']['buildings']['well']===3,'hammer instantaneous without coins');
foreach([null,[],['id'=>'well'],true,12] as $bad)foreach(['town.upgrade','town.hammer','town.finish'] as $type)denied(function()use($town,&$p,$bad,$type){$town->action($p,$type,['id'=>$bad,'stage'=>0]);},'malformed ID');
denied(function()use($town,&$p){$town->action($p,'town.upgrade',['id'=>'farm','stage'=>[]]);},'malformed stage');
denied(function()use($town,&$p){$town->action($p,'town.upgrade',['id'=>'farm','stage'=>0,'cost'=>0]);},'client price injection');
// Passive income never receives the new building rate retroactively and caps at eight hours.
$p=$content->fresh();$p['town']=$fixtures['towns'][2]['town'];$p['town']['income']=['at'=>1000,'stored'=>0,'remainder'=>0];$rate=$town->incomeRate($p['town']);
$town->accrue($p,1000+48*3600000);check($p['town']['income']['stored']===$rate*8,'eight hour cap');$snapshot=$p['town']['income'];$town->accrue($p,0);check($snapshot===$p['town']['income'],'clock rollback earns nothing');
// Shop upgrades append slots and retain sold receipts; replaying a buy cannot refill it.
$p=$content->fresh();$p['firstStartUsed']=true;$p['town']['coins']=100000;$p['town']['buildings']['shop']=1;
$town->victory($p,runFor(),'shop');check(count($p['shopStock'])===1,'stage one shop slot');$item=$p['shopStock'][0]['id'];$visit=$p['shopVisit'];
$town->action($p,'shop.buy',['id'=>$item,'visit'=>$visit]);check($p['shopStock'][0]['sold'],'sold receipt');
denied(function()use($town,&$p,$item,$visit){$town->action($p,'shop.buy',['id'=>$item,'visit'=>$visit]);},'repeat shop purchase');
$p['builderHammers']=1;$town->action($p,'town.hammer',['id'=>'shop','stage'=>1]);check(count($p['shopStock'])===2 && $p['shopStock'][0]['sold'],'shop expansion retains sold receipt');
$town->victory($p,runFor(),'shop-refresh');check(count($p['shopStock'])===2 && !array_filter($p['shopStock'],fn($s)=>$s['sold']),'victory refreshes stock');
// Rewards preserve current chapter gifts, rarity tiers, pity timer and full inventory behavior.
$p=$content->fresh();for($id=1;$id<=5;$id++)$p['records'][$id]=['score'=>1,'stars'=>1];$p['chestsWithoutBuilderHammer']=9;
$receipt=$town->victory($p,runFor(6),'chapter');check($receipt['chapterReward']['chapter']===1 && $receipt['chapterReward']['gift']['id']==='tnt','chapter gift');
check($receipt['chests'][0]['items'][0]['id']==='builder-hammer' && $receipt['chests'][0]['serverGranted'],'pity chest granted immediately');
check($town->victory($p,runFor(6),'chapter-replay')['chapterReward']===null,'chapter gift not repeated');
$p=$content->fresh();for($id=1;$id<=5;$id++)$p['records'][$id]=['score'=>1,'stars'=>1];foreach($p['powers'] as &$power)$power['quantity']=$town->capacity($p);unset($power);$p['builderHammers']=5;
$receipt=$town->victory($p,runFor(6),'full');check($receipt['chapterReward']['gift']['quantity']===100,'full chapter gift converts to chapter coins');check($receipt['chests'][0]['items'][0]['kind']==='coins','full chest selects coins');
check($content->data['chestCoins'][72]===3750,'latest tapered chest economy');
$p=$content->fresh();$r=runFor();$r['score']=$content->level(1)['chestTarget']*2;$r['startedAt']=time()-1;$receipt=$town->victory($p,$r,'fast');
check(count($receipt['chests'])===2 && $receipt['chests'][0]['id']==='fast-score' && $receipt['chests'][0]['id']!==$receipt['chests'][1]['id'],'score and speed chest identities');
check($receipt['chests'][0]['id'] && $receipt['chests'][0]['multiplier']===2 && $receipt['chests'][1]['timeMultiplier']===0.5,'score and speed tier parity');
$p=$content->fresh();$r=runFor();$r['startedAt']=time()-1;$receipt=$town->victory($p,$r,'speed-only');check(count($receipt['chests'])===1 && $receipt['chests'][0]['source']==='speed','speed chest replaces fallback below score target');
// Saved raid loss can never be refunded or changed by acknowledgment, new defenses or crafted calls.
$p=$content->fresh();$p['town']['coins']=1000;foreach(['well','farm','home'] as $id)$p['town']['buildings'][$id]=1;
$p['town']['nextRaidRun']=5;
for($i=1;$i<=4;$i++)$town->victory($p,runFor(),'raid-'.$i);check(!$p['town']['events'],'no raid before fifth victory');
$town->victory($p,runFor(),'raid-5');$event=$p['town']['events']['dusty-trail-visitors'];$balance=$p['town']['coins'];check($event['atRun']===5 && $event['loss']>0,'fifth victory settles raid');
$p['town']['buildings']['sheriff']=5;$town->action($p,'town.raid',[]);check($p['town']['coins']===$balance && $p['town']['events']['dusty-trail-visitors']===$event,'defense cannot rewrite outcome');
$town->action($p,'town.raid-seen',['id'=>$event['id']]);check($p['town']['coins']===$balance,'acknowledgment cannot grant or refund money');
denied(function()use($town,&$p,$event){$town->action($p,'town.raid-seen',['id'=>$event['id']]);},'repeated raid ack');
denied(function()use($town,&$p){$town->action($p,'town.bell',[]);},'bell cannot rewrite saved loss');
check($p['town']['nextRaidRun']===10,'fixed five victory cadence');
// A modified client must not suppress future economic events by withholding UI acknowledgments.
foreach(['frontier','river-rail','industrial','post-war','motor-age','aviation','broadcast','contemporary'] as $era) {
 $unseen=$content->fresh();$unseen['town']['era']=$era;$unseen['town']['coins']=10000;
 foreach(['well','farm','home','railDepot','powerHouse'] as $id)$unseen['town']['buildings'][$id]=1;
 $unseen['town']['nextRaidRun']=5;
 for($i=1;$i<=15;$i++) {
  $town->victory($unseen,runFor(),'unseen-'.$era.'-'.$i);
  if($i%5!==0)continue;
  $event=$unseen['town']['events']['dusty-trail-visitors'];
  check($event['atRun']===$i && $event['id']===intdiv($i,5),'unseen event cannot suppress cadence '.$era);
  check($event['loss']>0 && !$event['seen'],'unseen event still settles loss '.$era);
  check($unseen['town']['nextRaidRun']===$i+5,'next event remains scheduled '.$era);
  $balance=$unseen['town']['coins'];
  check($balance===$event['balance'],'event records settled balance '.$era);
  if($i>5)denied(function()use($town,&$unseen,$event){$town->action($unseen,'town.raid-seen',['id'=>$event['id']-1]);},'old acknowledgment cannot affect new encounter');
  check($unseen['town']['coins']===$balance,'stale acknowledgment cannot change balance '.$era);
 }
}

$p['town']['coins']=999999999;$town->grant($p,['id'=>'coins','kind'=>'coins','label'=>'Coins','quantity'=>1000]);check($p['town']['coins']===1000000000,'coin cap saturates');
// Every enabled era uses the same authored modernization price/stage/work sequence.
foreach(['river-rail','industrial','post-war','motor-age','aviation','broadcast','contemporary'] as $era) {
 $p=$content->fresh();$p['firstStartUsed']=true;$p['town']['era']=$era;$p['town']['coins']=100000;
 $p['town']['buildings']['well']=3;$p['town']['buildings']['powerHouse']=$era==='industrial'?1:0;
 for($level=1;$level<=3;$level++) {
  $offer=$town->offer($p,'well');$before=$p['town']['coins'];$town->action($p,'town.upgrade',['id'=>'well','stage'=>$offer['stage']]);
  check($p['town']['coins']===$before-$offer['cost'] && $p['town']['projects']['well']['eraLevel']===$level,'modernization quote '.$era);
  for($work=0;$work<$offer['runs'];$work++)$town->victory($p,runFor(),'modern-'.$era.'-'.$level.'-'.$work);
  $town->action($p,'town.finish',['id'=>'well','stage'=>$offer['stage']]);
  check($p['town']['buildings']['well']===3 && $p['town']['buildingEraLevels']['well']===$level && $p['town']['buildingEras']['well']===$era,'modernization benefits '.$era);
 }
 denied(function()use($town,$p){$town->offer($p,'well');},'max modernization');
}
$p=$content->fresh();$p['town']['era']='industrial';$p['town']['buildings']['well']=3;
denied(function()use($town,$p){$town->offer($p,'well');},'modernization requires actual power house');
// Advancing with an optional modernization would strand its old-era completion receipt.
$p=$content->fresh();foreach($content->data['buildings'] as $b)if($b['introducedEra']==='frontier')$p['town']['buildings'][$b['id']]=count($b['upgrades']);
$p['town']['projects']['horseField']=['id'=>'horseField','stage'=>1,'wins'=>0,'required'=>1];
denied(function()use($town,&$p){$town->action($p,'town.era',['era'=>'frontier']);},'optional construction blocks era');
unset($p['town']['projects']['horseField']);$town->action($p,'town.era',['era'=>'frontier']);check($p['town']['era']==='river-rail' && $p['town']['transition']['pending'],'completed town advances era');
// Arrival starts the five-win clock at the time population first exists.
$p=$content->fresh();$p['town']['buildings']['well']=1;$p['town']['buildings']['farm']=1;$p['town']['completedRuns']=12;$p['builderHammers']=1;$p['firstStartUsed']=true;
$town->action($p,'town.hammer',['id'=>'home','stage'=>0]);check($p['town']['nextRaidRun']===17,'arrival schedules five later victories');
foreach(['frontier','river-rail','industrial','post-war','motor-age','aviation','broadcast','contemporary'] as $era) {
 $p=$content->fresh();$p['town']['era']=$era;$p['town']['coins']=10000;
 foreach(['well','farm','home'] as $id)$p['town']['buildings'][$id]=1;
 $p['town']['buildings']['sheriff']=5;$p['town']['buildings']['bank']=5;$p['town']['buildings']['fireStation']=3;
 $p['town']['buildings']['railDepot']=1;$p['town']['buildings']['mill']=1;$p['town']['nextRaidRun']=1;
 $town->victory($p,runFor(),'protected-'.$era);$event=$p['town']['events']['dusty-trail-visitors'];
 check($event['loss']===0 && $event['outcome']==='protected','complete defenses protect '.$era);
 check($event['kind']===$content->data['eraEventKinds'][$era],'era event type '.$era);
}
check(count($content->data['levels'])===324 && count($content->data['buildings'])===54 && count(array_filter($content->data['eras'],fn($era)=>$era['enabled']))===8,'current main catalog scope');
check($content->data['chestCoins'][324]===4000 && $content->data['miningMultipliers'][324]===54,'last chapter capped chests and depth multiplier');
$full=array_values(array_filter($fixtures['towns'],fn($fixture)=>$fixture['name']==='contemporary-modern-3'))[0];
check($full['capacities']['food']===199 && $full['capacities']['water']===194 && $full['population']===188 && $full['happiness']===100,'full contemporary city authored totals');
// Each new city plot grants functional effects on completion, with no multiplication from visual tiers.
foreach($content->data['buildings'] as $building) {
 if(!isset($building['effects']))continue;
 $p=$content->fresh();$p['firstStartUsed']=true;$p['town']['era']=$building['introducedEra'];$p['town']['buildings']['bridge']=1;
 for($stage=0;$stage<3;$stage++) {
  $before=$town->capacities($p['town']);$p['builderHammers']=1;
  $town->action($p,'town.hammer',['id'=>$building['id'],'stage'=>$stage]);$after=$town->capacities($p['town']);
  foreach(['food','water','housing','visitors'] as $stat)check($after[$stat]-$before[$stat]===($building['effects'][$stat]??0),$building['id'].' completed '.$stat);
 }
 if($building['introducedEra']==='post-war') {
  $p['town']['era']='motor-age';$before=$town->capacities($p['town']);
  for($tier=0;$tier<3;$tier++) {$offer=$town->offer($p,$building['id']);$p['builderHammers']=1;$town->action($p,'town.hammer',['id'=>$building['id'],'stage'=>$offer['stage']]);check($town->capacities($p['town'])===$before,$building['id'].' visual modernization never multiplies capacity');}
 }
}
// Snapshot upgrade never changes old paid work, records or inserted-era progression.
$p=$content->fresh();$p['town']['era']='motor-age';$p['town']['coins']=6789;$p['records'][144]=['score'=>90000,'stars'=>3];
$p['town']['transition']=['id'=>'industrial:motor-age','from'=>'industrial','to'=>'motor-age','pending'=>true];
$p['town']['projects']['well']=['id'=>'well','type'=>'modernization','stage'=>3,'wins'=>1,'required'=>2,'fromEra'=>'industrial','targetEra'=>'motor-age','eraLevel'=>1,'cost'=>3500,'contentVersion'=>'previous-content'];
$p['town']['events']['dusty-trail-visitors']=['id'=>3,'outcome'=>'stolen','loss'=>7,'seen'=>false,'contentVersion'=>'previous-content'];
foreach($content->data['buildings'] as $building)if(isset($building['effects']))foreach(['buildings','buildingEras','buildingEraLevels'] as $key)unset($p['town'][$key][$building['id']]);
$old=$p;$p=$content->hydrate($p);
check($p['town']['era']==='motor-age' && $p['town']['transition']===$old['town']['transition'],'old Industrial to Motor transition retained');
check($p['town']['projects']===$old['town']['projects'] && $p['town']['events']===$old['town']['events'] && $p['records']===$old['records'] && $p['town']['coins']===$old['town']['coins'],'hydrate preserves paid progress and immutable receipts');
check(count($p['town']['buildings'])===54 && $p['town']['buildings']['waterPlant']===0 && $p['town']['buildingEras']['waterPlant']==='frontier','hydrate adds empty plots only');
check($content->hydrate($p)===$p,'hydrate idempotent');
// Contemporary storm settlement uses fire crews, never sheriff bounty or later client refunds.
foreach([0,1,2,3] as $fireLevel) {
 $p=$content->fresh();$p['town']['era']='contemporary';$p['town']['coins']=10000;
 foreach(['well','farm','home','riverPark'] as $id)$p['town']['buildings'][$id]=1;
 $p['town']['buildings']['fireStation']=$fireLevel;$p['town']['nextRaidRun']=1;
 $town->victory($p,runFor(),'storm-'.$fireLevel);$event=$p['town']['events']['dusty-trail-visitors'];$balance=$p['town']['coins'];
 check($event['kind']==='storm-cleanup' && $event['targets']===['riverPark'] && $event['fireStationLevel']===$fireLevel,'saved storm target and defense');
 check($event['loss']===[10,4,2,0][$fireLevel],'storm fire-crew protection');
 $p['town']['buildings']['fireStation']=3;$town->action($p,'town.raid-seen',['id'=>$event['id']]);
 check($p['town']['coins']===$balance && $p['town']['events']['dusty-trail-visitors']['loss']===$event['loss'],'storm remains immutable after upgraded fire station and ack');
}
// Construction queues a durable scene once; acknowledging it cannot change the economy.
$p=$content->fresh();$p['town']['era']='river-rail';$p['town']['buildings']['bridge']=1;$p['builderHammers']=2;
$town->action($p,'town.hammer',['id'=>'railDepot','stage'=>0]);
check($p['town']['presentations']['railway-opening']==='pending','railway completion queues presentation');
$balance=$p['town']['coins'];$town->action($p,'town.presentation-seen',['id'=>'railway-opening']);
check($p['town']['presentations']['railway-opening']==='seen'&&$p['town']['coins']===$balance,'presentation acknowledgment preserves economy');
denied(function()use($town,&$p){$town->action($p,'town.presentation-seen',['id'=>'railway-opening']);},'duplicate presentation acknowledgment');
denied(function()use($town,&$p){$town->action($p,'town.presentation-seen',['id'=>[]]);},'malformed presentation ID');
$town->action($p,'town.hammer',['id'=>'railDepot','stage'=>1]);
check($p['town']['presentations']['railway-opening']==='seen','later upgrade cannot replay opening');
echo "Town rules: $checks checks passed.\n";
