<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\{Request,JsonResponse};
use Symfony\Component\Routing\Attribute\Route;
final class ApiController {
    public function __construct(private Auth $auth,private SaveService $saves,private PublicTown $public,private Database $database) {}
    #[Route('/api/v1/{path}',name:'api',requirements:['path'=>'.*'])]
    public function __invoke(Request $r,string $path): JsonResponse {
        $native=false;
        try {
            $this->auth->guardHost($r);$native=$this->auth->nativeOrigin($r);
            if((int)$r->headers->get('Content-Length','0')>1100000||strlen($r->getContent())>1100000)throw new ApiError(413,'Request is too large.');
            $method=$r->getMethod();$body=[];
            if($method==='OPTIONS') {
                $this->auth->guardOrigin($r);$response=new JsonResponse(null,204);
            } else {
                if(!in_array($method,['GET','POST','PUT','PATCH','DELETE'],true))throw new ApiError(405,'Method is not allowed.');
                if($method!=='GET') {
                    $this->auth->guardOrigin($r);
                    if(strtolower(trim(explode(';',$r->headers->get('Content-Type',''))[0]))!=='application/json')throw new ApiError(415,'Use application/json.');
                    try {$object=json_decode($r->getContent(),false,64,JSON_THROW_ON_ERROR);}catch(\JsonException){throw new ApiError(400,'Invalid JSON.');}
                    if(!$object instanceof \stdClass)throw new ApiError(422,'Request must be a JSON object.');
                    $body=(array)$object;
                }
                if($r->query->count() && !($method==='GET'&&$path==='villages'&&array_keys($r->query->all())===['page']))throw new ApiError(422,'Unsupported query parameters.');
                $ip=$r->getClientIp()??'unknown';$this->auth->limit('http:'.$ip,600,60);
                if(in_array($path,['auth/login-link','auth/confirm'],true))$this->auth->limit('auth:'.$ip,30,900);
                $result=match($method.' '.$path) {
                    'GET health'=>$this->health(),
                    'POST auth/login-link'=>$this->auth->loginLink($r,$body),
                    'POST auth/confirm'=>$this->auth->confirm($r,$body),
                    'POST auth/logout'=>$this->logout($r,$body,false),
                    'POST auth/revoke-all'=>$this->logout($r,$body,true),
                    'GET account'=>$this->saves->account($r),
                    'DELETE account'=>$this->deleteAccount($r,$body),
                    'POST towns'=>$this->saves->create($r,$body),
                    'GET villages'=>$this->public->browse($r),
                    default=>$this->townRoute($r,$path,$body),
                };
                $response=$result instanceof JsonResponse?$result:new JsonResponse($result);
            }
        } catch(ApiError $e){$response=new JsonResponse(['error'=>$e->getMessage()]+$e->details,$e->status);}
        catch(\Throwable $e){error_log(json_encode(['event'=>'api_request_failed','type'=>get_class($e)]));$response=new JsonResponse(['error'=>'The save could not be completed. Your local progress is safe.'],500);}
        $response->headers->set('Cache-Control','no-store, private');$response->headers->set('X-Content-Type-Options','nosniff');$response->headers->set('Referrer-Policy','no-referrer');
        if($native){$response->headers->set('Access-Control-Allow-Origin',$r->headers->get('Origin'));$response->headers->set('Vary','Origin');$response->headers->set('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS');$response->headers->set('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token, Authorization');}
        if($response->getStatusCode()===429)$response->headers->set('Retry-After','60');
        return $response;
    }
    private function health(): array {$this->database->get()->fetchOne('SELECT 1');return ['ok'=>true];}
    private function logout(Request $r,array $b,bool $all): JsonResponse {SaveService::keys($b,[]);return $this->auth->logout($r,$all);}
    private function deleteAccount(Request $r,array $b): JsonResponse {$this->saves->deleteAccount($r,$b);return $this->auth->clearCookie();}
    private function townRoute(Request $r,string $path,array $b): mixed {
        if($r->isMethod('GET')&&preg_match('~^villages/([a-f0-9]{32})$~D',$path,$m))return $this->public->visit($r,$m[1]);
        if(!preg_match('~^towns/([a-f0-9-]{36})(?:/(resolve|history|settings))?$~D',$path,$m))throw new ApiError(404,'Endpoint not found.');
        $id=$m[1];$suffix=$m[2]??'';
        return match($r->getMethod().' '.$suffix) {
            'GET '=>$this->saves->get($r,$id), 'PUT '=>$this->saves->save($r,$id,$b),
            'PUT resolve'=>$this->saves->save($r,$id,$b,true), 'GET history'=>$this->saves->history($r,$id),
            'PATCH settings'=>$this->saves->metadata($r,$id,$b), 'DELETE '=>$this->saves->delete($r,$id,$b),
            default=>throw new ApiError(405,'Method is not allowed.'),
        };
    }
}
