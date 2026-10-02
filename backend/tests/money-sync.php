<?php
declare(strict_types=1);
require __DIR__.'/support.php';

/** Use actual frontend victory snapshots, then test the API transaction boundary. */
function moneySyncVictory(int $extraJewels=0): array {
    $fixtures=json_decode(file_get_contents(__DIR__.'/fixtures/integrity-flows.json'));
    $fixture=$fixtures->fixtures[0];$before=$fixture->before;$after=$fixture->after;
    $now=(int)floor(microtime(true)*1000);$epoch=uuid();
    $before->integrity->epoch=$after->integrity->epoch=$epoch;
    $before->integrity->clientAt=$after->integrity->clientAt=$now;
    foreach([$before,$after] as $profile)if($profile->town->income->at!==null)$profile->town->income->at=$now;
    $rules=json_decode(file_get_contents(dirname(__DIR__).'/content/save-rules.json'));
    foreach($after->integrity->actions as $action) {
        $action->id=uuid();if(isset($action->data->at))$action->data->at=$now;
        if($action->kind==='victory') {
            $action->data->jewels+=$extraJewels;
            $after->town->coins+=(int)floor($extraJewels*$rules->levels->{$action->data->levelId}->miningMultiplier);
        }
    }
    return [$before,$after];
}

try {
    $owner=account();[$before,$after]=moneySyncVictory(1000000000);
    $create=townBody('Money Estimate');$create['profile']=$before;
    $_ENV['SAVE_MONEY_GUARD_MODE']='observe';
    $attached=callApi('POST','towns',$create,$owner);
    $town=status(200,$attached,'attach tracked town');$id=$town['townId'];
    $backup=json_decode($attached['response']->getContent())->profile;
    $initial=$town['integrity']['moneyBudget'];
    $after->integrity->checkpoint=$town['integrity']['checkpoint'];
    // Client context and a future upload timestamp cannot increase server credit.
    $after->integrity->clientAt+=365*86400000;
    $after->integrity->context=(object)['moneyGross'=>0,'moneyBudget'=>(object)['credit'=>9007199254740991,'debt'=>0,'highWater'=>9007199254740991]];
    $upload=['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>$after];
    $_ENV['SAVE_MONEY_GUARD_MODE']='hold';
    $denied=status(422,callApi('PUT','towns/'.$id,$upload,$owner),'optional hold');
    check($denied['code']==='save_money_review'&&$denied['moneyBudget']['status']==='review','hold returns recoverable owner-only estimate');
    $kept=status(200,callApi('GET','towns/'.$id,null,$owner),'cloud after hold');
    check($kept['revision']===1&&$kept['profile']===$town['profile'],'hold preserves the complete accepted cloud snapshot');
    check((int)$db->get()->fetchOne('SELECT COUNT(*) FROM town_history WHERE town_id=?',[$id])===0,'hold creates no history or partial revision');
    check($db->get()->fetchOne('SELECT upload_id FROM towns WHERE id=?',[$id])===$create['uploadId'],'hold does not acknowledge the refused upload');
    $_ENV['SAVE_MONEY_GUARD_MODE']='observe';
    $start=(int)floor(microtime(true)*1000);
    $saved=status(200,callApi('PUT','towns/'.$id,$upload,$owner),'observe preserves flagged progress');
    $end=(int)floor(microtime(true)*1000);$check=$saved['integrity']['moneyBudget'];
    check($saved['revision']===2&&$saved['profile']['town']['coins']===$after->town->coins,'observe saves full earnings without clipping');
    check($check['mode']==='observe'&&$check['status']==='review'&&$check['debt']>0,'large valid-looking payout stays marked for review');
    $reviewLedger=$saved['profile']['integrity']['context']['moneyBudget'];
    check($reviewLedger['reviewCount']===1&&$reviewLedger['lastReview']['status']==='review','accepted excessive gain leaves a durable review flag');
    check($check['previousServerAt']===$initial['serverAt']&&$check['serverAt']>=$start&&$check['serverAt']<=$end,'budget uses actual transaction server milliseconds');
    check($check['elapsedMs']===$check['serverAt']-$initial['serverAt'],'client clock and context cannot expand the interval');
    check(status(200,callApi('PUT','towns/'.$id,$upload,$owner),'lost response retry')===$saved,'retry preserves exact acknowledgment and budget metadata');
    $highWater=$saved['profile']['integrity']['context']['moneyBudget']['highWater'];
    $restored=status(200,callApi('PUT','towns/'.$id.'/resolve',['baseRevision'=>2,'uploadId'=>uuid(),'profile'=>$backup],$owner),'signed backup with latest budget');
    check($restored['profile']['town']['coins']===$before->town->coins,'explicit recovery replaces the economic branch');
    $ledger=$restored['profile']['integrity']['context']['moneyBudget'];
    check($ledger['highWater']===$highWater&&$ledger['credit']==0&&$ledger['debt']>0,'recovery does not renew initial credit or erase accepted debt');
    check($ledger['reviewCount']===$reviewLedger['reviewCount']&&$ledger['lastReview']===$reviewLedger['lastReview'],'recovery retains prior review evidence without flagging it twice');

    // An existing tracked town predating this feature has trusted DB save time.
    [$before,$after]=moneySyncVictory(20000);$create=townBody('Older Checkpoint');$create['profile']=$before;
    $attached=callApi('POST','towns',$create,$owner);$town=status(200,$attached,'attach migration fixture');$id=$town['townId'];
    $legacy=json_decode($attached['response']->getContent())->profile;
    unset($legacy->integrity->context->moneyBudget,$legacy->integrity->context->moneyGross);
    $previousSecond=time()-60;
    $db->get()->update('towns',['profile'=>json_encode($legacy,JSON_THROW_ON_ERROR),'saved_at'=>$previousSecond],['id'=>$id]);
    $after->integrity->checkpoint=$town['integrity']['checkpoint'];
    $_ENV['SAVE_MONEY_GUARD_MODE']='hold';
    $migrated=status(200,callApi('PUT','towns/'.$id,['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>$after],$owner),'preguard offline migration');
    check($migrated['integrity']['moneyBudget']['previousServerAt']===$previousSecond*1000,'old ledger accrues from the trusted saved_at column');
    check($migrated['integrity']['moneyBudget']['newGrossCharge']>App\MoneyBudget::INITIAL_CREDIT,'real elapsed time admits earnings above fresh initial credit');
    echo "Money sync transaction checks passed ($count assertions).\n";
} finally {
    unset($_ENV['SAVE_MONEY_GUARD_MODE']);cleanup();
}
