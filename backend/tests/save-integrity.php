<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use App\{ApiError,SaveIntegrity,SaveService};
$_ENV['APP_SECRET']=str_repeat('integrity-test-secret-',3);

$rules=json_decode(file_get_contents(dirname(__DIR__).'/content/save-rules.json'),true,64,JSON_THROW_ON_ERROR);
$validator=new SaveIntegrity();$count=0;$now=1780000000000;
function assertIntegrity(bool $ok,string $message): void {global $count;$count++;if(!$ok)throw new RuntimeException($message);}
function integrityObject(array $data): object {return json_decode(json_encode($data,JSON_THROW_ON_ERROR),false,64,JSON_THROW_ON_ERROR);}
function integrityData(object $data): array {return json_decode(json_encode($data,JSON_THROW_ON_ERROR),true,64,JSON_THROW_ON_ERROR);}
function integrityDenied(callable $operation,string $code,string $label): void {
    try {$operation();}catch(ApiError $error){assertIntegrity($error->status===422&&($error->details['code']??null)===$code,$label.' gives recoverable '.$code);return;}
    throw new RuntimeException($label.' was accepted');
}
function integrityUuid(int $n): string {return '11111111-1111-4111-8111-'.str_pad((string)$n,12,'0',STR_PAD_LEFT);}
function integrityAction(int $n,string $kind,array $data): array {return ['sequence'=>$n,'id'=>integrityUuid($n+1),'kind'=>$kind,'data'=>$data];}
function integrityProfile(array $rules,int $now): object {
    $profile=$rules['defaultProfile'];$profile['integrity']=['version'=>1,'epoch'=>integrityUuid(1),'baseSequence'=>0,'actions'=>[],'clientAt'=>$now];return integrityObject($profile);
}
$before=integrityProfile($rules,$now);$baseline=$validator->accept($before,null,$now);
assertIntegrity($baseline->records instanceof stdClass&&$baseline->continuousRecords instanceof stdClass,'sealed empty record maps retain JSON object shape');
foreach(['buildings','buildingEras','buildingEraLevels','projects','events','lastCollections'] as $key)assertIntegrity($baseline->town->$key instanceof stdClass,'sealed town '.$key.' retains JSON object shape');
assertIntegrity(is_array($baseline->powers)&&is_array($baseline->pendingChests)&&is_array($baseline->shopStock)&&is_array($baseline->integrity->actions),'sealed list fields retain JSON array shape');
$rawDownload=json_decode(SaveService::profile($baseline),false,64,JSON_THROW_ON_ERROR);
assertIntegrity($validator->accept($rawDownload,$baseline,$now)->town->coins===$baseline->town->coins,'untouched downloaded sealed profile passes upload structure and ordinary roundtrip');
assertIntegrity(array_diff_key(SaveIntegrity::receipt($baseline),['checkpoint'=>true,'moneyBudget'=>true])===['version'=>1,'epoch'=>integrityUuid(1),'ackSequence'=>0,'status'=>'baseline'],'historical baseline is explicitly unverified');
assertIntegrity(SaveIntegrity::receipt($validator->accept($baseline,$baseline,$now))['status']==='tracked','unchanged tracked checkpoint');
$legacy=integrityData($before);unset($legacy['integrity']);$legacy['town']['coins']=9000000;
assertIntegrity(!isset($validator->accept(integrityObject($legacy),null,$now)->integrity),'older local/cloud profiles retain migration compatibility');
$forged=integrityData($baseline);$forged['town']['coins']=9000000;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_mismatch','direct coin injection');
$forged=integrityData($baseline);$forged['powers'][0]['quantity']=1;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_mismatch','direct item injection');
$forged=integrityData($baseline);$forged['town']['buildings']['well']=1;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_mismatch','direct level injection');
$forged=integrityData($baseline);unset($forged['integrity']);
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_mismatch','deleting journal is not a new migration');
$forged=integrityData($baseline);$forged['integrity']['epoch']=integrityUuid(999);
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_mismatch','changing epoch is not a new migration');
$forged=integrityData($baseline);$forged['town']['coins']=1.5;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_invalid','fractional currency');
$forged=integrityData($baseline);$forged['town']['buildings']['well']=$rules['buildings']['well']['maxLevel']+1;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_integrity_invalid','impossible current building stage');
$legacy=integrityData($baseline);unset($legacy['town']['progressionVersion']);$legacy['town']['buildings']['well']=5;
assertIntegrity($validator->accept(integrityObject($legacy),null,$now)->town->buildings->well===5,'legacy support tiers remain usable before normalized migration');
$forged=integrityData($baseline);$forged['town']['buildings']['unreleased-plot']=1;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$baseline,$now),'save_rules_unsupported','unknown catalog data needs compatible rules');
integrityDenied(fn()=>(new SaveIntegrity([]))->accept($before,null,$now),'save_rules_unsupported','incomplete server catalog safely holds sync');
$purchase=integrityData($before);$purchase['town']['buildings']['well']=1;$purchase['town']['income']['at']=$now;
$purchase['integrity']['actions']=[integrityAction(1,'building-buy',['buildingId'=>'well','expectedStage'=>0,'at'=>$now])];
$bought=$validator->accept(integrityObject($purchase),$baseline,$now);
assertIntegrity($bought->town->coins===0&&SaveIntegrity::receipt($bought)['ackSequence']===1,'first actual building purchase is free and acknowledged');
assertIntegrity(SaveIntegrity::receipt($validator->accept(integrityObject($purchase),$bought,$now))['ackSequence']===1,'already acknowledged action cannot apply twice');
$forged=$purchase;$forged['town']['coins']=100;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now),'save_integrity_mismatch','repeated action cannot authorize new money');
$forged=integrityData($bought);$forged['integrity']['actions']=[integrityAction(3,'power-spend',['itemId'=>'tnt'])];
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now),'save_integrity_invalid','journal gaps are not new receipts');
$forged=integrityData($bought);$forged['town']['income']['at']=$now+86400000;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now),'save_clock_mismatch','future reserve checkpoint uses anchored server time');
$forged=integrityData($bought);$forged['integrity']['clientAt']=$now+86400000;$forged['town']['income']['at']=$now+86400000;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now),'save_clock_mismatch','clientAt cannot reset established server time');
$restored=$validator->accept($baseline,$bought,$now,true,[$baseline]);
assertIntegrity($restored->town->buildings->well===0,'an exact known historical state remains restorable');
$restored=$validator->accept($baseline,$bought,$now,true);
assertIntegrity($restored->town->buildings->well===0&&SaveIntegrity::receipt($restored)['ackSequence']===0,'signed backup restores without retaining database history');
$rawRestored=json_decode(SaveService::profile($restored),false,64,JSON_THROW_ON_ERROR);
assertIntegrity($validator->accept($rawRestored,$restored,$now)->town->buildings->well===0,'untouched signed restored backup passes upload structure and roundtrip');
$offline=$purchase;$offline['integrity']['checkpoint']=$baseline->integrity->checkpoint;
$continued=$validator->accept(integrityObject($offline),$bought,$now,true);
assertIntegrity($continued->town->buildings->well===1&&SaveIntegrity::receipt($continued)['ackSequence']===1,'signed old checkpoint authenticates an offline action branch');
$forged=integrityData($baseline);$token=$forged['integrity']['checkpoint'];$forged['integrity']['checkpoint']=($token[0]==='a'?'b':'a').substr($token,1);
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now,true),'save_integrity_mismatch','edited checkpoint cannot authenticate a restore');
$forged=integrityData($baseline);$forged['town']['coins']=500;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now,true),'save_integrity_mismatch','signed checkpoint does not authenticate changed snapshot totals');
$scoped=$validator->accept($before,null,$now,false,[],'first-town');$another=$validator->accept($before,null,$now,false,[],'second-town');
integrityDenied(fn()=>$validator->accept($scoped,$another,$now,true,[],'second-town'),'save_integrity_mismatch','checkpoint cannot move between cloud towns');
$malformed=[
    ['town','buildingEras','well',[]],
    ['town','projects','well',[]],
    ['town','forge','progress',[]],
];
foreach($malformed as [$top,$group,$key,$value]) {
    $bad=integrityData($baseline);$bad[$top][$group][$key]=$value;
    integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_invalid','malformed '.$top.'.'.$group.'.'.$key);
}
$bad=integrityData($baseline);$bad['pendingChests']=[['id'=>'1-score','runId'=>1,'source'=>'score','levelId'=>[],'items'=>42]];$bad['issuedRun']=$bad['settledRun']=1;
integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_invalid','malformed pending chest');
$bad=integrityData($baseline);$bad['integrity']['actions']=[integrityAction(1,'building-buy',['buildingId'=>[],'expectedStage'=>0,'at'=>$now])];
integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_mismatch','malformed command ID');
$bad=integrityData($baseline);$bad['integrity']['actions']=[integrityAction(1,'reward-grant',['reward'=>['id'=>'coins','kind'=>'coins','quantity'=>999999]])];
integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_rules_unsupported','diagnostic arbitrary reward API is not a production source');
$bad=integrityData($baseline);$bad['integrity']['version']=2;
integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_unsupported','future journal version holds sync until compatible');
foreach(['lastCollections','projects','buildingEras','buildingEraLevels','forge','income','events'] as $key)foreach([null,3,'bad',true] as $value) {
    $bad=integrityData($baseline);$bad['town'][$key]=$value;
    integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_invalid','malformed town.'.$key.' does not throw a server error');
}
foreach(['pendingChests','shopStock','vipReceipts','issuedRun','settledRun','builderHammers','chestsWithoutBuilderHammer'] as $key) {
    $bad=integrityData($baseline);$bad[$key]=null;
    integrityDenied(fn()=>$validator->accept(integrityObject($bad),$baseline,$now),'save_integrity_invalid','null '.$key.' does not throw a server error');
}
$midRun=integrityData($before);$midRun['town']['buildings']['museum']=1;$midRun['issuedRun']=1;$midRun['records'][1]=['score'=>100,'stars'=>1];$midRun['continuousRecords'][1]=['coins'=>3,'score'=>300];$midRun['town']['coins']=3;
$midRun['integrity']['actions']=[integrityAction(1,'run-start',['runId'=>1,'mode'=>'continuous','levelId'=>1]),integrityAction(2,'continuous',['runId'=>1,'levelId'=>1,'jewels'=>30,'score'=>300])];
$midAnchor=$validator->accept(integrityObject($midRun),null,$now);$continued=integrityData($midAnchor);$continued['town']['coins']=5;$continued['continuousRecords'][1]=['coins'=>5,'score'=>500];$continued['integrity']['actions']=[integrityAction(3,'continuous',['runId'=>1,'levelId'=>1,'jewels'=>50,'score'=>500])];
assertIntegrity($validator->accept(integrityObject($continued),$midAnchor,$now)->town->coins===5,'enrolling mid-continuous puzzle preserves already credited amounts and run context');
$wrongClock=integrityData($before);$wrongClock['integrity']['clientAt']=$now+86400000;$wrongAnchor=$validator->accept(integrityObject($wrongClock),null,$now);$wrongPurchase=$purchase;$wrongPurchase['town']['income']['at']=$now+86400000;$wrongPurchase['integrity']['actions'][0]['data']['at']=$now+86400000;
assertIntegrity($validator->accept(integrityObject($wrongPurchase),$wrongAnchor,$now)->town->buildings->well===1,'stable wrong-clock device uses its original server-time offset');
$large=integrityData($before);$large['extra']=str_repeat('x',1048576-strlen(json_encode($large))-300);
assertIntegrity(strlen(json_encode($large))<1048576,'large input fixture starts below existing save limit');
try {$validator->accept(integrityObject($large),null,$now);throw new RuntimeException('sealed snapshot exceeded its size limit');}catch(ApiError $error){assertIntegrity($error->status===413,'added recovery checkpoint respects final save size limit');}
$historical=integrityData($before);unset($historical['integrity']);$historical['town']['coins']=100;$historical['powers'][0]['quantity']=7;$historical['builderHammers']=8;
$migrated=$historical;$migrated['powers'][0]['quantity']=3;$migrated['builderHammers']=5;$migrated['town']['coins']=170;$migrated['integrity']=['version'=>1,'epoch'=>integrityUuid(777),'baseSequence'=>0,'actions'=>[],'clientAt'=>$now];
assertIntegrity($validator->accept(integrityObject($migrated),$baseline,$now,true,[integrityObject($historical)])->town->coins===170,'known legacy inventory overflow converts once during verified historical recovery');
$historical=integrityData($before);unset($historical['integrity'],$historical['town']['progressionVersion']);$historical['town']['coins']=100;$historical['town']['buildings']['well']=3;$historical['town']['projects']['well']=['id'=>'well','stage'=>4,'required'=>1,'wins'=>0];
$migrated=$historical;$migrated['town']['projects']=[];$migrated['town']['progressionVersion']=1;$migrated['town']['coins']=100+$rules['buildings']['well']['legacyUpgradeCosts'][3];$migrated['integrity']=['version'=>1,'epoch'=>integrityUuid(778),'baseSequence'=>0,'actions'=>[],'clientAt'=>$now];
assertIntegrity($validator->accept(integrityObject($migrated),$baseline,$now,true,[integrityObject($historical)])->town->coins===$migrated['town']['coins'],'known already paid redundant legacy stage refunds once during recovery');
$extended=$rules;$lastEra=end($rules['eraOrder']);$extended['eraOrder'][]='orbital';$extended['eras']['orbital']=$rules['eras'][$lastEra];$extendedValidator=new SaveIntegrity($extended);
$future=integrityData($before);$future['town']['era']=$lastEra;
foreach($rules['buildings'] as $id=>$definition){$future['town']['buildings'][$id]=$definition['maxLevel'];$future['town']['buildingEras'][$id]=$lastEra;$future['town']['buildingEraLevels'][$id]=$rules['eraBuildingLevels'];}
$futureAnchor=$extendedValidator->accept(integrityObject($future),null,$now);$next=$future;$next['town']['era']='orbital';$next['integrity']['actions']=[integrityAction(1,'era-advance',['expectedEra'=>$lastEra,'at'=>$now])];
assertIntegrity($extendedValidator->accept(integrityObject($next),$futureAnchor,$now)->town->era==='orbital','server era lifecycle extends from one authoritative catalog without a hardcoded chronological list');
$incomplete=$extended;unset($incomplete['eras']['orbital']['buildingOffers']);
integrityDenied(fn()=>(new SaveIntegrity($incomplete))->accept(integrityObject($next),null,$now),'save_rules_unsupported','incomplete future era definition safely holds sync');
$forged=integrityData($baseline);$forged['integrity']['epoch']=integrityUuid(999);$forged['town']['coins']=123456;
integrityDenied(fn()=>$validator->accept(integrityObject($forged),$bought,$now,true,[$baseline]),'save_integrity_mismatch','resolve cannot introduce invented historical money');

