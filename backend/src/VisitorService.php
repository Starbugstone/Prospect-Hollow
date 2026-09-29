<?php
declare(strict_types=1);
namespace App;

use Symfony\Component\HttpFoundation\Request;

/** Live presence is independent of save revisions, random VIPs and the economy. */
final class VisitorService {
    public const LEASE_SECONDS=45;
    private const PAGE_SIZE=20;

    public function __construct(private Database $database,private Auth $auth,private PublicTown $public) {}

    private function optionalSession(Request $r,bool $mutation=false): ?array {
        try {return $this->auth->session($r,$mutation);}
        catch(ApiError $e) {if($e->status!==401)throw $e;return null;}
    }

    public function profile(Request $r): array {
        $session=$this->optionalSession($r);
        if(!$session)return ['profile'=>null,'towns'=>[]];
        return $this->profileData($session['player_id'])+['csrf'=>$session['csrf']];
    }

    private function profileData(string $player): array {
        $db=$this->database->get();
        $profile=$db->fetchAssociative('SELECT display_name,visiting_town_id FROM player_profiles WHERE player_id=?',[$player]);
        $rows=$db->fetchAllAssociative('SELECT id,name,profile,listed,public_id FROM towns WHERE player_id=? AND deleted_at IS NULL ORDER BY saved_at DESC,id',[$player]);
        $towns=array_map(fn($row)=>['townId'=>$row['id'],'name'=>$row['name'],'era'=>$this->era(json_decode($row['profile'])->town->era??null),'isPublic'=>(bool)$row['listed'],'publicId'=>$row['listed']?$row['public_id']:null],$rows);
        $selected=$profile['visiting_town_id']??null;
        if(!in_array($selected,array_column($towns,'townId'),true))$selected=null;
        return ['profile'=>['displayName'=>$profile['display_name']??'','visitingTownId'=>$selected],'towns'=>$towns];
    }

    public function updateProfile(Request $r,array $body): array {
        SaveService::keys($body,['displayName','visitingTownId']);
        $session=$this->auth->session($r,true);
        if(!is_string($body['displayName']??null))throw new ApiError(422,'Enter a public display name.');
        $name=\Normalizer::normalize(trim($body['displayName']),\Normalizer::FORM_KC);
        $name=preg_replace('/ +/u',' ',$name);
        if($name!==''&&(!preg_match("/^[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} '\x{2019}-]{2,23}$/uD",$name)||!$this->public->guestName($name)))throw new ApiError(422,'Use a public name with 3–24 letters, numbers, spaces, apostrophes or hyphens.');
        $town=$body['visitingTownId']??null;
        if($town!==null&&(!is_string($town)||!preg_match('/^[a-f0-9-]{36}$/D',$town)))throw new ApiError(422,'Choose one of your towns.');
        $this->database->get()->transactional(function($db) use($session,$name,$town) {
            $db->fetchOne('SELECT id FROM players WHERE id=? FOR UPDATE',[$session['player_id']]);
            $this->auth->recheck($session);
            if($town!==null&&!$db->fetchOne('SELECT id FROM towns WHERE id=? AND player_id=? AND deleted_at IS NULL',[$town,$session['player_id']]))throw new ApiError(422,'Choose one of your towns.');
            $values=['display_name'=>$name,'visiting_town_id'=>$town];
            if($db->fetchOne('SELECT player_id FROM player_profiles WHERE player_id=?',[$session['player_id']]))$db->update('player_profiles',$values,['player_id'=>$session['player_id']]);
            else $db->insert('player_profiles',['player_id'=>$session['player_id']]+$values);
        });
        return $this->profileData($session['player_id']);
    }

    private function era(mixed $era): string {
        static $eras;
        $eras??=json_decode(file_get_contents(dirname(__DIR__).'/content/public-schema.json'),true,32,JSON_THROW_ON_ERROR)['eras'];
        return in_array($era,$eras,true)?$era:$eras[0];
    }

    private function token(array $body,string $key,bool $required=true): ?string {
        $value=$body[$key]??null;
        if($value===null&&!$required)return null;
        if(!is_string($value)||!preg_match('/^[a-f0-9]{64}$/D',$value))throw new ApiError(422,'Invalid visitor token.');
        return $this->auth->hash('visitor:'.$value);
    }

