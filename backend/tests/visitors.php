<?php
require __DIR__.'/support.php';
use App\VisitorService;
$visitorTestIp='127.'.random_int(1,254).'.'.random_int(1,254).'.'.random_int(1,254);
function visitorApi(string $method,string $path,mixed $body=null,array $session=[],array $headers=[]): array {
    global $visitorTestIp;
    return callApi($method,$path,$body,$session,$headers+['REMOTE_ADDR'=>$visitorTestIp]);
}
try {
    $owner=account();$guest=account();$other=account();
    $hostBody=townBody('Host Harbor');$hostBody['profile']->town->buildings->saloon=1;
    $host=status(200,visitorApi('POST','towns',$hostBody,$owner),'host town');
    $hostId=$host['townId'];
    $hostPath='towns/'.$hostId;
    $publicId=status(200,visitorApi('PATCH',$hostPath.'/settings',['baseRevision'=>1,'name'=>'Host Harbor','isPublic'=>true],$owner),'share host')['publicId'];
    $presence='villages/'.$publicId.'/presence';
    $book=fn($page=1)=>status(200,visitorApi('GET',$hostPath.'/visitors?page='.$page,null,$owner),'owner guestbook');
    $publicBook=fn($page=1)=>status(200,visitorApi('GET','villages/'.$publicId.'/visitors?page='.$page),'public guestbook');
    $originBody=townBody('Silver Creek');$originBody['profile']->town->era='industrial';
    $origin=status(200,visitorApi('POST','towns',$originBody,$guest),'visitor home');
    $originId=$origin['townId'];
    $anonymous=status(200,visitorApi('GET','account/profile'),'anonymous profile');
    check($anonymous===['profile'=>null,'towns'=>[]],'anonymous profile has no account information');
    $profile=status(200,visitorApi('GET','account/profile',null,$guest),'new profile');
    check($profile['profile']['displayName']===''&&$profile['csrf']===$guest['csrf'],'direct visits can get csrf without initializing saves');
    check($profile['towns'][0]['era']==='industrial'&&$profile['towns'][0]['publicId']===null,'own private origin choices include era only');
    status(401,visitorApi('PATCH','account/profile',['displayName'=>'Camille']),'profile requires sign in');
    status(403,visitorApi('PATCH','account/profile',['displayName'=>'Camille'],$guest,['HTTP_X_CSRF_TOKEN'=>'bad']),'profile csrf');
    foreach(['ab','mail@example.com','https://example.com','merde town','<script>'] as $name)status(422,visitorApi('PATCH','account/profile',['displayName'=>$name],$guest),'public name validation');
    status(422,visitorApi('PATCH','account/profile',['displayName'=>'Camille','visitingTownId'=>$hostId],$guest),'foreign origin rejected');
    $saved=status(200,visitorApi('PATCH','account/profile',['displayName'=>'  Camille  Rose ','visitingTownId'=>$originId],$guest),'save public profile');
    check($saved['profile']===['displayName'=>'Camille Rose','visitingTownId'=>$originId],'profile is normalized and persisted');
    $token=bin2hex(random_bytes(32));$browser=bin2hex(random_bytes(32));
    $body=['token'=>$token,'browserToken'=>$browser,'sequence'=>1];
    status(403,visitorApi('POST',$presence,$body,$guest,['HTTP_X_CSRF_TOKEN'=>'bad']),'signed-in presence csrf');
    status(403,visitorApi('POST',$presence,$body,[],['HTTP_ORIGIN'=>'https://evil.test']),'anonymous presence origin');
    status(422,visitorApi('POST',$presence,$body+['name'=>'Spoofed']),'identity cannot be client supplied');
    status(422,visitorApi('POST',$presence,['token'=>'short']),'presence token validated');
    status(422,visitorApi('POST',$presence,$body+['townId'=>$hostId],$guest),'visitor cannot impersonate foreign town');
    $earlyToken=bin2hex(random_bytes(32));
    status(200,visitorApi('DELETE',$presence,['token'=>$earlyToken,'sequence'=>2]),'departure beats initial heartbeat');
    $delayed=status(200,visitorApi('POST',$presence,['token'=>$earlyToken,'sequence'=>1]),'delayed initial heartbeat');
    check(!$delayed['active']&&$book()['history']===[],'departure tombstone prevents late initial join without phantom history');
    $joined=status(200,visitorApi('POST',$presence,$body,$guest),'signed in join');
    check($joined['active']&&$joined['expiresAt']-$joined['serverNow']===VisitorService::LEASE_SECONDS*1000,'bounded presence lease uses milliseconds');
    $entries=$book();$visitor=$entries['present'][0];$visitId=$visitor['id'];
    check(count($entries['history'])===1&&$visitor['name']==='Camille Rose'&&$visitor['townName']==='Silver Creek'&&$visitor['era']==='industrial'&&$visitor['publicId']===null,'server identity and home era even for private origin');
    check(!isset($visitor['player_id'],$visitor['visitor_key'],$visitor['origin_town_id'],$visitor['token_hash']),'guestbook hides identifiers and lease secrets');
    check($joined['visitId']===$visitId,'presence identifies own grouped character');
    $publicEntries=$publicBook();
    check($publicEntries['present']===$entries['present']&&$publicEntries['history']===$entries['history'],'public view has same guests and history');
    check(!array_key_exists('saloonCollectedAt',$publicEntries),'public guestbook omits owner collection receipt');
    check(array_keys($publicEntries['present'][0])===['id','name','townName','era','publicId','arrivedAt','lastSeenAt','departedAt'],'public guestbook whitelist excludes private identifiers and tokens');
    status(422,visitorApi('GET','villages/'.$publicId.'/visitors?page=0'),'public invalid page');
    status(422,visitorApi('GET','villages/'.$publicId.'/visitors?extra=1'),'public unknown query');
    $collection=status(200,visitorApi('POST','villages/'.$publicId.'/saloon',(object)[]),'visitor collects saloon');
    check($book()['saloonCollectedAt']===($collection['readyAt']-3600)*1000,'owner live poll receives collection timestamp in milliseconds');
    $retryExpiry=time()+10;
    $db->get()->update('visitor_leases',['expires_at'=>$retryExpiry],['token_hash'=>$auth->hash('visitor:'.$token)]);
    $retry=status(200,visitorApi('POST',$presence,$body,$guest),'duplicate heartbeat sequence');
    check($retry['active']&&$retry['expiresAt']===$retryExpiry*1000,'duplicate heartbeat does not extend the lease');
    check($retry['visitId']===$visitId,'idempotent heartbeat retains same character');
    status(401,visitorApi('GET',$hostPath.'/visitors'),'anonymous guestbook denied');
    status(404,visitorApi('GET',$hostPath.'/visitors',null,$guest),'foreign guestbook denied');
    status(422,visitorApi('GET',$hostPath.'/visitors?page=0',null,$owner),'invalid page');
    status(422,visitorApi('GET',$hostPath.'/visitors?extra=1',null,$owner),'unknown query');
    $own=status(200,visitorApi('POST',$presence,['token'=>bin2hex(random_bytes(32))],$owner),'owner visits own town');
    check(!$own['active']&&count($book()['present'])===1,'self never appears or creates log');
    $token2=bin2hex(random_bytes(32));
    status(200,visitorApi('POST',$presence,['token'=>$token2,'sequence'=>1],$guest),'same person second tab');
    check(count($book()['present'])===1&&count($book()['history'])===1,'multiple tabs have one actor and history entry');
    status(200,visitorApi('DELETE',$presence,['token'=>$token,'sequence'=>2]),'leave authorized by tab token');
    check(count($book()['present'])===1,'leaving one tab keeps another live');
    $late=status(200,visitorApi('POST',$presence,$body,$guest),'delayed heartbeat after departure');
    check(!$late['active'],'closed lease never resurrects');
    status(200,visitorApi('DELETE',$presence,['token'=>$token2,'sequence'=>0]),'stale departure ignored');
    check(count($book()['present'])===1,'sequence prevents old departure overwriting heartbeat');
    status(200,visitorApi('DELETE',$presence,['token'=>$token2,'sequence'=>2]),'last tab leaves');
    $entries=$book();check(count($entries['present'])===0&&$entries['history'][0]['departedAt']!==null,'last departure closes visit immediately');
    // Snapshots survive display-name and town changes, public links follow current visibility.
    status(200,visitorApi('PATCH','account/profile',['displayName'=>'New Camille','visitingTownId'=>$originId],$guest),'change public name');
    $originPublic=status(200,visitorApi('PATCH','towns/'.$originId.'/settings',['baseRevision'=>1,'name'=>'New Silver','isPublic'=>true],$guest),'share renamed origin')['publicId'];
    $historic=$book()['history'][0];
    check($historic['name']==='Camille Rose'&&$historic['townName']==='Silver Creek'&&$historic['publicId']===$originPublic,'guest history snapshot with currently public return link');
    status(200,visitorApi('PATCH','towns/'.$originId.'/settings',['baseRevision'=>1,'name'=>'New Silver','isPublic'=>false],$guest),'unshare origin');
    check($book()['history'][0]['publicId']===null,'private origin link disappears from history');
    $anonToken=bin2hex(random_bytes(32));$anonBrowser=bin2hex(random_bytes(32));
    status(200,visitorApi('POST',$presence,['token'=>$anonToken,'browserToken'=>$anonBrowser]),'anonymous join');
    $anonymous=$book()['present'][0];
    check($anonymous['name']===''&&$anonymous['townName']===null&&$anonymous['era']===null,'anonymous visitor follows live host era and localized fallback name');
    $anonTab2=bin2hex(random_bytes(32));
    status(200,visitorApi('POST',$presence,['token'=>$anonTab2,'browserToken'=>$anonBrowser]),'anonymous second tab');
    check(count($book()['present'])===1,'same anonymous browser deduplicates tabs');
    status(200,visitorApi('POST',$presence,['token'=>bin2hex(random_bytes(32))],$other),'another signed in visitor without towns');
    check(count($book()['present'])===2,'independent visitors coexist');
    $past=time()-10;
    $db->get()->executeStatement('UPDATE visitor_leases SET expires_at=? WHERE visit_id=?',[$past,$anonymous['id']]);
    $entries=$book();
    $expired=array_values(array_filter($entries['history'],fn($entry)=>$entry['id']===$anonymous['id']))[0];
    check(count($entries['present'])===1&&$expired['departedAt']===$past*1000,'lost connection closes at actual expiry time');
    status(200,visitorApi('PATCH',$hostPath.'/settings',['baseRevision'=>1,'name'=>'Host Harbor','isPublic'=>false],$owner),'unshare host');
    status(404,visitorApi('POST',$presence,['token'=>bin2hex(random_bytes(32))]),'unshared host rejects arrivals');
    status(404,visitorApi('GET','villages/'.$publicId.'/visitors'),'unshared host guestbook unavailable');
    check(count($book()['present'])===0,'unsharing removes all live visitors but keeps history');
    status(200,visitorApi('PATCH',$hostPath.'/settings',['baseRevision'=>1,'name'=>'Host Harbor','isPublic'=>true],$owner),'share again');
    // Paginated permanent history, independent of save revisions and saloon.
    for($i=0;$i<22;$i++) {
        $tab=bin2hex(random_bytes(32));
        status(200,visitorApi('POST',$presence,['token'=>$tab,'sequence'=>1]),'history visit '.$i);
        status(200,visitorApi('DELETE',$presence,['token'=>$tab,'sequence'=>2]),'history departure '.$i);
    }
    $first=$book();$second=$book(2);
    check(count($first['history'])===20&&$first['hasNext']&&count($second['history'])===5&&!$second['hasNext'],'all visits are paginated without truncation');
    check($publicBook(2)['history']===$second['history'],'public visit history supports later pages');
    check(count(array_intersect(array_column($first['history'],'id'),array_column($second['history'],'id')))===0,'history pages do not overlap');
    check((int)$db->get()->fetchOne('SELECT revision FROM towns WHERE id=?',[$hostId])===1,'presence never changes game save revision');
    check(!$db->get()->fetchOne('SELECT town_id FROM town_guests WHERE town_id=?',[$hostId]),'presence does not queue ordinary VIP arrivals');
    // Deleting an origin preserves history but removes its link and selection.
    status(200,visitorApi('DELETE','towns/'.$originId,['baseRevision'=>1,'confirmation'=>'New Silver'],$guest),'delete origin');
    check(status(200,visitorApi('GET','account/profile',null,$guest),'profile after origin deletion')['profile']['visitingTownId']===null,'deleted selected town falls back safely');
    $fallbackToken=bin2hex(random_bytes(32));
    status(200,visitorApi('POST',$presence,['token'=>$fallbackToken],$guest),'stale stored visiting town falls back after deletion');
    $fallback=$book()['present'][0];
    check($fallback['name']==='New Camille'&&$fallback['townName']===null&&$fallback['era']===null,'townless registered visitor uses name and current host era');
    status(200,visitorApi('DELETE',$presence,['token'=>$fallbackToken,'sequence'=>1]),'leave fallback visit');
    // Concurrent tabs must serialize on the destination and create one grouped visit.
    if(!function_exists('pcntl_fork'))throw new RuntimeException('pcntl is required');
    $tabs=[bin2hex(random_bytes(32)),bin2hex(random_bytes(32))];
    $before=(int)$db->get()->fetchOne('SELECT COUNT(*) FROM visitor_visits WHERE town_id=?',[$hostId]);
    $db->get()->close();$children=[];
    foreach($tabs as $tab) {
        $pid=pcntl_fork();
        if($pid===-1)throw new RuntimeException('Cannot fork visitor test');
        if($pid===0) {
            $database=new App\Database();$localAuth=new App\Auth($database);$localPublic=new App\PublicTown($database,$localAuth);
            $api=new App\ApiController($localAuth,new App\SaveService($database,$localAuth,$localPublic),$localPublic,$database);
            $joined=visitorApi('POST',$presence,['token'=>$tab,'sequence'=>1],$guest);
            exit($joined['status']===200&&$joined['data']['active']?0:20);
        }
        $children[]=$pid;
    }
    foreach($children as $pid){pcntl_waitpid($pid,$exit);check(pcntl_wexitstatus($exit)===0,'concurrent visitor tab succeeds');}
    check(count($book()['present'])===1&&(int)$db->get()->fetchOne('SELECT COUNT(*) FROM visitor_visits WHERE town_id=?',[$hostId])===$before+1,'simultaneous tabs produce exactly one visitor and log');
    foreach($tabs as $tab)status(200,visitorApi('DELETE',$presence,['token'=>$tab,'sequence'=>2]),'close concurrent tab');
    check($book()['present']===[],'last concurrent tab departure closes presence');
    status(200,visitorApi('DELETE',$hostPath,['baseRevision'=>1,'confirmation'=>'Host Harbor'],$owner),'delete host');
    status(404,visitorApi('GET','villages/'.$publicId.'/visitors'),'deleted guestbook unavailable');
    echo "Visitor API checks passed ($count assertions).\n";
} finally {cleanup();}