$fixturesPath=__DIR__.'/fixtures/integrity-flows.json';
if(!is_file($fixturesPath))throw new RuntimeException('Generate frontend integrity parity fixtures before checking this release.');
$fixtures=json_decode(file_get_contents($fixturesPath),false,64,JSON_THROW_ON_ERROR);
foreach($fixtures->fixtures as $fixture) {
    $clock=$fixture->serverNow;$starting=$validator->accept($fixture->before,null,$fixture->baselineServerNow??$clock);
    try {$result=$validator->accept($fixture->after,$starting,$clock);}catch(ApiError $error){throw new RuntimeException($fixture->name.': '.$error->getMessage().' '.json_encode($error->details),0,$error);}
    assertIntegrity(SaveIntegrity::receipt($result)['status']==='tracked',$fixture->name.' follows actual frontend rules');
    $forged=integrityData($fixture->after);$forged['town']['coins']++;
    integrityDenied(fn()=>$validator->accept(integrityObject($forged),$starting,$clock),'save_integrity_mismatch',$fixture->name.' cannot hide an extra coin in a legitimate batch');
    if($fixture->name==='victory after 175 moves and an expired speed target') {
        $middle=integrityData($fixture->before);$firstAction=integrityData($fixture->after)['integrity']['actions'][0];$middle['issuedRun']=$firstAction['data']['runId'];$middle['integrity']['actions']=[$firstAction];$enrolled=$validator->accept(integrityObject($middle),null,$clock);
        assertIntegrity($validator->accept($fixture->after,$enrolled,$clock)->settledRun===$firstAction['data']['runId'],'enrolling mid-normal puzzle preserves completion and unlimited moves');
    }
}