    public function presence(Request $r,string $publicId,array $body): array {
        $leaving=$r->isMethod('DELETE');
        SaveService::keys($body,$leaving?['token','sequence']:['token','browserToken','townId','sequence']);
        $token=$this->token($body,'token');
        $browser=$leaving?null:($this->token($body,'browserToken',false)??$token);
        $sequence=$body['sequence']??0;
        if(!is_int($sequence)||$sequence<0||$sequence>2147483647)throw new ApiError(422,'Invalid visitor sequence.');
        $session=$this->optionalSession($r,!$leaving);
        // Leaving is authorized by the unpredictable per-tab token. This also allows
        // keepalive departure after logout; it cannot close another tab's lease.
        $this->auth->limit('presence:'.($r->getClientIp()??'unknown'),180,60);
        $result=$this->database->get()->transactional(function($db) use($publicId,$session,$body,$token,$browser,$sequence,$leaving,$r) {
            // Same lock as sharing/deletion and saloon: serializes joins, heartbeats,
            // departures and owner reads without competing with unrelated towns.
            $host=$db->fetchAssociative('SELECT id,player_id,listed,deleted_at,appearance FROM towns WHERE public_id=? FOR UPDATE',[$publicId]);
            if(!$host)throw new ApiError(404,'Town unavailable.');
            $now=time();
            $this->expire($host['id'],$now,!(bool)$host['listed']||$host['deleted_at']!==null);
            $lease=$db->fetchAssociative('SELECT l.*,v.visitor_key,v.departed_at FROM visitor_leases l LEFT JOIN visitor_visits v ON v.id=l.visit_id WHERE l.token_hash=?',[$token]);
            if($lease&&$lease['town_id']!==$host['id'])throw new ApiError(409,'Start a new visit for this town.');
            if($leaving) {
                if($lease&&$sequence>=(int)$lease['sequence']) {
                    $db->update('visitor_leases',['ended'=>1,'expires_at'=>$now,'sequence'=>$sequence],['token_hash'=>$token]);
                    $this->expire($host['id'],$now);
                } elseif(!$lease) {
                    // A keepalive departure can beat the initial heartbeat over the
                    // network. Reserve its token so the delayed join stays closed.
                    $this->auth->limit('visitor-arrivals:'.($r->getClientIp()??'unknown'),60,3600);
                    $db->insert('visitor_leases',['token_hash'=>$token,'town_id'=>$host['id'],'visit_id'=>null,'ended'=>1,'expires_at'=>$now,'sequence'=>$sequence]);
                }
                return ['active'=>false,'expiresAt'=>null,'serverNow'=>$now*1000];
            }
            if(!$host['listed']||$host['deleted_at']!==null)return new ApiError(404,'Town unavailable.');
            if($session&&$session['player_id']===$host['player_id'])return ['active'=>false,'expiresAt'=>null,'serverNow'=>$now*1000];
            $key=$this->auth->hash($session?'player:'.$session['player_id']:'browser:'.$browser);
            if($lease&&$lease['visitor_key']!==null&&$lease['visitor_key']!==$key)throw new ApiError(409,'Start a new visit after changing account.');
            if($lease&&((int)$lease['ended']===1||$sequence<(int)$lease['sequence']))return ['active'=>false,'expiresAt'=>null,'serverNow'=>$now*1000];
            if($lease&&array_key_exists('sequence',$body)&&$sequence===(int)$lease['sequence']) {
                $active=$lease['departed_at']===null;
                return ['active'=>$active,'visitId'=>$active?$lease['visit_id']:null,'expiresAt'=>$active?(int)$lease['expires_at']*1000:null,'serverNow'=>$now*1000];
            }
            if($lease&&$lease['departed_at']===null) {
                $visit=$lease['visit_id'];
            } else {
                $visit=$db->fetchOne('SELECT id FROM visitor_visits WHERE town_id=? AND visitor_key=? AND departed_at IS NULL',[$host['id'],$key]);
                if(!$visit) {
                    $this->auth->limit('visitor-arrivals:'.($r->getClientIp()??'unknown'),60,3600);
                    $identity=$this->identity($session,$body['townId']??null,$host);
                    $visit=bin2hex(random_bytes(16));
                    $db->insert('visitor_visits',['id'=>$visit,'town_id'=>$host['id'],'visitor_key'=>$key]+$identity+['arrived_at'=>$now,'last_seen_at'=>$now,'departed_at'=>null]);
                }
            }
            $values=['town_id'=>$host['id'],'visit_id'=>$visit,'sequence'=>$sequence,'expires_at'=>$now+self::LEASE_SECONDS,'ended'=>0];
            if($lease)$db->update('visitor_leases',$values,['token_hash'=>$token]);
            else $db->insert('visitor_leases',['token_hash'=>$token]+$values);
            $db->update('visitor_visits',['last_seen_at'=>$now],['id'=>$visit]);
            return ['active'=>true,'visitId'=>$visit,'expiresAt'=>($now+self::LEASE_SECONDS)*1000,'serverNow'=>$now*1000];
        });
        if($result instanceof ApiError)throw $result;
        return $result;
    }

