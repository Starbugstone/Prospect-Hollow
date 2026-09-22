<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\Request;
final class ProfileService {
    public function __construct(private Database $database,private Auth $auth,private TownService $town,private PuzzleService $puzzle,private Content $content,private CommunityService $community) {}
    public function view(array $row): array {
        $p=$this->content->hydrate(json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR));
        // Display accrued income using server time; persistence happens on the next command.
        $this->town->accrue($p);
        // JavaScript distinguishes dictionaries from arrays, including empty dictionaries.
        foreach (['records','continuousRecords'] as $key) $p[$key]=(object)$p[$key];
        foreach (['projects','events','eraTransitionSeen','presentations'] as $key) $p['town'][$key]=(object)($p['town'][$key] ?? []);
        $p['town']['incomeRate']=$this->town->incomeRate($p['town']);
        return ['contentVersion'=>$this->content->data['version'],'playerId'=>$row['id'],'linked'=>(bool)$row['email'],'locale'=>$row['locale'],'revision'=>(int)$row['revision'],'savedAt'=>(int)$row['saved_at'],'profile'=>$p];
    }
    public function get(Request $r): array {
        $s=$this->auth->session($r); $db=$this->database->get();
        return $db->transactional(function() use($db,$s) {
            // A coherent snapshot of profile and active run, also ordered against deletion.
            $row=$db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE',[$s['player_id']]);
            if (!$row) throw new ApiError(401,'Please sign in again.');
            $this->auth->recheck($s);
            $result=$this->view($row); $result['csrf']=$s['csrf'];
            $run=$db->fetchAssociative("SELECT id,state,expires_at FROM runs WHERE player_id=? AND status='active' AND expires_at>?",[$row['id'],time()]);
            $result['run']=$run ? $this->puzzle->publicState(json_decode($run['state'],true,512,JSON_THROW_ON_ERROR),$run['id']) : null;
            return $result;
        });
    }
    public function delete(Request $r,array $body): void {
        self::keys($body,['confirmation']);
        if (($body['confirmation']??null)!=='DELETE MY ACCOUNT') throw new ApiError(422,'Confirm account deletion by typing DELETE MY ACCOUNT.');
        $s=$this->auth->session($r,true); $db=$this->database->get();
        $db->transactional(function() use($db,$s) {
            $row=$db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE',[$s['player_id']]);
            if (!$row) throw new ApiError(401,'Please sign in again.');
            $this->auth->recheck($s);
            $db->delete('login_intents',['guest_id'=>$row['id']]);
            if ($row['email']) $db->delete('login_intents',['email'=>$row['email']]);
            $db->delete('players',['id'=>$row['id']]);
        });
    }
    public static function fingerprint(array $body): string {
        $canonical=function(mixed $value) use(&$canonical): mixed {
            if (!is_array($value)) return $value;
            if (!array_is_list($value)) ksort($value,SORT_STRING);
            foreach($value as $key=>$entry) $value[$key]=$canonical($entry);
            return $value;
        };
        return hash('sha256',json_encode($canonical($body),JSON_THROW_ON_ERROR|JSON_PRESERVE_ZERO_FRACTION));
    }
    public function action(Request $r,array $body): array {
        self::keys($body,['actionId','revision','type','args']);
        $id=$body['actionId']??null;
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$id)) throw new ApiError(422,'A unique action ID is required.');
        if (!is_int($body['revision']??null) || $body['revision']<0 || (!is_string($body['type']??null) || !preg_match('/^[a-z][a-zA-Z.-]{0,63}$/D',$body['type'])) || (!is_array($body['args']??null) || ($body['args']!==[] && array_is_list($body['args'])))) throw new ApiError(422,'Invalid command.');
        $s=$this->auth->session($r,true);
        // Bind queued browser intentions to their account across shared-cookie tab changes.
        $expectedPlayer=$r->headers->get('X-Player-Id');
        if ($expectedPlayer!==null && !hash_equals($s['player_id'],$expectedPlayer)) throw new ApiError(409,'The signed-in account changed. Reconnect before making another move.');
        $this->auth->limit('player:'.$s['player_id'],240,60);
        $db=$this->database->get(); $fingerprint=self::fingerprint($body);
        $expectedContent=$r->headers->get('X-Content-Version');
        return $db->transactional(function() use($db,$s,$body,$id,$fingerprint,$expectedContent) {
            $row=$db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE',[$s['player_id']]);
            if (!$row) throw new ApiError(401,'Please sign in again.');
            $this->auth->recheck($s);
            $receipt=$db->fetchAssociative('SELECT * FROM actions WHERE player_id=? AND action_id=?',[$row['id'],$id]);
            if ($receipt) {
                if (!hash_equals($receipt['fingerprint'],$fingerprint)) throw new ApiError(409,'This action ID was already used for different content.');
                return (array)json_decode($receipt['response'],false,512,JSON_THROW_ON_ERROR);
            }
            // Historical receipts stay recoverable after a content deployment.
            if ($expectedContent!==null && !hash_equals($this->content->data['version'],$expectedContent)) throw new ApiError(409,'Game rules changed. Reload the page before making another move.');
            if ((int)$row['revision']!==$body['revision']) throw new ApiError(409,'Your village changed on another device. Refresh and try again.');
            $p=$this->content->hydrate(json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR)); $before=$this->economy($p);
            $this->town->accrue($p);
            $type=$body['type']; $args=$body['args']; $runResult=null;
            if (str_starts_with($type,'run.')) $runResult=$this->puzzle->action($row['id'],$p,$type,$args);
            elseif ($type==='preferences') {
                self::keys($args,['locale']);
                if (!in_array($args['locale']??null,['en','fr'],true)) throw new ApiError(422,'Choose English or French.');
                $row['locale']=$args['locale'];
            } elseif ($type==='community.preferences') {
                $this->community->preferences($p,$args,(bool)$row['email']);
            } elseif ($type==='import') {
                // Editable local saves cannot establish authoritative balances or unlocks.
                // Keep the device copy; use local-demo mode to continue it.
                throw new ApiError(422,'Local saves are unverified. Keep playing that copy in local demo mode, or start a separate cloud village.');
            } else $this->town->action($p,$type,$args);
            self::invariants($p);
            $row['profile']=json_encode($p,JSON_THROW_ON_ERROR);
            if (strlen($row['profile'])>1048576) throw new ApiError(422,'Village storage limit reached.');
            $row['revision']=(int)$row['revision']+1; $row['saved_at']=time();
            $db->update('players',['profile'=>$row['profile'],'revision'=>$row['revision'],'saved_at'=>$row['saved_at'],'locale'=>$row['locale']],['id'=>$row['id']]);
            if($type==='community.preferences'||str_starts_with($type,'town.')||($runResult['cleared']??false))$this->community->sync($row['id'],$p,(bool)$row['email']);
            $result=$this->view($row); $result['actionId']=$id; $result['run']=$runResult;
            $db->insert('actions',['player_id'=>$row['id'],'action_id'=>$id,'fingerprint'=>$fingerprint,'response'=>json_encode($result,JSON_THROW_ON_ERROR),'created_at'=>time()]);
            $db->insert('ledger',['player_id'=>$row['id'],'action_id'=>$id,'reason'=>$type,'before_state'=>json_encode($before),'after_state'=>json_encode($this->economy($p)),'created_at'=>time()]);
            return $result;
        });
    }
    private function economy(array $p): array { return ['coins'=>$p['town']['coins'],'powers'=>$p['powers'],'hammers'=>$p['builderHammers']]; }
    public static function keys(array $value,array $allowed): void {
        if (($value!==[] && array_is_list($value)) || array_diff(array_keys($value),$allowed)) throw new ApiError(422,'Unexpected command field.');
    }
    public static function integer(mixed $v,int $min,int $max): int {
        if (!is_int($v) || $v<$min || $v>$max) throw new ApiError(422,'Invalid integer.'); return $v;
    }
    public static function invariants(array $p): void {
        self::integer($p['town']['coins'],0,1000000000); self::integer($p['builderHammers'],0,5);
        foreach($p['powers'] as $power) self::integer($power['quantity'],0,100);
    }
}