// A signed older checkpoint authenticates the economic branch, while an archived
// complete target tuple identifies the actual old board's reward thresholds.
// Changing the latest board must not invalidate a legitimate offline completion.
$oldBoard=$fixtures->fixtures[0];$played=integrityData($oldBoard->after);$victoryIndex=null;
foreach($played['integrity']['actions'] as $index=>$action)if($action['kind']==='victory'){$victoryIndex=$index;break;}
if($victoryIndex===null)throw new RuntimeException('The frontend parity fixture needs an actual victory receipt.');
$claim=$played['integrity']['actions'][$victoryIndex]['data'];$level=$claim['levelId'];
$oldTargets=['chestTarget'=>$claim['target'],'starScoreTarget'=>$claim['starTarget'],'speedTargetMs'=>$claim['speedTargetMs']];
$oldRules=$rules;$oldRules['levels'][$level]=array_replace($oldRules['levels'][$level],$oldTargets);unset($oldRules['levels'][$level]['compatibleTargets']);
$oldValidator=new SaveIntegrity($oldRules);$scope='threshold-migration-town';$oldCheckpoint=$oldValidator->accept($oldBoard->before,null,$oldBoard->serverNow,false,[],$scope);
$played['integrity']['checkpoint']=$oldCheckpoint->integrity->checkpoint;
$changedRules=$oldRules;$changedRules['levels'][$level]['chestTarget']=$claim['score']+1;$changedRules['levels'][$level]['starScoreTarget']=$claim['score']+1;$changedRules['levels'][$level]['speedTargetMs']=$claim['elapsedMs']+1;
$changedValidator=new SaveIntegrity($changedRules);$newCheckpoint=$changedValidator->accept($oldCheckpoint,$oldCheckpoint,$oldBoard->serverNow,false,[],$scope);
integrityDenied(fn()=>$changedValidator->accept(integrityObject($played),$newCheckpoint,$oldBoard->serverNow,true,[],$scope),'save_integrity_mismatch','unregistered changed targets would hold an otherwise legitimate old board');
$changedRules['levels'][$level]['compatibleTargets']=[$oldTargets];$compatibleValidator=new SaveIntegrity($changedRules);
$completed=$compatibleValidator->accept(integrityObject($played),$newCheckpoint,$oldBoard->serverNow,true,[],$scope);
assertIntegrity($completed->records->$level->stars===$oldBoard->after->records->$level->stars&&$completed->town->coins===$oldBoard->after->town->coins,'signed old offline completion keeps its earned stars and rewards across raised board thresholds');
assertIntegrity(SaveIntegrity::receipt($completed)['ackSequence']===$played['integrity']['baseSequence']+count($played['integrity']['actions']),'compatible historical board receipts advance their existing journal normally');
$invented=$played;foreach(['target','starTarget','speedTargetMs'] as $field)$invented['integrity']['actions'][$victoryIndex]['data'][$field]=1;
integrityDenied(fn()=>$compatibleValidator->accept(integrityObject($invented),$newCheckpoint,$oldBoard->serverNow,true,[],$scope),'save_integrity_mismatch','invented lower targets cannot become reward rules');
$mixed=$played;$mixed['integrity']['actions'][$victoryIndex]['data']['speedTargetMs']=1;
integrityDenied(fn()=>$compatibleValidator->accept(integrityObject($mixed),$newCheckpoint,$oldBoard->serverNow,true,[],$scope),'save_integrity_mismatch','matching two archived target values cannot authorize a mixed threshold tuple');
$current=$played;foreach(['target','starTarget','speedTargetMs'] as $field)unset($current['integrity']['actions'][$victoryIndex]['data'][$field]);
assertIntegrity($oldValidator->accept(integrityObject($current),$oldCheckpoint,$oldBoard->serverNow,false,[],$scope)->town->coins===$oldBoard->after->town->coins,'older receipts without declared targets retain the current-rule fallback');
$invalidHistory=$changedRules;$invalidHistory['levels'][$level]['compatibleTargets']=[['chestTarget'=>1,'starScoreTarget'=>1,'speedTargetMs'=>[]]];
integrityDenied(fn()=>(new SaveIntegrity($invalidHistory))->accept($oldBoard->before,null,$oldBoard->serverNow),'save_rules_unsupported','incomplete authoritative target history safely holds sync');

