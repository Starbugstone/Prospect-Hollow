<?php
declare(strict_types=1);
$origin=getenv('TEST_HTTP_ORIGIN');
if(!$origin||!preg_match('~^http://(localhost|127\\.0\\.0\\.1):[0-9]+$~D',$origin))exit(2);
function testHttp(string $method,string $path,int $expected,string $body='',array $extra=[]): void {
 global $origin;
 $headers=array_merge(['Content-Type: application/json','Origin: '.$origin],$extra);
 $context=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body,'ignore_errors'=>true,'timeout'=>15]]);
 file_get_contents($origin.'/api/v1/'.$path,false,$context);
 preg_match('/\s(\d{3})\s/',$http_response_header[0],$m);
 if((int)$m[1]!==$expected)throw new RuntimeException($path.' returned '.$m[1]);
}
testHttp('GET','health',200);testHttp('GET','account',401);testHttp('POST','guests',404,'{}');testHttp('POST','actions',404,'{}');testHttp('POST','auth/login-link',422,'{}');testHttp('GET','towns/00000000-0000-4000-8000-000000000000',401);testHttp('POST','auth/confirm',401,'{"token":"'.str_repeat('a',64).'"}');testHttp('POST','towns',413,str_repeat(' ',1100001));
echo "Packaged HTTP routing, authentication and body limits passed.\n";
