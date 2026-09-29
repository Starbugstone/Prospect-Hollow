<?php
require __DIR__.'/support.php';
if(!function_exists('pcntl_fork'))throw new RuntimeException('pcntl is required');
try {
 $a=account();status(200,callApi('POST','towns',townBody('First Town'),$a),'first');status(200,callApi('POST','towns',townBody('Second Town'),$a),'second');
 // Close inherited connections; each fork opens its own connection and controller.
 $db->get()->close();$children=[];
 foreach(['Third Town','Fourth Town'] as $name) {
  $pid=pcntl_fork();if($pid===0){$database=new App\Database();$auth2=new App\Auth($database);$pub=new App\PublicTown($database,$auth2);$api=new App\ApiController($auth2,new App\SaveService($database,$auth2,$pub),$pub,$database);$result=callApi('POST','towns',townBody($name),$a);exit($result['status']===200?0:($result['status']===409?10:20));}$children[]=$pid;
 }
 $codes=[];foreach($children as $pid){pcntl_waitpid($pid,$exit);$codes[]=pcntl_wexitstatus($exit);}sort($codes);check($codes===[0,10],'concurrent attachments enforce three slots');
 $towns=status(200,callApi('GET','account',null,$a),'list')['towns'];$id=$towns[0]['townId'];$db->get()->close();$children=[];
 foreach([11,12] as $coins){$pid=pcntl_fork();if($pid===0){$database=new App\Database();$auth2=new App\Auth($database);$pub=new App\PublicTown($database,$auth2);$api=new App\ApiController($auth2,new App\SaveService($database,$auth2,$pub),$pub,$database);$result=callApi('PUT','towns/'.$id,['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>profile($coins)],$a);exit($result['status']===200?0:($result['status']===409?10:20));}$children[]=$pid;}
 $codes=[];foreach($children as $pid){pcntl_waitpid($pid,$exit);$codes[]=pcntl_wexitstatus($exit);}sort($codes);check($codes===[0,10],'concurrent save compare-and-swap');
 // Two tabs saving distinct town UUIDs must both succeed for the same account.
 $db->get()->close();$children=[];
 foreach(array_slice($towns,1,2) as $index=>$town) {
  $pid=pcntl_fork();if($pid===0){$database=new App\Database();$auth2=new App\Auth($database);$pub=new App\PublicTown($database,$auth2);$api=new App\ApiController($auth2,new App\SaveService($database,$auth2,$pub),$pub,$database);$result=callApi('PUT','towns/'.$town['townId'],['baseRevision'=>1,'uploadId'=>uuid(),'profile'=>profile(100+$index)],$a);exit($result['status']===200?0:20);}$children[]=$pid;
 }
 foreach($children as $pid){pcntl_waitpid($pid,$exit);check(pcntl_wexitstatus($exit)===0,'different-town concurrent save succeeds');}
 foreach(array_slice($towns,1,2) as $index=>$town){$saved=status(200,callApi('GET','towns/'.$town['townId'],null,$a),'read isolated town');check($saved['profile']['town']['coins']===100+$index && $saved['revision']===2,'UUID selects the correct independent save');}
 // Two visitors tapping one shared saloon at the same moment: the row lock lets exactly one collect.
 $bar=$towns[1];$saloon=profile(40);$saloon->town->buildings->saloon=1;
 status(200,callApi('PUT','towns/'.$bar['townId'],['baseRevision'=>2,'uploadId'=>uuid(),'profile'=>$saloon],$a),'build saloon');
 $shared=status(200,callApi('PATCH','towns/'.$bar['townId'].'/settings',['baseRevision'=>3,'name'=>$bar['name'],'isPublic'=>true],$a),'share saloon')['publicId'];
 $db->get()->close();$children=[];
 foreach([1,2] as $visitor) {
  $pid=pcntl_fork();if($pid===0){$database=new App\Database();$auth2=new App\Auth($database);$pub=new App\PublicTown($database,$auth2);$api=new App\ApiController($auth2,new App\SaveService($database,$auth2,$pub),$pub,$database);$result=callApi('POST','villages/'.$shared.'/saloon',(object)[]);exit($result['status']===200?0:($result['status']===409&&($result['data']['code']??'')==='saloon_resting'?10:20));}$children[]=$pid;
 }
 $codes=[];foreach($children as $pid){pcntl_waitpid($pid,$exit);$codes[]=pcntl_wexitstatus($exit);}sort($codes);check($codes===[0,10],'concurrent saloon taps collect once');
 check((int)$db->get()->fetchOne('SELECT COUNT(*) FROM saloon_collections WHERE town_id=?',[$bar['townId']])===1,'one saloon collection recorded');
 echo "Concurrent town-slot and revision checks passed.\n";
}finally{cleanup();}
