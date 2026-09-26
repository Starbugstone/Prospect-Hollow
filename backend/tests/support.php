<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use App\{Auth,Database,SaveService,PublicTown,ApiController};
use Symfony\Component\HttpFoundation\Request;
$_ENV['APP_ORIGIN']='http://localhost:8094';$_ENV['APP_SECRET']=str_repeat('local-test-',4);$_ENV['MAILER_DSN']='null://null';$_ENV['MAIL_FROM']='test@localhost.test';$_ENV['NATIVE_ORIGINS']='capacitor://localhost';
$_ENV['DATABASE_URL']=getenv('TEST_DATABASE_URL')?:getenv('DATABASE_URL');
$db=new Database();$db->migrate();$auth=new Auth($db);$public=new PublicTown($db,$auth);$saves=new SaveService($db,$auth,$public);$api=new ApiController($auth,$saves,$public,$db);
$count=0;$accounts=[];
function check(bool $ok,string $label): void {global $count;$count++;if(!$ok)throw new RuntimeException($label);}
function callApi(string $method,string $path,mixed $body=null,array $session=[],array $headers=[]): array {
 global $api;
 $headers+=['HTTP_HOST'=>'localhost:8094','HTTP_ORIGIN'=>'http://localhost:8094','CONTENT_TYPE'=>'application/json','HTTP_X_CSRF_TOKEN'=>$session['csrf']??''];
 $r=Request::create('http://localhost:8094/api/v1/'.$path,$method,[],isset($session['cookie'])?['cascade_local'=>$session['cookie']]:[],[],$headers,$body===null?'':json_encode($body,JSON_THROW_ON_ERROR));
 foreach($headers as $key=>$value)if(str_starts_with($key,'HTTP_'))$r->headers->set(str_replace('_','-',substr($key,5)),$value);
 $response=$api($r,explode('?',$path)[0]);$data=json_decode($response->getContent(),true);
 return ['status'=>$response->getStatusCode(),'data'=>$data,'response'=>$response];
}
function status(int $expected,array $result,string $label): array {check($result['status']===$expected,$label.' HTTP '.$result['status'].' '.json_encode($result['data']));return $result['data'];}
function account(): array {
 global $db,$auth,$accounts;
 $email='test-'.bin2hex(random_bytes(8)).'@example.test';$token=bin2hex(random_bytes(32));
 $db->get()->insert('login_intents',['token_hash'=>$auth->hash($token),'email'=>$email,'expires_at'=>time()+900]);
 $result=callApi('POST','auth/confirm',['token'=>$token]);$data=status(200,$result,'sign in');$accounts[]=$data['account']['id'];
 $cookie=$result['response']->headers->getCookies()[0]->getValue();return ['id'=>$data['account']['id'],'cookie'=>$cookie,'csrf'=>$data['csrf'],'token'=>$token];
}
function uuid(): string { $h=bin2hex(random_bytes(16));return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-8'.substr($h,17,3).'-'.substr($h,20); }
function profile(int $coins=25): object {return (object)['schemaVersion'=>2,'records'=>(object)[],'continuousRecords'=>(object)[],'powers'=>[],'town'=>(object)['coins'=>$coins,'era'=>'frontier','buildings'=>(object)['well'=>1],'buildingEras'=>(object)['well'=>'frontier'],'buildingEraLevels'=>(object)['well'=>0]]];}
function townBody(string $name='Dustwater'): array {return ['townId'=>uuid(),'name'=>$name,'baseRevision'=>0,'uploadId'=>uuid(),'profile'=>profile()];}
function cleanup(): void {global $db,$accounts;foreach($accounts as $id)$db->get()->delete('players',['id'=>$id]);}