// Use a captured real frontend completion, changing only its claimed mining
// quantity. This tests the boundary after full semantic/economic replay.
function integrityMining(object $fixture,int $jewels): object {
    $after=integrityData($fixture->after);
    foreach($after['integrity']['actions'] as &$action)if($action['kind']==='victory') {
        $after['town']['coins']+=$jewels-$action['data']['jewels'];$action['data']['jewels']=$jewels;
    }
    return integrityObject($after);
}
function integrityPreGuard(object $checkpoint): object {
    $profile=integrityData($checkpoint);unset($profile['integrity']['context']['moneyBudget'],$profile['integrity']['context']['moneyGross']);
    [$body]=explode('.',$profile['integrity']['checkpoint']);
    $payload=json_decode(gzuncompress(base64_decode(strtr($body,'-_','+/'))),true,64,JSON_THROW_ON_ERROR);
    unset($payload['context']['moneyBudget'],$payload['context']['moneyGross']);
    $body=rtrim(strtr(base64_encode(gzcompress(json_encode($payload,JSON_THROW_ON_ERROR),6)),'+/','-_'),'=');
    $profile['integrity']['checkpoint']=$body.'.'.hash_hmac('sha256','prospect-hollow:save-checkpoint:v1:'.$body,$_ENV['APP_SECRET']);
    return integrityObject($profile);
}
$moneyScope='money-budget-town';$moneyFixture=$fixtures->fixtures[0];$moneyClock=$moneyFixture->serverNow;
$moneyAnchor=$validator->accept($moneyFixture->before,null,$moneyClock,false,[],$moneyScope);
$coinBase=$rules['levels'][1]['chestCoins'][$rules['rewards']['chestEconomyVersion']];$reserved=(int)floor($coinBase*1.5+0.5);
$exact=integrityMining($moneyFixture,10000-$reserved);$tooMuch=integrityMining($moneyFixture,10001-$reserved);
$_ENV['SAVE_MONEY_GUARD_MODE']='hold';
$exactResult=$validator->accept($exact,$moneyAnchor,$moneyClock,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($exactResult)['moneyBudget']['newGrossCharge']==10000,'full replay accepts exact mining plus chest-entitlement boundary');
integrityDenied(fn()=>$validator->accept($tooMuch,$moneyAnchor,$moneyClock,false,[],$moneyScope),'save_money_review','boundary plus one has optional cloud review');
assertIntegrity($moneyAnchor->town->coins===$moneyFixture->before->town->coins&&count($tooMuch->integrity->actions)>0,'held cloud update preserves both accepted snapshot and outgoing local journal');
$_ENV['SAVE_MONEY_GUARD_MODE']='observe';
$observed=$validator->accept($tooMuch,$moneyAnchor,$moneyClock,false,[],$moneyScope);
assertIntegrity($observed->town->coins===$tooMuch->town->coins&&SaveIntegrity::receipt($observed)['moneyBudget']['status']==='review','default observation saves full progress with review metadata');
$rapid=$validator->accept($observed,$observed,$moneyClock,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($rapid)['moneyBudget']['debt']==1&&SaveIntegrity::receipt($rapid)['moneyBudget']['newGrossCharge']==0,'rapid saves cannot renew the initial allowance or erase audit debt');
$paidReview=$validator->accept($rapid,$rapid,$moneyClock+1000,false,[],$moneyScope);
assertIntegrity($paidReview->integrity->context->moneyBudget->debt==0&&$paidReview->integrity->context->moneyBudget->reviewCount===1&&$paidReview->integrity->context->moneyBudget->lastReview->status==='review','harmless sync after elapsed debt repayment retains durable money review');
$reviewRestore=$validator->accept($moneyAnchor,$paidReview,$moneyClock+1000,true,[],$moneyScope);
assertIntegrity($reviewRestore->integrity->context->moneyBudget->reviewCount===1&&$reviewRestore->integrity->context->moneyBudget->lastReview->serverAt===$moneyClock,'signed old backup cannot erase durable latest-town review record');
$spoof=integrityData($tooMuch);$spoof['integrity']['clientAt']=$moneyClock+365*86400000;
$spoof['integrity']['context']=['moneyGross'=>0,'moneyBudget'=>['credit'=>900000000,'serverAt'=>0]];
$spoofed=$validator->accept(integrityObject($spoof),$moneyAnchor,$moneyClock,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($spoofed)['moneyBudget']['debt']==1,'client clock and invented context cannot replenish budget');
$zeroMining=$validator->accept(integrityMining($moneyFixture,0),$moneyAnchor,$moneyClock,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($zeroMining)['moneyBudget']['newGrossCharge']===$reserved,'zero-jewel completion still accounts for its new chest entitlement');

