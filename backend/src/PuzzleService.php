<?php
declare(strict_types=1);
namespace App;

/** Called only inside ProfileService's transaction holding the player row lock. */
final class PuzzleService {
    private PuzzleEngine $engine;
    public function __construct(private Database $database,private Content $content,private TownService $town) { $this->engine=new PuzzleEngine(); }
    public function publicState(array $state,string $id): array {
        $public=array_intersect_key($state,array_flip(['status','level','mode','board','tiles','cols','rows','score','moves','jewels','remainingLayers','totalLayers','remainingRelics','totalRelics','oreOrders','maxCascade','comboCounts','multiMatchCounts','cleared','startedAt','expiresAt','steps','receipt','shuffled']));
        $public['runId']=$id;
        foreach(['comboCounts','multiMatchCounts'] as $key)$public[$key]=(object)$public[$key];
        return $public;
    }
    public function action(string $playerId,array &$profile,string $type,array $args): array {
        $allowed=match($type){'run.start'=>['level','mode'],'run.move'=>['runId','a','b','activate'],'run.power'=>['runId','power','index'],'run.abandon','run.resume'=>['runId'],default=>throw new ApiError(422,'Unknown run command.')};
        ProfileService::keys($args,$allowed);$db=$this->database->get();$now=time();
        if($type==='run.start') {
            $levelId=ProfileService::integer($args['level']??null,1,count($this->content->data['levels']));
            $mode=$args['mode']??null;if(!in_array($mode,['normal','continuous'],true))throw new ApiError(422,'Unknown game mode.');
            $next=1;while(isset($profile['records'][$next])&&$next<count($this->content->data['levels']))$next++;
            if($levelId>$next)throw new ApiError(422,'Complete the preceding mine first.');
            if(($mode==='continuous'||isset($profile['records'][$levelId]))&&($profile['town']['buildings']['museum']??0)<1)throw new ApiError(422,'Build the museum to replay a mine.');
            $active=$db->fetchAssociative("SELECT * FROM runs WHERE player_id=? AND status='active'",[$playerId]);
            if($active&&(int)$active['expires_at']>$now) {
                $state=json_decode($active['state'],true,512,JSON_THROW_ON_ERROR);
                if($state['level']!==$levelId||$state['mode']!==$mode)throw new ApiError(409,'Resume or abandon your current mine before starting another.');
                $state['steps']=[];return $this->publicState($state,$active['id']);
            }
            if($active)$db->update('runs',['status'=>'expired'],['id'=>$active['id']]);
            $state=$this->engine->initial($this->content->level($levelId),$mode);$state['expiresAt']=$now+86400;$state['contentVersion']=$this->content->data['version'];
            $id=bin2hex(random_bytes(16));$profile['issuedRun']++;
            $db->insert('runs',['id'=>$id,'player_id'=>$playerId,'status'=>'active','state'=>json_encode($state,JSON_THROW_ON_ERROR),'created_at'=>$now,'expires_at'=>$state['expiresAt']]);
            return $this->publicState($state,$id);
        }
        $id=$args['runId']??null;
        if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(422,'Invalid run ID.');
        // Ownership is part of the SQL predicate; another player's snapshot is never disclosed.
        $row=$db->fetchAssociative('SELECT * FROM runs WHERE id=? AND player_id=?',[$id,$playerId]);
        if(!$row)throw new ApiError(404,'Mine run not found.');
        if((int)$row['expires_at']<=$now)throw new ApiError(409,'This mine run expired. Start a new run.');
        $state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);$state['steps']=[];$state['shuffled']=false;
        if($type==='run.resume')return $this->publicState($state,$id);
        if($row['status']!=='active')throw new ApiError(409,'This mine run has already ended.');
        if($type==='run.abandon')$state['status']='abandoned';
        else {
            if(($state['contentVersion']??null)!==$this->content->data['version'])throw new ApiError(409,'Game rules changed. Abandon this run and start a new one.');
            if($type==='run.move') {
                $a=ProfileService::integer($args['a']??null,0,count($state['board'])-1);
                $activate=$args['activate']??false;if(!is_bool($activate))throw new ApiError(422,'Invalid activation flag.');
                $b=ProfileService::integer($args['b']??($activate?$a:null),0,count($state['board'])-1);
                if($activate&&$a!==$b)throw new ApiError(422,'Activation must target a single tile.');
                $this->engine->move($state,$a,$b,$activate);
            } else {
                $power=$args['power']??null;if(!is_string($power)||!in_array($power,['shuffle','clear-row','tnt','color-wand','tile-breaker'],true))throw new ApiError(422,'Unknown power.');
                $index=array_key_exists('index',$args)?ProfileService::integer($args['index'],0,count($state['board'])-1):null;
                if($power==='shuffle'&&$index!==null)throw new ApiError(422,'Shuffle does not take a tile.');
                // Consumption and board mutation roll back together on any exception.
                $this->town->consume($profile,$power);$this->engine->power($state,$power,$index);
            }
            if($state['mode']==='continuous') {
                $previous=$profile['continuousRecords'][$state['level']]??['coins'=>0,'score'=>0];
                $earned=min(25,intdiv($state['jewels'],10)*(1+intdiv($state['level']-1,6)));
                $delta=min(max(0,25-$previous['coins']),max(0,$earned-$state['continuousCoins']));
                $state['continuousCoins']=max($state['continuousCoins'],$earned);$profile['town']['coins']+=$delta;
                $profile['continuousRecords'][$state['level']]=['coins'=>$previous['coins']+$delta,'score'=>max($previous['score'],$state['score'])];
            } elseif($state['cleared']) {
                $state['status']='completed';$state['receipt']=$this->town->victory($profile,$state,$id);
            }
        }
        $public=$this->publicState($state,$id);
        // Animation is response-only, not durable authority; reconnect uses the final snapshot.
        $state['steps']=[];$state['shuffled']=false;
        $db->update('runs',['state'=>json_encode($state,JSON_THROW_ON_ERROR),'status'=>$state['status']],['id'=>$id,'player_id'=>$playerId]);
        return $public;
    }
}
