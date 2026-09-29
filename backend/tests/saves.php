<?php
require __DIR__.'/support.php';
try {
 require __DIR__.'/migration-resume.php';
 status(401,callApi('GET','account'),'anonymous read');status(404,callApi('POST','guests',(object)[]),'no guests');status(404,callApi('POST','actions',(object)[]),'no gameplay API');
 status(403,callApi('POST','auth/login-link',['email'=>'a@example.test'],[],['HTTP_ORIGIN'=>'https://evil.test']),'origin');
 status(400,callApi('GET','health',null,[],['HTTP_HOST'=>'evil.test']),'host');
 status(200,callApi('POST','auth/login-link',['email'=>'a@example.test']),'neutral email request');
 $a=account();$b=account();status(401,callApi('POST','auth/confirm',['token'=>$a['token']]),'single-use link');
 $expired=bin2hex(random_bytes(32));$db->get()->insert('login_intents',['token_hash'=>$auth->hash($expired),'email'=>'expired@example.test','expires_at'=>time()-1]);status(401,callApi('POST','auth/confirm',['token'=>$expired]),'expired link');$db->get()->delete('login_intents',['token_hash'=>$auth->hash($expired)]);
 status(403,callApi('POST','towns',townBody(),$a,['HTTP_X_CSRF_TOKEN'=>'wrong']),'csrf');
 status(200,callApi('GET','account',null,$a,['HTTP_AUTHORIZATION'=>'Basic '.base64_encode('host:test')]),'hosting basic auth uses account cookie');
 status(401,callApi('GET','account',null,[],['HTTP_AUTHORIZATION'=>'Basic '.base64_encode('host:test')]),'basic auth alone grants no account');
 $body=townBody();$town=status(200,callApi('POST','towns',$body,$a),'attach');$id=$town['townId'];
 $listed=status(200,callApi('GET','account',null,$a),'owner town summaries')['towns'];
 check(count($listed)===1 && $listed[0]['summary']===['era'=>'frontier','coins'=>25,'buildings'=>1],'new device gets card details');
 check(!isset($listed[0]['profile'],$listed[0]['records'],$listed[0]['powers']),'list omits full private saves');
 check($town['revision']===1 && !$town['isPublic'],'private first revision');
 check(status(200,callApi('POST','towns',$body,$a),'lost attach response')===$town,'attachment retry stable');
 status(404,callApi('GET','towns/'.$id,null,$b),'ownership read');
 status(409,callApi('POST','towns',$body,$b),'uuid is not ownership');
 // Every private route must scope the supplied UUID to the authenticated account.
 $foreignUpload=['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>profile(999)];
 foreach([
  ['GET','towns/'.$id,null],
  ['PUT','towns/'.$id,$foreignUpload],
  ['PUT','towns/'.$id.'/resolve',$foreignUpload],
  ['GET','towns/'.$id.'/history',null],
  ['PATCH','towns/'.$id.'/settings',['baseRevision'=>1,'name'=>'Stolen Town','isPublic'=>true]],
  ['DELETE','towns/'.$id,['baseRevision'=>1,'confirmation'=>$body['name']]],
 ] as [$method,$path,$payload]) {
  $denied=callApi($method,$path,$payload,$b);
  status(404,$denied,'foreign town '.$method.' '.$path);
  check(!isset($denied['data']['cloud'],$denied['data']['profile']),'no foreign snapshot in denial');
  status(401,callApi($method,$path,$payload),'anonymous town operation');
 }
 check(status(200,callApi('GET','towns/'.$id,null,$a),'owner after denied operations')===$town,'foreign requests leave town unchanged');
 $forged=$foreignUpload+['playerId'=>$a['id']];
 status(422,callApi('PUT','towns/'.$id,$forged,$b),'client cannot choose authenticated user');
 check(status(200,callApi('GET','account',null,$b),'foreign account list')['towns']===[],'account list hides other users towns');

 status(409,callApi('POST','towns',townBody('DUSTWATER'),$a),'account case-insensitive name');
 status(200,callApi('POST','towns',townBody('DUSTWATER'),$b),'names not globally unique');
 $body2=townBody('Red Mesa');$town2=status(200,callApi('POST','towns',$body2,$a),'second town');
 status(200,callApi('POST','towns',townBody('Copper Creek'),$a),'third town');status(409,callApi('POST','towns',townBody('Fourth Town'),$a),'three slots');
 $upload=['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>profile(900)];
 $saved=status(200,callApi('PUT','towns/'.$id,$upload,$a),'save client progress');check($saved['profile']['town']['coins']===900,'single player coins are not recalculated');
 $listed=status(200,callApi('GET','account',null,$a),'summaries after save')['towns'];
 $card=array_values(array_filter($listed,fn($entry)=>$entry['townId']===$id))[0];
 check($card['summary']['coins']===900 && $card['revision']===2,'summary follows latest saved revision');
 check(status(200,callApi('PUT','towns/'.$id,$upload,$a),'lost response')===$saved,'same upload gets same revision');
 $upload['profile']=profile(901);status(409,callApi('PUT','towns/'.$id,$upload,$a),'changed upload fingerprint');$upload['uploadId']=uuid();
 $conflict=status(409,callApi('PUT','towns/'.$id,$upload,$a),'divergence');check($conflict['cloud']['revision']===2,'conflict includes comparison');
 status(404,callApi('PUT','towns/'.$id,$upload,$b),'ownership write');
 $upload['baseRevision']=2;$resolved=status(200,callApi('PUT','towns/'.$id.'/resolve',$upload,$a),'explicit resolution');check($resolved['revision']===3,'resolve increments');
 check(status(200,callApi('GET','towns/'.$town2['townId'],null,$a),'other town')['revision']===1,'independent revisions');
 for($revision=3;$revision<10;$revision++) { $lastUpload=['baseRevision'=>$revision,'uploadId'=>uuid(),'profile'=>profile($revision)]; status(200,callApi('PUT','towns/'.$id,$lastUpload,$a),'save history'); }
 $history=status(200,callApi('GET','towns/'.$id.'/history',null,$a),'history');check(count($history['revisions'])===5,'bounded five previous saves');status(404,callApi('GET','towns/'.$id.'/history',null,$b),'history ownership');
 $bad=profile();$bad->schemaVersion=99;status(422,callApi('PUT','towns/'.$id,['baseRevision'=>10,'uploadId'=>uuid(),'profile'=>$bad],$a),'future schema preserved');
 $bad=profile();$bad->extra=str_repeat('x',1048576);status(413,callApi('PUT','towns/'.$id,['baseRevision'=>10,'uploadId'=>uuid(),'profile'=>$bad],$a),'size bound');
 $settings=['baseRevision'=>10,'name'=>'Dustwater','isPublic'=>true];$published=status(200,callApi('PATCH','towns/'.$id.'/settings',$settings,$a),'publish');$publicId=$published['publicId'];check($published['revision']===10,'metadata leaves gameplay revision unchanged');check(count(status(200,callApi('GET','towns/'.$id.'/history',null,$a),'history after metadata')['revisions'])===5,'metadata does not archive gameplay');
 $publicSave=status(200,callApi('GET','villages/'.$publicId,null,$b),'visit');status(200,callApi('GET','villages/'.$publicId),'share link needs no account');status(401,callApi('GET','villages?page=1'),'browsing needs an account');check(!isset($publicSave['profile'],$publicSave['playerId'],$publicSave['revision'],$publicSave['email']),'private fields absent');check(!isset($publicSave['appearance']['coins']),'wallet private');
 $settings=['baseRevision'=>10,'name'=>'New Austin','isPublic'=>true];$renamed=status(200,callApi('PATCH','towns/'.$id.'/settings',$settings,$a),'rename');check($renamed['publicId']===$publicId,'stable share id');check(status(200,callApi('PUT','towns/'.$id,$lastUpload,$a),'retry receipt after rename')['revision']===10,'metadata preserves upload receipt');
 status(200,callApi('PATCH','towns/'.$town2['townId'].'/settings',['baseRevision'=>1,'name'=>'Other Details','isPublic'=>false],$a),'other device changes metadata');
 check(status(200,callApi('PUT','towns/'.$town2['townId'],['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>profile(777)],$a),'offline progress after metadata')['profile']['town']['coins']===777,'metadata does not conflict with offline progress');
 // Share-link visits: saloon collection remains independent of live visitor presence.
 $shared=status(200,callApi('PATCH','towns/'.$town2['townId'].'/settings',['baseRevision'=>2,'name'=>'Other Details','isPublic'=>true],$a),'publish second town')['publicId'];
 $sharedVisit=status(200,callApi('GET','villages/'.$shared),'anonymous visit');check($sharedVisit['saloonReadyAt']===0&&!isset($sharedVisit['guest'],$sharedVisit['visits']),'visit shows only saloon readiness');
 check(status(409,callApi('POST','villages/'.$shared.'/saloon',(object)[]),'no saloon to collect')['code']==='no_saloon','saloon must be built');
 $saloon=profile(40);$saloon->town->buildings->saloon=1;$saloon->records=(object)['1'=>(object)['stars'=>3,'score'=>4000,'bestTimeMs'=>1200,'private'=>'hidden']];status(200,callApi('PUT','towns/'.$town2['townId'],['baseRevision'=>2,'uploadId'=>uuid(),'profile'=>$saloon],$a),'build saloon');
 // An open visit polls for the owner's progress: the same public view, never a new guest.
 $live=status(200,callApi('GET','villages/'.$shared.'/latest'),'anonymous poll');check($live['appearance']['buildings']['saloon']===1&&$live['saloonReadyAt']===0&&array_keys($live)===array_keys($sharedVisit),'a watching visitor sees the owner\'s latest save');
 // A visit shows the owner's mine level and a level-5 landmark as it is, not capped at 3.
 check($sharedVisit['appearance']['mineLevel']===1&&$sharedVisit['appearance']['levelRecords']===[],'a new town has no awards and unlocks level 1');
 check($live['appearance']['mineLevel']===2&&$live['appearance']['levelRecords']===[1=>['stars'=>3]],'poll publishes only completed level stars from the latest owner save');
 // Existing shares gain awards immediately without requiring another owner save.
 $legacy=$live;unset($legacy['appearance']['levelRecords'],$legacy['saloonReadyAt']);
 $db->get()->update('towns',['appearance'=>json_encode($legacy)],['id'=>$town2['townId']]);
 foreach(['','/latest'] as $suffix) {
  $upgraded=status(200,callApi('GET','villages/'.$shared.$suffix),'legacy shared collection');
  check($upgraded['appearance']['levelRecords']===[1=>['stars'=>3]]&&!isset($upgraded['profile']),'legacy view projects only public awards');
 }

 $progress=profile();$progress->town->buildings->saloon=5;$progress->town->buildingEraLevels->saloon=9;$progress->records=(object)['1'=>(object)['stars'=>3],'2'=>(object)['stars'=>1],'4'=>(object)['stars'=>2]];
 $view=json_decode($public->projection($progress,'Progress','0'),true)['appearance'];check($view['mineLevel']===3&&$view['buildings']['saloon']===5&&$view['buildingEraLevels']['saloon']===3,'visit shows the next mine level and true building levels');
 check($view['levelRecords']===[1=>['stars'=>3],2=>['stars'=>1],4=>['stars'=>2]],'public collection retains every completion including a gap');
 $progress->records=(object)['0'=>(object)['stars'=>3],'999999'=>(object)['stars'=>3],'bad'=>(object)['stars'=>3],'1'=>(object)['stars'=>4],'2'=>(object)['stars'=>0],'3'=>(object)['stars'=>'2'],'4'=>(object)['stars'=>2,'score'=>100,'secret'=>'private']];
 $awards=json_decode($public->projection($progress,'Progress','0'),true)['appearance']['levelRecords'];
 check($awards===[4=>['stars'=>2]],'awards omit unknown levels, invalid stars and private record fields');
 status(422,callApi('POST','villages/'.$shared.'/saloon',['coins'=>999]),'visitors cannot name an amount');
 $tap=status(200,callApi('POST','villages/'.$shared.'/saloon',(object)[]),'anonymous saloon tap');check($tap['readyAt']>time(),'saloon rests after a tap');
 $rest=status(409,callApi('POST','villages/'.$shared.'/saloon',(object)[],$b),'second visitor within the hour');check($rest['code']==='saloon_resting'&&$rest['readyAt']===$tap['readyAt'],'one saloon tap per town per hour');
 check(status(200,callApi('GET','villages/'.$shared),'visit after tap')['saloonReadyAt']===$tap['readyAt'],'visitors see when the saloon reopens');
 check(status(200,callApi('GET','villages/'.$shared.'/latest'),'poll after tap')['saloonReadyAt']===$tap['readyAt'],'a watching visitor sees another visitor collect');
 $visits=function() use($a,$town2){foreach(status(200,callApi('GET','account',null,$a),'owner visits')['towns'] as $t)if($t['townId']===$town2['townId'])return ['saloonAt'=>$t['saloonCollectedAt'],'guest'=>$t['guest']];};
 status(200,callApi('GET','villages/'.$shared,null,$a),'owner visits own town');check($visits()===['saloonAt'=>($tap['readyAt']-3600)*1000,'guest'=>null],'owner receives the tap but is not their own guest');
 status(200,callApi('GET','villages/'.$shared,null,$b),'signed-in visit');check($visits()['guest']===null,'opening a public view does not queue an ordinary VIP');
 status(200,callApi('GET','villages/'.$shared.'/latest',null,$b),'signed-in visitor keeps watching');check($visits()['guest']===null,'polling never queues an ordinary VIP');
 foreach(['Silver-Creek'=>'SilverCreek',"O’Hara  Town"=>'OHara Town','Élan Vital'=>'Élan Vital','www example'=>null,'visit example.com'=>null,'a@b.fr'=>null,'http town'=>null,'merde town'=>null,'a-b'=>null,'--'=>null] as $raw=>$clean)check($public->guestName($raw)===$clean,'guest name sanitised: '.$raw);
 foreach(['fuck town','p u t a i n','M3RDE','ＦＵＣＫ'] as $badName)status(422,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>10,'name'=>$badName,'isPublic'=>true],$a),'public moderation');
 $private=status(200,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>10,'name'=>'merde town','isPublic'=>false],$a),'private name playable');status(404,callApi('GET','villages/'.$publicId,null,$b),'unpublish');status(404,callApi('GET','villages/'.$publicId.'/latest',null,$b),'unpublished poll');status(404,callApi('GET','villages/'.$publicId),'unpublished share link');
 $republished=status(200,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>10,'name'=>'Dustwater','isPublic'=>true],$a),'republish');check($republished['publicId']===$publicId,'public id survives visibility change');
 status(422,callApi('DELETE','towns/'.$id,['baseRevision'=>10,'confirmation'=>'wrong'],$a),'destructive confirmation');
 status(200,callApi('DELETE','towns/'.$id,['baseRevision'=>10,'confirmation'=>'Dustwater'],$a),'delete town');status(404,callApi('GET','towns/'.$id,null,$a),'deleted private');status(404,callApi('GET','villages/'.$publicId,null,$b),'deleted public');
 status(409,callApi('POST','towns',$body,$a),'no resurrection');status(200,callApi('POST','towns',townBody('Fourth Town'),$a),'freed slot');
 $token=bin2hex(random_bytes(32));$db->get()->insert('login_intents',['token_hash'=>$auth->hash($token),'email'=>'native-'.bin2hex(random_bytes(4)).'@example.test','expires_at'=>time()+900]);
 $native=status(200,callApi('POST','auth/confirm',['token'=>$token,'native'=>true],[],['HTTP_ORIGIN'=>'capacitor://localhost']),'native sign in');$accounts[]=$native['account']['id'];
 check(strlen($native['token'])===64,'native bearer issued');status(200,callApi('GET','account',null,[],['HTTP_ORIGIN'=>'capacitor://localhost','HTTP_AUTHORIZATION'=>'Bearer '.$native['token']]),'native API');
 status(403,callApi('GET','account',null,[],['HTTP_ORIGIN'=>'https://evil.test','HTTP_AUTHORIZATION'=>'Bearer '.$native['token']]),'native origin allowlist');
 status(200,callApi('POST','auth/revoke-all',(object)[],$a),'revoke all');status(401,callApi('GET','account',null,$a),'revoked session');
 status(200,callApi('DELETE','account',['confirmation'=>'DELETE MY ACCOUNT'],$b),'delete account');status(401,callApi('GET','account',null,$b),'deleted account session');
 echo "Save API checks passed ($count assertions).\n";
} finally {cleanup();}