// A purchase in the same batch must not hide newly minted wallet money.
$shopBefore=integrityData($moneyFixture->before);$shopBefore['town']['buildings']['shop']=1;
$shopAfter=integrityData(integrityMining($moneyFixture,10020));$shopAfter['town']['buildings']['shop']=1;
$shopAfter['shopStock']=[['id'=>'clear-row','sold'=>true]];$shopAfter['shopVisit']=1;
foreach($shopAfter['integrity']['actions'] as &$action)if($action['kind']==='victory'){$action['data']['shopStock']=[['id'=>'clear-row','sold'=>false]];$action['data']['shopVisit']=1;}
unset($action);$shopItem=$rules['shop']['items'][0];$shopAfter['town']['coins']-=$shopItem['price'];
foreach($shopAfter['powers'] as &$power)if($power['id']===$shopItem['id'])$power['quantity']+=$shopItem['quantity'];unset($power);
$shopAfter['integrity']['actions'][]=integrityAction(4,'shop-buy',['itemId'=>$shopItem['id'],'visit'=>1]);
$shopAnchor=$validator->accept(integrityObject($shopBefore),null,$moneyClock);
$spent=$validator->accept(integrityObject($shopAfter),$shopAnchor,$moneyClock);
assertIntegrity($spent->town->coins<10000&&SaveIntegrity::receipt($spent)['moneyBudget']['newGrossCharge']==10020+$reserved,'spending cannot conceal gross money creation below final wallet allowance');

