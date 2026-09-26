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
 echo "Concurrent town-slot and revision checks passed.\n";
}finally{cleanup();}