    private function identity(?array $session,mixed $selected,array $host): array {
        $identity=['name'=>'','origin_town_id'=>null,'town_name'=>null,'era'=>$this->era(json_decode($host['appearance'])->era??null)];
        if(!$session)return $identity;
        $db=$this->database->get();
        $profile=$db->fetchAssociative('SELECT display_name,visiting_town_id FROM player_profiles WHERE player_id=?',[$session['player_id']]);
        if($profile&&$profile['display_name']!=='')$identity['name']=$profile['display_name'];
        if($selected!==null&&(!is_string($selected)||!preg_match('/^[a-f0-9-]{36}$/D',$selected)))throw new ApiError(422,'Choose one of your towns.');
        $explicit=$selected!==null;
        $selected??=$profile['visiting_town_id']??null;
        $rows=$db->fetchAllAssociative('SELECT id,name,profile FROM towns WHERE player_id=? AND deleted_at IS NULL ORDER BY listed DESC,saved_at DESC,id',[$session['player_id']]);
        if($selected!==null) {
            $chosen=array_values(array_filter($rows,fn($row)=>$row['id']===$selected));
            if(!$chosen&&$explicit)throw new ApiError(422,'Choose one of your towns.');
            if($chosen)$rows=$chosen;
        }
        foreach($rows as $town) {
            $name=$this->public->guestName($town['name']);
            if(!$name)continue;
            $identity['origin_town_id']=$town['id'];
            $identity['town_name']=$name;
            $identity['era']=$this->era(json_decode($town['profile'])->town->era??null);
            break;
        }
        return $identity;
    }

    /** Close stale visits at their last live lease expiry, not the time of this read. */
    private function expire(string $town,int $now,bool $all=false): void {
        $db=$this->database->get();
        $rows=$db->fetchAllAssociative('SELECT v.id,MAX(l.expires_at) AS expires_at FROM visitor_visits v LEFT JOIN visitor_leases l ON l.visit_id=v.id WHERE v.town_id=? AND v.departed_at IS NULL GROUP BY v.id',[$town]);
        foreach($rows as $row)if($all||(int)$row['expires_at']<=$now) {
            $db->update('visitor_visits',['departed_at'=>min($now,(int)$row['expires_at'])],['id'=>$row['id']]);
            if($all)$db->update('visitor_leases',['ended'=>1,'expires_at'=>$now],['visit_id'=>$row['id']]);
        }
    }

    public function visitors(Request $r,string $town): array {
        $session=$this->auth->session($r);
        return $this->guestbook($r,$town,$session['player_id']);
    }

    public function publicGuestbook(Request $r,string $publicId): array {
        return $this->guestbook($r,$publicId,null);
    }

    private function guestbook(Request $r,string $id,?string $owner): array {
        $page=filter_var($r->query->get('page','1'),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>1000000]]);
        if(!$page)throw new ApiError(422,'Invalid page.');
        return $this->database->get()->transactional(function($db) use($id,$owner,$page) {
            $host=$owner===null
                ?$db->fetchAssociative('SELECT id,listed FROM towns WHERE public_id=? AND listed=1 AND deleted_at IS NULL FOR UPDATE',[$id])
                :$db->fetchAssociative('SELECT id,listed FROM towns WHERE id=? AND player_id=? AND deleted_at IS NULL FOR UPDATE',[$id,$owner]);
            if(!$host)throw new ApiError(404,'Town unavailable.');
            $town=$host['id'];
            $now=time();$this->expire($town,$now,!(bool)$host['listed']);
            $select='SELECT v.*,t.public_id,t.listed,t.deleted_at FROM visitor_visits v LEFT JOIN towns t ON t.id=v.origin_town_id WHERE v.town_id=?';
            $present=$db->fetchAllAssociative($select.' AND v.departed_at IS NULL ORDER BY v.arrived_at DESC,v.id DESC',[$town]);
            $history=$db->fetchAllAssociative($select.' ORDER BY v.arrived_at DESC,v.id DESC LIMIT '.(self::PAGE_SIZE+1).' OFFSET '.(($page-1)*self::PAGE_SIZE),[$town]);
            $project=fn($row)=>['id'=>$row['id'],'name'=>$row['name'],'townName'=>$row['town_name'],'era'=>$row['era'],'publicId'=>$row['listed']&&$row['deleted_at']===null?$row['public_id']:null,'arrivedAt'=>(int)$row['arrived_at']*1000,'lastSeenAt'=>(int)$row['last_seen_at']*1000,'departedAt'=>$row['departed_at']===null?null:(int)$row['departed_at']*1000];
            $result=['present'=>array_map(fn($row)=>array_replace($project($row),['era'=>$row['town_name']===null?null:$row['era']]),$present),'history'=>array_map($project,array_slice($history,0,self::PAGE_SIZE)),'page'=>$page,'hasNext'=>count($history)>self::PAGE_SIZE,'serverNow'=>$now*1000];
            if($owner!==null)$result['saloonCollectedAt']=(int)$db->fetchOne('SELECT collected_at FROM saloon_collections WHERE town_id=?',[$town])*1000;
            return $result;
        });
    }
}