// Accepted rewards and reserves transfer value already accounted for.
foreach($fixtures->fixtures as $fixture)if(in_array($fixture->name,['saloon collection preserves four offline hours','raid bell refund and ordinary raid acknowledgment','protected raid bounty and rescheduling retain the seen receipt'],true)) {
    $start=$validator->accept($fixture->before,null,$fixture->serverNow);$finish=$validator->accept($fixture->after,$start,$fixture->serverNow);
    assertIntegrity(SaveIntegrity::receipt($finish)['moneyBudget']['newGrossCharge']==0,$fixture->name.' remains exempt from new-money accounting');
}
$pendingData=integrityData($fixtures->fixtures[3]->after);$claimAction=array_pop($pendingData['integrity']['actions']);
if($claimAction['kind']!=='chest-claim')throw new RuntimeException('Pending-reward fixture must end with its reload claim.');
$victoryAction=$pendingData['integrity']['actions'][1];$pendingReward=$rules['levels'][$victoryAction['data']['levelId']]['chestCoins'][2];
$pendingData['town']['coins']-=$pendingReward;
$pendingData['pendingChests']=[['id'=>$claimAction['data']['chestId'],'runId'=>$claimAction['data']['runId'],'source'=>$claimAction['data']['source'],'levelId'=>$claimAction['data']['levelId'],'economyVersion'=>2,'items'=>[['id'=>'coins','kind'=>'coins','quantity'=>$pendingReward]]]];
$pendingStart=$validator->accept($fixtures->fixtures[3]->before,null,$moneyClock);$pendingAccepted=$validator->accept(integrityObject($pendingData),$pendingStart,$moneyClock);
assertIntegrity(SaveIntegrity::receipt($pendingAccepted)['moneyBudget']['newReservedCoins']==$reserved,'pending full-bag reward reserves the largest legal purse at creation');
foreach([1,2] as $economyVersion) {
    $cached=integrityData($pendingAccepted);$cached['pendingChests'][0]['economyVersion']=$economyVersion;
    // This is an existing accepted entitlement, including legacy economy version1.
    $cached['integrity']['actions']=[];$cached['integrity']['baseSequence']=0;$cached['integrity']['epoch']=integrityUuid(500+$economyVersion);
    $cacheAnchor=$validator->accept(integrityObject($cached),null,$moneyClock);
    $claimed=integrityData($cacheAnchor);$claimed['pendingChests']=[];
    $cash=(int)floor($rules['levels'][1]['chestCoins'][$economyVersion]*1.5+0.5);$claimed['town']['coins']+=$cash;
    $claimed['integrity']['actions']=[integrityAction(1,'chest-claim',['chestId'=>$claimAction['data']['chestId'],'selection'=>'coins-big'])];
    $claimResult=$validator->accept(integrityObject($claimed),$cacheAnchor,$moneyClock+3600000);
    assertIntegrity($claimResult->town->coins===$claimed['town']['coins']&&SaveIntegrity::receipt($claimResult)['moneyBudget']['newGrossCharge']==0,'delayed maximum purse claim uses accepted economy version'.$economyVersion.' entitlement without a second charge');
}

