<?php
require __DIR__.'/support.php';
try {
 status(401,callApi('GET','account'),'anonymous read');status(404,callApi('POST','guests',(object)[]),'no guests');status(404,callApi('POST','actions',(object)[]),'no gameplay API');
 status(403,callApi('POST','auth/login-link',['email'=>'a@example.test'],[],['HTTP_ORIGIN'=>'https://evil.test']),'origin');
 status(400,callApi('GET','health',null,[],['HTTP_HOST'=>'evil.test']),'host');
 status(200,callApi('POST','auth/login-link',['email'=>'a@example.test']),'neutral email request');
 $a=account();$b=account();status(401,callApi('POST','auth/confirm',['token'=>$a['token']]),'single-use link');
 $expired=bin2hex(random_bytes(32));$db->get()->insert('login_intents',['token_hash'=>$auth->hash($expired),'email'=>'expired@example.test','expires_at'=>time()-1]);status(401,callApi('POST','auth/confirm',['token'=>$expired]),'expired link');$db->get()->delete('login_intents',['token_hash'=>$auth->hash($expired)]);
 status(403,callApi('POST','towns',townBody(),$a,['HTTP_X_CSRF_TOKEN'=>'wrong']),'csrf');
 $body=townBody();$town=status(200,callApi('POST','towns',$body,$a),'attach');$id=$town['townId'];
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
 check(status(200,callApi('PUT','towns/'.$id,$upload,$a),'lost response')===$saved,'same upload gets same revision');
 $upload['profile']=profile(901);status(409,callApi('PUT','towns/'.$id,$upload,$a),'changed upload fingerprint');$upload['uploadId']=uuid();
 $conflict=status(409,callApi('PUT','towns/'.$id,$upload,$a),'divergence');check($conflict['cloud']['revision']===2,'conflict includes comparison');
 status(404,callApi('PUT','towns/'.$id,$upload,$b),'ownership write');
 $upload['baseRevision']=2;$resolved=status(200,callApi('PUT','towns/'.$id.'/resolve',$upload,$a),'explicit resolution');check($resolved['revision']===3,'resolve increments');
 check(status(200,callApi('GET','towns/'.$town2['townId'],null,$a),'other town')['revision']===1,'independent revisions');
 for($revision=3;$revision<10;$revision++)status(200,callApi('PUT','towns/'.$id,['baseRevision'=>$revision,'uploadId'=>uuid(),'profile'=>profile($revision)],$a),'save history');
 $history=status(200,callApi('GET','towns/'.$id.'/history',null,$a),'history');check(count($history['revisions'])===5,'bounded five previous saves');status(404,callApi('GET','towns/'.$id.'/history',null,$b),'history ownership');
 $bad=profile();$bad->schemaVersion=99;status(422,callApi('PUT','towns/'.$id,['baseRevision'=>10,'uploadId'=>uuid(),'profile'=>$bad],$a),'future schema preserved');
 $bad=profile();$bad->extra=str_repeat('x',1048576);status(413,callApi('PUT','towns/'.$id,['baseRevision'=>10,'uploadId'=>uuid(),'profile'=>$bad],$a),'size bound');
 $settings=['baseRevision'=>10,'name'=>'Dustwater','isPublic'=>true];$published=status(200,callApi('PATCH','towns/'.$id.'/settings',$settings,$a),'publish');$publicId=$published['publicId'];
 $publicSave=status(200,callApi('GET','villages/'.$publicId,null,$b),'visit');check(!isset($publicSave['profile'],$publicSave['playerId'],$publicSave['revision'],$publicSave['email']),'private fields absent');check(!isset($publicSave['appearance']['coins']),'wallet private');
 $settings=['baseRevision'=>11,'name'=>'New Austin','isPublic'=>true];$renamed=status(200,callApi('PATCH','towns/'.$id.'/settings',$settings,$a),'rename');check($renamed['publicId']===$publicId,'stable share id');
 foreach(['fuck town','p u t a i n','M3RDE','ＦＵＣＫ'] as $badName)status(422,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>12,'name'=>$badName,'isPublic'=>true],$a),'public moderation');
 $private=status(200,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>12,'name'=>'merde town','isPublic'=>false],$a),'private name playable');status(404,callApi('GET','villages/'.$publicId,null,$b),'unpublish');
 $republished=status(200,callApi('PATCH','towns/'.$id.'/settings',['baseRevision'=>13,'name'=>'Dustwater','isPublic'=>true],$a),'republish');check($republished['publicId']===$publicId,'public id survives visibility change');
 status(422,callApi('DELETE','towns/'.$id,['baseRevision'=>14,'confirmation'=>'wrong'],$a),'destructive confirmation');
 status(200,callApi('DELETE','towns/'.$id,['baseRevision'=>14,'confirmation'=>'Dustwater'],$a),'delete town');status(404,callApi('GET','towns/'.$id,null,$a),'deleted private');status(404,callApi('GET','villages/'.$publicId,null,$b),'deleted public');
 status(409,callApi('POST','towns',$body,$a),'no resurrection');status(200,callApi('POST','towns',townBody('Fourth Town'),$a),'freed slot');
 $token=bin2hex(random_bytes(32));$db->get()->insert('login_intents',['token_hash'=>$auth->hash($token),'email'=>'native-'.bin2hex(random_bytes(4)).'@example.test','expires_at'=>time()+900]);
 $native=status(200,callApi('POST','auth/confirm',['token'=>$token,'native'=>true],[],['HTTP_ORIGIN'=>'capacitor://localhost']),'native sign in');$accounts[]=$native['account']['id'];
 check(strlen($native['token'])===64,'native bearer issued');status(200,callApi('GET','account',null,[],['HTTP_ORIGIN'=>'capacitor://localhost','HTTP_AUTHORIZATION'=>'Bearer '.$native['token']]),'native API');
 status(403,callApi('GET','account',null,[],['HTTP_ORIGIN'=>'https://evil.test','HTTP_AUTHORIZATION'=>'Bearer '.$native['token']]),'native origin allowlist');
 status(200,callApi('POST','auth/revoke-all',(object)[],$a),'revoke all');status(401,callApi('GET','account',null,$a),'revoked session');
 status(200,callApi('DELETE','account',['confirmation'=>'DELETE MY ACCOUNT'],$b),'delete account');status(401,callApi('GET','account',null,$b),'deleted account session');
 echo "Save API checks passed ($count assertions).\n";
} finally {cleanup();}
