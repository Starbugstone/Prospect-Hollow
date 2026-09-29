<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\{Request, Cookie, JsonResponse};
use Symfony\Component\Mailer\{Mailer, Transport};
use Symfony\Component\Mime\Email;
final class Auth {
    public function __construct(private Database $database) {}
    public function origin(): string {
        $origin=Env::get('APP_ORIGIN');
        if (!is_string($origin) || !preg_match('~^https?://[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$~D',$origin)) throw new \RuntimeException('APP_ORIGIN must be an exact origin.');
        if (!str_starts_with($origin,'https://') && !preg_match('~^http://(localhost|127\.0\.0\.1)(:\d+)?$~D',$origin)) throw new \RuntimeException('HTTPS is required.');
        $port=parse_url($origin,PHP_URL_PORT);
        if ($port!==null && ($port<1 || $port>65535)) throw new \RuntimeException('Invalid origin port.');
        return $origin;
    }
    private function secret(): string {
        $secret=Env::get('APP_SECRET');
        if (!is_string($secret) || strlen($secret)<32) throw new \RuntimeException('APP_SECRET must be at least 32 bytes.');
        return $secret;
    }
    public function cookieName(): string { return str_starts_with($this->origin(),'https:') ? '__Host-cascade' : 'cascade_local'; }
    public function hash(string $value): string { return hash_hmac('sha256',$value,$this->secret()); }
    public function guardHost(Request $r): void {
        $origin=$this->origin();
        if (strtolower($r->getHost())!==strtolower(parse_url($origin,PHP_URL_HOST)) || $r->getPort()!==(parse_url($origin,PHP_URL_PORT) ?? (str_starts_with($origin,'https:') ? 443 : 80))) throw new ApiError(400,'Request host is not allowed.');
        if (str_starts_with($origin,'https:') && !$r->isSecure()) throw new ApiError(400,'HTTPS is required.');
    }
    public function nativeOrigin(Request $r): bool {
        $allowed=array_filter(explode(',',Env::get('NATIVE_ORIGINS')?:''));
        return in_array($r->headers->get('Origin'),$allowed,true);
    }
    public function guardOrigin(Request $r): void {
        if ($r->headers->get('Origin')!==$this->origin() && !$this->nativeOrigin($r)) throw new ApiError(403,'Request origin is not allowed.');
        if ($r->headers->get('Sec-Fetch-Site')==='cross-site' && !$this->nativeOrigin($r)) throw new ApiError(403,'Cross-site request rejected.');
    }
    public function session(Request $r, bool $mutation=false): array {
        $bearer=$r->headers->get('Authorization','');
        $token=str_starts_with($bearer,'Bearer ')?substr($bearer,7):$r->cookies->get($this->cookieName(),'');
        if(str_starts_with($bearer,'Bearer ')&&!$this->nativeOrigin($r)) throw new ApiError(403,'Token transport requires an allowed app origin.');
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D',$token)) throw new ApiError(401,'Please sign in again.');
        $session=$this->database->get()->fetchAssociative('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',[$this->hash($token),time()]);
        if (!$session) throw new ApiError(401,'Please sign in again.');
        if ($mutation && !hash_equals($session['csrf_hash'],$this->hash($r->headers->get('X-CSRF-Token','')))) throw new ApiError(403,'Refresh this page before trying again.');
        $session['csrf']=$this->hash('csrf:'.$token);
        $this->touch($r,$session['player_id'],str_starts_with($bearer,'Bearer '));
        return $session;
    }
    // Admin-only record of the player's latest connection: minute precision, the last IP
    // and browser only, plus one row per active day. It must never block a request.
    private function touch(Request $r,string $player,bool $native,bool $signIn=false): void {
        $db=$this->database->get();
        if($db->isTransactionActive())return;
        try {
            $mysql=$this->database->isMySql();
            $agent=substr(preg_replace('/[^\x20-\x7E]/','',(string)$r->headers->get('User-Agent','')),0,255);
            $now=time();
            $row=[$player,$signIn?$now:intdiv($now,60)*60,substr($r->getClientIp()??'',0,45)?:null,$agent?:null,$native?'app':'web',$signIn?$now:null,$signIn?1:0];
            $sql='INSERT INTO player_activity(player_id,seen_at,ip,agent,platform,signed_in_at,sign_ins) VALUES (?,?,?,?,?,?,?) ';
            if($mysql)$sql.='ON DUPLICATE KEY UPDATE seen_at=VALUES(seen_at),ip=VALUES(ip),agent=VALUES(agent),platform=VALUES(platform)'.($signIn?',signed_in_at=VALUES(signed_in_at),sign_ins=sign_ins+1':'');
            else $sql.='ON CONFLICT(player_id) DO UPDATE SET seen_at=EXCLUDED.seen_at,ip=EXCLUDED.ip,agent=EXCLUDED.agent,platform=EXCLUDED.platform'.($signIn?',signed_in_at=EXCLUDED.signed_in_at,sign_ins=player_activity.sign_ins+1':' WHERE (player_activity.seen_at,player_activity.ip,player_activity.agent,player_activity.platform) IS DISTINCT FROM (EXCLUDED.seen_at,EXCLUDED.ip,EXCLUDED.agent,EXCLUDED.platform)');
            // Unchanged within the same minute: no write, so the day is already recorded.
            if(!$db->executeStatement($sql,$row))return;
            $db->executeStatement($mysql?'INSERT INTO activity_days(day,player_id) VALUES (?,?) ON DUPLICATE KEY UPDATE day=day':'INSERT INTO activity_days(day,player_id) VALUES (?,?) ON CONFLICT DO NOTHING',[intdiv($now,86400),$player]);
        } catch(\Throwable $e) { error_log(json_encode(['event'=>'activity_not_recorded','type'=>get_class($e)])); }
    }
    /** Call only after taking the player row lock, inside the same transaction. */
    public function recheck(array $session): void {
        if (!$this->database->get()->fetchOne('SELECT token_hash FROM sessions WHERE token_hash=? AND player_id=? AND expires_at>? FOR UPDATE',[$session['token_hash'],$session['player_id'],time()])) throw new ApiError(401,'Please sign in again.');
    }
    private function issue(string $player,bool $native=false): JsonResponse {
        $token=bin2hex(random_bytes(32)); $csrf=$this->hash('csrf:'.$token);
        $this->database->get()->insert('sessions',['token_hash'=>$this->hash($token),'player_id'=>$player,'csrf_hash'=>$this->hash($csrf),'created_at'=>time(),'expires_at'=>time()+2592000]);
        $r=new JsonResponse(['csrf'=>$csrf,'account'=>['id'=>$player]]+($native?['token'=>$token]:[]));
        $r->headers->setCookie(Cookie::create($this->cookieName(),$token)->withPath('/')->withSecure(str_starts_with($this->origin(),'https:'))->withHttpOnly(true)->withSameSite('strict')->withExpires(time()+2592000));
        return $r;
    }
    public function loginLink(Request $r,array $body): array {
        SaveService::keys($body,['email']);
        $email=is_string($body['email']??null)?strtolower(trim($body['email'])):'';
        if(strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)) throw new ApiError(422,'Enter a valid email address.');
        $this->limit('email:'.$email,5,3600);
        $token=bin2hex(random_bytes(32)); $db=$this->database->get();
        $db->insert('login_intents',['token_hash'=>$this->hash($token),'email'=>$email,'expires_at'=>time()+900]);
        $link=$this->origin().'/#login='.$token;
        try {
            $mailer=new Mailer(Transport::fromDsn(Env::get('MAILER_DSN')));
            $mailer->send((new Email())->from(Env::get('MAIL_FROM'))->to($email)->subject('Your Prospect Hollow sign-in link')->text("Confirm your sign-in within 15 minutes:\n\n".$link."\n\nOn mobile, paste this link into the game's account screen. If you did not request it, ignore this email."));
        } catch (\Throwable) { $db->delete('login_intents',['token_hash'=>$this->hash($token)]); error_log('mail_delivery_failed'); }
        return ['message'=>'If delivery is possible, a sign-in link is on its way.'];
    }
    public function confirm(Request $r,array $body): JsonResponse {
        SaveService::keys($body,['token','native']);
        if(!is_string($body['token']??null)||!preg_match('/^[a-f0-9]{64}$/D',$body['token'])|| (isset($body['native'])&&!is_bool($body['native']))) throw new ApiError(422,'Invalid sign-in link.');
        if(($body['native']??false)&&!$this->nativeOrigin($r)) throw new ApiError(403,'Native transport requires an allowed app origin.');
        $db=$this->database->get(); $hash=$this->hash($body['token']);
        $intent=$db->fetchAssociative('SELECT * FROM login_intents WHERE token_hash=?',[$hash]);
        if(!$intent||(int)$intent['expires_at']<=time()) throw new ApiError(401,'This link has expired or was already used.');
        $id=null;
        $response=$db->transactional(function() use($db,$r,$body,$hash,$intent,&$id) {
            $emailHash=$this->hash('identity:'.$intent['email']);
            $mysql=$this->database->isMySql();
            $db->executeStatement($mysql?'INSERT INTO identities(email_hash) VALUES (?) ON DUPLICATE KEY UPDATE email_hash=VALUES(email_hash)':'INSERT INTO identities(email_hash) VALUES (?) ON CONFLICT(email_hash) DO NOTHING',[$emailHash]);
            $db->fetchOne('SELECT email_hash FROM identities WHERE email_hash=? FOR UPDATE',[$emailHash]);
            $live=$db->fetchAssociative('SELECT * FROM login_intents WHERE token_hash=? FOR UPDATE',[$hash]);
            if(!$live||(int)$live['expires_at']<=time()) throw new ApiError(401,'This link has expired or was already used.');
            $id=$db->fetchOne('SELECT id FROM players WHERE email=?',[$intent['email']]);
            if(!$id) { $id=bin2hex(random_bytes(16)); $db->insert('players',['id'=>$id,'email'=>$intent['email'],'created_at'=>time()]); }
            $db->delete('login_intents',['token_hash'=>$hash]);
            return $this->issue($id,$body['native']??false);
        });
        $this->touch($r,$id,$body['native']??false,true);
        return $response;
    }
    public function clearCookie(): JsonResponse {
        $response=new JsonResponse(['ok'=>true]);
        $response->headers->clearCookie($this->cookieName(),'/',null,str_starts_with($this->origin(),'https:'),true,'strict');
        return $response;
    }
    public function logout(Request $r,bool $all=false): JsonResponse {
        $s=$this->session($r,true); $db=$this->database->get();
        $db->transactional(function() use($db,$s,$all) {
            $row=$db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE',[$s['player_id']]);
            if (!$row) throw new ApiError(401,'Please sign in again.');
            $this->recheck($s);
            $db->delete('sessions',$all ? ['player_id'=>$s['player_id']] : ['token_hash'=>$s['token_hash']]);

            if ($all && $row['email']) $db->delete('login_intents',['email'=>$row['email']]);
        });
        return $this->clearCookie();
    }
    public function limit(string $key,int $max,int $seconds): void {
        $db=$this->database->get(); $bucket=$this->hash($key.':'.intdiv(time(),$seconds));
        $sql=$this->database->isMySql()
            ? 'INSERT INTO limits(bucket,hits,until_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1'
            : 'INSERT INTO limits(bucket,hits,until_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=limits.hits+1';
        $db->executeStatement($sql,[$bucket,time()+$seconds]);
        if ((int)$db->fetchOne('SELECT hits FROM limits WHERE bucket=?',[$bucket])>$max) throw new ApiError(429,'Too many requests. Please wait and try again.');
    }
}