$_ENV['SAVE_MONEY_GUARD_MODE']='hold';
$active=integrityData($moneyFixture->before);$active['issuedRun']=1;$active['integrity']['actions']=[$moneyFixture->after->integrity->actions[0]];
$activeAnchor=$validator->accept(integrityObject($active),$moneyAnchor,$moneyClock,false,[],$moneyScope);
for($i=1;$i<=4;$i++)$activeAnchor=$validator->accept($activeAnchor,$activeAnchor,$moneyClock+$i*900000,false,[],$moneyScope);
$longCompletion=$validator->accept(integrityMining($moneyFixture,1000000),$activeAnchor,$moneyClock+3600000,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($longCompletion)['moneyBudget']['carriedCredit']==3610000,'long active puzzle retains elapsed allowance despite intermediate syncs');
$longOffline=$validator->accept(integrityMining($moneyFixture,100000000),$moneyAnchor,$moneyClock+72*3600000,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($longOffline)['moneyBudget']['status']==='within_estimate','long offline progress has no elapsed-credit bucket cap');
$signedExact=integrityData($exact);$signedExact['integrity']['checkpoint']=$moneyAnchor->integrity->checkpoint;
$restoredMoney=$validator->accept($moneyAnchor,$exactResult,$moneyClock,true,[],$moneyScope);
assertIntegrity($restoredMoney->integrity->context->moneyBudget->credit==0&&$restoredMoney->integrity->context->moneyBudget->highWater==10000,'signed old restore retains latest money ledger rather than resetting burst');
$replayedMoney=$validator->accept(integrityObject($signedExact),$restoredMoney,$moneyClock,true,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($replayedMoney)['moneyBudget']['newGrossCharge']==0,'signed branch replay avoids charging previously accepted gains again');
$signedTooMuch=integrityData($tooMuch);$signedTooMuch['integrity']['checkpoint']=$moneyAnchor->integrity->checkpoint;
integrityDenied(fn()=>$validator->accept(integrityObject($signedTooMuch),$replayedMoney,$moneyClock,true,[],$moneyScope),'save_money_review','restore cannot renew credit for new gain beyond accepted high-water');
$preGuard=integrityPreGuard($moneyAnchor);
$migratedBudget=$validator->accept(integrityMining($moneyFixture,19250),$preGuard,$moneyClock,false,[],$moneyScope,$moneyClock-10000);
assertIntegrity(SaveIntegrity::receipt($migratedBudget)['moneyBudget']['estimatedAllowance']==20000,'old tracked checkpoint upgrade uses trusted cloud timestamp for offline allowance');
$oldBackup=integrityData($exact);$oldBackup['integrity']['checkpoint']=$preGuard->integrity->checkpoint;
integrityDenied(fn()=>$validator->accept(integrityObject($oldBackup),$exactResult,$moneyClock,true,[],$moneyScope),'save_money_review','pre-guard signed recovery conservatively retains latest credit without a new burst');
$oldRecovered=$validator->accept(integrityObject($oldBackup),$exactResult,$moneyClock+10000,true,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($oldRecovered)['moneyBudget']['newGrossCharge']==10000,'pre-guard signed recovery can use genuine subsequent server elapsed time');

// Deep payouts use the authoritative level multiplier, not client-supplied depth.
$deepLevel=$rules['levelCount'];$deepDef=$rules['levels'][$deepLevel];$deepBefore=integrityData($moneyFixture->before);
for($id=1;$id<$deepLevel;$id++)$deepBefore['records'][$id]=['score'=>0,'stars'=>1];
$deepAfter=integrityData($moneyFixture->after);$deepAfter['records']=$deepBefore['records'];
$deepScore=max($deepDef['chestTarget'],$deepDef['starScoreTarget']*3);$deepElapsed=$moneyFixture->after->integrity->actions[1]->data->elapsedMs;
$deepAfter['records'][$deepLevel]=['score'=>$deepScore,'stars'=>3,'bestTimeMs'=>$deepElapsed];
$deepAfter['town']['coins']=9900*$deepDef['miningMultiplier'];
foreach($deepAfter['integrity']['actions'] as &$action)if(isset($action['data']['levelId']))$action['data']['levelId']=$deepLevel;unset($action);
$deepVictory=&$deepAfter['integrity']['actions'][1]['data'];$deepVictory['jewels']=9900;$deepVictory['score']=$deepScore;$deepVictory['target']=$deepDef['chestTarget'];$deepVictory['starTarget']=$deepDef['starScoreTarget'];$deepVictory['speedTargetMs']=$deepDef['speedTargetMs'];unset($deepVictory);
$gift=$rules['chapters'][$deepDef['chapterIndex']]['gift'];
foreach($deepAfter['powers'] as &$power)if($power['id']===$gift['id'])$power['quantity']+=$gift['quantity'];unset($power);
$deepAnchor=$validator->accept(integrityObject($deepBefore),null,$moneyClock);
$deepResult=$validator->accept(integrityObject($deepAfter),$deepAnchor,$moneyClock);
assertIntegrity($deepResult->town->coins>10000&&SaveIntegrity::receipt($deepResult)['moneyBudget']['maxMultiplier']===$deepDef['miningMultiplier']&&SaveIntegrity::receipt($deepResult)['moneyBudget']['status']==='within_estimate','high-depth legitimate wallet gain is normalized by authoritative mining multiplier');
$_ENV['SAVE_MONEY_GUARD_MODE']='observe';
$overflowBefore=$deepBefore;
foreach($overflowBefore['powers'] as &$power)if($power['id']===$gift['id'])$power['quantity']=3;unset($power);
$overflowAfter=$deepAfter;$overflowAfter['powers']=$overflowBefore['powers'];
$overflowAfter['town']['coins']+= $rules['chapters'][$deepDef['chapterIndex']]['overflowCoins']+$deepDef['chestCoins'][2];
array_pop($overflowAfter['integrity']['actions']);$overflowAfter['integrity']['actions'][1]['data']['chooseRewards']=false;
$overflowAfter['integrity']['actions'][1]['data']['chests'][0]['rewardId']='coins';
$overflowAnchor=$validator->accept(integrityObject($overflowBefore),null,$moneyClock);
$overflowResult=$validator->accept(integrityObject($overflowAfter),$overflowAnchor,$moneyClock);
$overflowCheck=SaveIntegrity::receipt($overflowResult)['moneyBudget'];
assertIntegrity($overflowCheck['newMintedCoins']===$overflowAfter['town']['coins']&&$overflowCheck['newReservedCoins']==0&&abs($overflowCheck['newGrossCharge']-$overflowAfter['town']['coins']/$deepDef['miningMultiplier'])<0.000001,'chapter gift overflow and immediate coin chest are included in new victory money');

