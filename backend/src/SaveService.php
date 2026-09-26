<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\Request;

/** Account-owned snapshots. Gameplay rules deliberately live only in the client. */
final class SaveService {
    public function __construct(private Database $database, private Auth $auth, private PublicTown $public) {}
    public static function keys(array $data,array $allowed): void {
        if(array_diff(array_keys($data),$allowed)) throw new ApiError(422,'Unexpected field.');
    }
    public static function uuid(mixed $id): string {
        if(!is_string($id)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$id)) throw new ApiError(422,'Invalid town ID.');
        return $id;
    }
    public static function profile(mixed $profile): string {
        if(!$profile instanceof \stdClass || ($profile->schemaVersion??null)!==2) throw new ApiError(422,'This save needs a compatible game version. Your local copy is safe.');
        foreach(['town','records','continuousRecords'] as $key) if(!($profile->$key??null) instanceof \stdClass) throw new ApiError(422,'Invalid save structure.');
        if(!is_array($profile->powers??null) || !($profile->town->buildings??null) instanceof \stdClass || !is_string($profile->town->era??null)) throw new ApiError(422,'Invalid save structure.');
        $json=json_encode($profile,JSON_THROW_ON_ERROR);
        if(strlen($json)>1048576) throw new ApiError(413,'A town save must be smaller than 1 MB.');
        return $json;
    }
    public function view(array $row,bool $profile=true): array {
        $result=['townId'=>$row['id'],'name'=>$row['name'],'revision'=>(int)$row['revision'],'updatedAt'=>(int)$row['saved_at'],'isPublic'=>(bool)$row['listed'],'publicId'=>$row['public_id']];
        if($profile) $result['profile']=json_decode($row['profile'],false,64,JSON_THROW_ON_ERROR);
        return $result;
    }
    private function transaction(Request $r,bool $write,callable $operation): mixed {
        $session=$this->auth->session($r,$write);$db=$this->database->get();
        if($write)$this->auth->limit('save:'.$session['player_id'],120,60);
        return $db->transactional(function() use($db,$session,$operation) {
            $account=$db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE',[$session['player_id']]);
            if(!$account)throw new ApiError(401,'Please sign in again.');
            $this->auth->recheck($session);
            return $operation($db,$account,$session);
        });
    }
    public function account(Request $r): array {
        return $this->transaction($r,false,function($db,$account,$session) {
            $towns=$db->fetchAllAssociative('SELECT * FROM towns WHERE player_id=? AND deleted_at IS NULL ORDER BY name,id',[$account['id']]);
            return ['account'=>['id'=>$account['id'],'email'=>$account['email']],'csrf'=>$session['csrf'],'towns'=>array_map(fn($row)=>$this->view($row,false),$towns),'limit'=>3];
        });
    }
    private function owned($db,string $owner,string $id): array {
        $row=$db->fetchAssociative('SELECT * FROM towns WHERE id=? AND player_id=? AND deleted_at IS NULL',[$id,$owner]);
        if(!$row) throw new ApiError(404,'This cloud town is unavailable. Your local copy is safe.');
        return $row;
    }
    public function get(Request $r,string $id): array {
        self::uuid($id);
        return $this->transaction($r,false,fn($db,$a)=>$this->view($this->owned($db,$a['id'],$id)));
    }
    private function nameAvailable($db,string $owner,string $id,string $name): array {
        [$name,$normalized]=$this->public->name($name);
        if($db->fetchOne('SELECT id FROM towns WHERE player_id=? AND normalized_name=? AND id<>?',[$owner,$normalized,$id])) throw new ApiError(409,'You already have a town with that name. Choose another name.',['code'=>'name_taken']);
        return [$name,$normalized];
    }
    private function upload(array $body): array {
        if(!is_string($body['uploadId']??null)||!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$body['uploadId']))throw new ApiError(422,'A save upload ID is required.');
        if(!is_int($body['baseRevision']??null)||$body['baseRevision']<0) throw new ApiError(422,'Invalid base revision.');
        $json=self::profile($body['profile']??null);
        return [$json,hash('sha256',json_encode($body,JSON_THROW_ON_ERROR))];
    }
    public function create(Request $r,array $body): array {
        self::keys($body,['townId','name','baseRevision','uploadId','profile']);$id=self::uuid($body['townId']??null);
        if(!is_string($body['name']??null)||($body['baseRevision']??null)!==0)throw new ApiError(422,'A new town needs a name and revision zero.');
        [$json,$hash]=$this->upload($body);
        return $this->transaction($r,true,function($db,$a)use($body,$id,$json,$hash) {
            $existing=$db->fetchAssociative('SELECT * FROM towns WHERE id=?',[$id]);
            if($existing) {
                if($existing['player_id']===$a['id']&&!$existing['deleted_at']&&$existing['upload_id']===$body['uploadId']&&hash_equals($existing['upload_hash'],$hash))return $this->view($existing);
                throw new ApiError(409,'This town ID is already attached or was deleted. Keep your local copy.',['code'=>'town_exists']);
            }
            if((int)$db->fetchOne('SELECT COUNT(*) FROM towns WHERE player_id=? AND deleted_at IS NULL',[$a['id']])>=3)throw new ApiError(409,'Your account already has 3 towns. Keep playing locally or manage your cloud towns.',['code'=>'slots_full']);
            [$name,$normalized]=$this->nameAvailable($db,$a['id'],$id,$body['name']);
            $row=['id'=>$id,'player_id'=>$a['id'],'name'=>$name,'normalized_name'=>$normalized,'revision'=>1,'profile'=>$json,'saved_at'=>time(),'public_id'=>bin2hex(random_bytes(16)),'listed'=>0,'upload_id'=>$body['uploadId'],'upload_hash'=>$hash];
            try { $db->insert('towns',$row); }
            catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException) { throw new ApiError(409,'This town ID is already attached. Keep your local copy.',['code'=>'town_exists']); }
            return $this->view($row);
        });
    }
    private function archive($db,array $row): void {
        $db->insert('town_history',['town_id'=>$row['id'],'revision'=>$row['revision'],'profile'=>$row['profile'],'saved_at'=>$row['saved_at']]);
        $db->executeStatement('DELETE FROM town_history WHERE town_id=? AND revision<?',[$row['id'],max(0,(int)$row['revision']-4)]);
    }
    public function save(Request $r,string $id,array $body,bool $resolve=false): array {
        self::uuid($id);self::keys($body,['baseRevision','uploadId','profile']);[$json,$hash]=$this->upload($body);
        return $this->transaction($r,true,function($db,$a)use($id,$body,$json,$hash) {
            $row=$this->owned($db,$a['id'],$id);
            if($row['upload_id']===$body['uploadId']) {
                if(!hash_equals($row['upload_hash'],$hash))throw new ApiError(409,'That upload ID belongs to a different save.');
                return $this->view($row);
            }
            if((int)$row['revision']!==$body['baseRevision']) throw new ApiError(409,'This town changed on another device. Choose which save to keep.',['code'=>'save_conflict','cloud'=>$this->view($row)]);
            $this->archive($db,$row);
            $changes=['profile'=>$json,'revision'=>(int)$row['revision']+1,'saved_at'=>time(),'upload_id'=>$body['uploadId'],'upload_hash'=>$hash];
            if($row['listed'])$changes['appearance']=$this->public->projection(json_decode($json),$row['name'],$row['public_id']);
            $db->update('towns',$changes,['id'=>$id]);return $this->view(array_merge($row,$changes));
        });
    }
    public function metadata(Request $r,string $id,array $body): array {
        self::uuid($id);self::keys($body,['baseRevision','name','isPublic']);
        return $this->transaction($r,true,function($db,$a)use($id,$body) {
            $row=$this->owned($db,$a['id'],$id);
            if(($body['baseRevision']??null)!==(int)$row['revision'])throw new ApiError(409,'Refresh this town before changing its details.',['code'=>'save_conflict','cloud'=>$this->view($row)]);
            if(!is_string($body['name']??null)||!is_bool($body['isPublic']??null))throw new ApiError(422,'Choose a name and sharing preference.');
            [$name,$normalized]=$this->nameAvailable($db,$a['id'],$id,$body['name']);
            if($body['isPublic'])$this->public->moderate($name);
            $this->archive($db,$row);
            $changes=['name'=>$name,'normalized_name'=>$normalized,'listed'=>(int)$body['isPublic'],'revision'=>(int)$row['revision']+1,'saved_at'=>time(),'upload_id'=>null,'upload_hash'=>null,'appearance'=>$body['isPublic']?$this->public->projection(json_decode($row['profile']),$name,$row['public_id']):null];
            $db->update('towns',$changes,['id'=>$id]);return $this->view(array_merge($row,$changes));
        });
    }
    public function history(Request $r,string $id): array {
        self::uuid($id);
        return $this->transaction($r,false,function($db,$a)use($id) {
            $this->owned($db,$a['id'],$id);
            return ['revisions'=>array_map(fn($r)=>['revision'=>(int)$r['revision'],'updatedAt'=>(int)$r['saved_at'],'profile'=>json_decode($r['profile'])],$db->fetchAllAssociative('SELECT revision,saved_at,profile FROM town_history WHERE town_id=? ORDER BY revision DESC',[$id]))];
        });
    }
    public function delete(Request $r,string $id,array $body): array {
        self::uuid($id);self::keys($body,['baseRevision','confirmation']);
        return $this->transaction($r,true,function($db,$a)use($id,$body) {
            $row=$this->owned($db,$a['id'],$id);
            if(($body['confirmation']??null)!==$row['name'])throw new ApiError(422,'Type the town name to confirm deletion.');
            if(($body['baseRevision']??null)!==(int)$row['revision'])throw new ApiError(409,'This town changed. Review it again before deleting.');
            $db->update('towns',['deleted_at'=>time(),'listed'=>0,'appearance'=>null,'normalized_name'=>null],['id'=>$id]);
            return ['ok'=>true];
        });
    }
    public function deleteAccount(Request $r,array $body): array {
        self::keys($body,['confirmation']);
        if(($body['confirmation']??null)!=='DELETE MY ACCOUNT')throw new ApiError(422,'Type DELETE MY ACCOUNT to confirm.');
        return $this->transaction($r,true,function($db,$a) {
            $db->delete('login_intents',['email'=>$a['email']]);$db->delete('players',['id'=>$a['id']]);return ['ok'=>true];
        });
    }
}