$immediate=integrityData($moneyFixture->after);array_pop($immediate['integrity']['actions']);
$immediate['integrity']['actions'][1]['data']['chooseRewards']=false;
$immediateResult=$validator->accept(integrityObject($immediate),$moneyAnchor,$moneyClock,false,[],$moneyScope);
assertIntegrity(SaveIntegrity::receipt($immediateResult)['moneyBudget']['newGrossCharge']==1200&&SaveIntegrity::receipt($immediateResult)['moneyBudget']['newReservedCoins']==0,'immediate non-cash chest does not reserve a later cash choice');
foreach($fixtures->fixtures as $fixture)if($fixture->name==='visitor reserve collection and a VIP purchase') {
    $vipStart=$validator->accept($fixture->before,null,$fixture->serverNow);$vipResult=$validator->accept($fixture->after,$vipStart,$fixture->serverNow);
    assertIntegrity(SaveIntegrity::receipt($vipResult)['moneyBudget']['newGrossCharge']===$rules['economy']['vipSpend'],'VIP new money is counted while saloon reserve transfer is exempt');
}

// A newly generated protected encounter earns a bounty at creation, before the
// later acknowledgment transfers it to the wallet.
foreach($fixtures->fixtures as $fixture)if($fixture->name==='protected raid bounty and rescheduling retain the seen receipt')$freshRaid=integrityData($fixture->before);
$freshRaid['town']['events']=[];$freshRaid['town']['nextRaidRun']=$freshRaid['town']['completedRuns'];
$raidAfter=$freshRaid;$development=array_sum($freshRaid['town']['buildings']);
$riders=$development>=70?10:($development>=50?8:($development>=30?6:($development>=16?4:2)));
$target=null;foreach($rules['economy']['incidentTargets']['bandits'] as $id)if($freshRaid['town']['buildings'][$id]){$target=$id;break;}
$event=['id'=>1,'atRun'=>$freshRaid['town']['completedRuns'],'gangSize'=>$riders,'sheriffLevel'=>$freshRaid['town']['buildings']['sheriff'],'bankLevel'=>$freshRaid['town']['buildings']['bank'],'outcome'=>'protected','loss'=>0,'seen'=>false,'targets'=>['mine',...($target?[$target]:[])]];
$raidAfter['town']['events']=['dusty-trail-visitors'=>$event];$raidAfter['town']['income']['at']=$moneyClock;
$raidAfter['town']['nextRaidRun']=$freshRaid['town']['completedRuns']+$rules['economy']['raidIntervalByEra']['frontier'][0];
$raidAfter['integrity']['actions']=[integrityAction(1,'raid-encounter',['event'=>$event,'nextRaidRun'=>$raidAfter['town']['nextRaidRun'],'at'=>$moneyClock])];
$raidAnchor=$validator->accept(integrityObject($freshRaid),null,$moneyClock);$raidEarned=$validator->accept(integrityObject($raidAfter),$raidAnchor,$moneyClock);
$bounty=min($riders,$event['sheriffLevel']*2)*$rules['economy']['bountyPerCaptured'];
assertIntegrity(SaveIntegrity::receipt($raidEarned)['moneyBudget']['newReservedCoins']===$bounty&&SaveIntegrity::receipt($raidEarned)['moneyBudget']['newGrossCharge']===$bounty,'fresh protected raid creates an accounted bounty entitlement');
$raidClaim=integrityData($raidEarned);$raidClaim['town']['events']['dusty-trail-visitors']['seen']=true;$raidClaim['town']['events']['dusty-trail-visitors']['bounty']=$bounty;$raidClaim['town']['coins']+=$bounty;
$raidClaim['integrity']['actions']=[integrityAction(2,'raid-seen',['raidId'=>1])];
$raidClaimed=$validator->accept(integrityObject($raidClaim),$raidEarned,$moneyClock);
assertIntegrity(SaveIntegrity::receipt($raidClaimed)['moneyBudget']['newGrossCharge']==0,'accepted new bounty is not charged again when acknowledged');
unset($_ENV['SAVE_MONEY_GUARD_MODE']);
echo "Save integrity checks passed ($count assertions).\n";
