<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\Request;
final class PublicTown {
    public function __construct(private Database $database,private Auth $auth) {}
    public function name(string $name): array {
        $name=\Normalizer::normalize(trim($name),\Normalizer::FORM_KC);
        $name=preg_replace('/ +/u',' ',$name);
        if(!preg_match("/^[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} '\x{2019}-]{2,23}$/uD",$name))throw new ApiError(422,'Use 3–24 letters, numbers, spaces, apostrophes or hyphens for the town name.');
        return [$name,transliterator_transliterate('Any-Lower',$name)];
    }
    private function normalized(string $text): string {
        $text=transliterator_transliterate('Any-Latin; Latin-ASCII; Lower',\Normalizer::normalize($text,\Normalizer::FORM_KC));
        return preg_replace('/[^a-z]/','',strtr($text,['0'=>'o','1'=>'i','3'=>'e','4'=>'a','5'=>'s','7'=>'t','8'=>'b']));
    }
    public function moderate(string $name): void {
        $compact=$this->normalized($name);
        $tokens=array_map(fn($s)=>$this->normalized($s),preg_split('/[\s\x{2019}\'-]+/u',$name));
        foreach(['en','fr'] as $lang)foreach(file(dirname(__DIR__).'/content/moderation/'.$lang.'.txt',FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $word) {
            $bad=$this->normalized($word);
            // Short words require a full token to avoid blocking ordinary names such as Scunthorpe.
            if($bad!=='' && ($compact===$bad||in_array($bad,$tokens,true)||(strlen($bad)>=5&&str_contains($compact,$bad))))throw new ApiError(422,'This town name cannot be used publicly. Rename it before sharing.');
        }
    }
    public function projection(object $profile,string $name,string $publicId): string {
        $schema=json_decode(file_get_contents(dirname(__DIR__).'/content/public-schema.json'),true,32,JSON_THROW_ON_ERROR);
        $town=$profile->town;$era=in_array($town->era,$schema['eras'],true)?$town->era:$schema['eras'][0];
        $appearance=['era'=>$era,'buildings'=>new \stdClass(),'buildingEras'=>new \stdClass(),'buildingEraLevels'=>new \stdClass(),'projects'=>new \stdClass()];
        foreach($schema['buildings'] as $id) {
            foreach(['buildings','buildingEraLevels'] as $key) {
                $value=$town->$key->$id??0;$appearance[$key]->$id=is_int($value)?max(0,min(3,$value)):0;
            }
            $value=$town->buildingEras->$id??$era;$appearance['buildingEras']->$id=in_array($value,$schema['eras'],true)?$value:$era;
        }
        return json_encode(['villageId'=>$publicId,'name'=>$name,'era'=>$era,'appearance'=>$appearance],JSON_THROW_ON_ERROR);
    }
    public function browse(Request $r): array {
        $this->auth->session($r);
        $page=filter_var($r->query->get('page','1'),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
        if(!$page)throw new ApiError(422,'Invalid page.');
        $rows=$this->database->get()->createQueryBuilder()->select('appearance')->from('towns')->where('listed=1 AND deleted_at IS NULL')->orderBy('public_id','ASC')->setFirstResult(($page-1)*20)->setMaxResults(21)->executeQuery()->fetchFirstColumn();
        return ['entries'=>array_map(fn($r)=>json_decode($r),array_slice($rows,0,20)),'page'=>$page,'hasNext'=>count($rows)>20];
    }
    public const SALOON_REST=3600;
    // A share link needs no account: anyone holding the unguessable public ID may see the
    // appearance projection. Browsing the full list still needs one. Opening the town is a
    // visit; an open visit polling for the owner's progress is not a new guest.
    public function visit(Request $r,string $id,bool $arrival=true): object {
        $row=$this->database->get()->fetchAssociative('SELECT t.id,t.player_id,t.appearance,s.collected_at FROM towns t LEFT JOIN saloon_collections s ON s.town_id=t.id WHERE t.public_id=? AND t.listed=1 AND t.deleted_at IS NULL',[$id]);
        if(!$row)throw new ApiError(404,'Town unavailable.');
        if($arrival)$this->welcomeGuest($r,$row);
        $village=json_decode($row['appearance']);
        $village->saloonReadyAt=$this->saloonReadyAt($row['collected_at']);
        return $village;
    }

    // Saloon: any visitor may collect it for the owner, at most once per hour per town.
    // Only the time is stored: the owner's game moves its own reserved coins, so no money
    // is created and several open tabs cannot collect twice.
    public function tapSaloon(Request $r,string $id): array {
        $this->auth->limit('saloon:'.($r->getClientIp()??'unknown'),30,3600);
        return $this->database->get()->transactional(function($db) use($id) {
            $row=$db->fetchAssociative('SELECT id,appearance FROM towns WHERE public_id=? AND listed=1 AND deleted_at IS NULL FOR UPDATE',[$id]);
            if(!$row)throw new ApiError(404,'Town unavailable.');
            if((json_decode($row['appearance'])->appearance->buildings->saloon??0)<1)throw new ApiError(409,'This town has no saloon yet.',['code'=>'no_saloon']);
            $readyAt=$this->saloonReadyAt($db->fetchOne('SELECT collected_at FROM saloon_collections WHERE town_id=?',[$row['id']]));
            if($readyAt>time())throw new ApiError(409,'A visitor already collected this saloon. Come back later.',['code'=>'saloon_resting','readyAt'=>$readyAt]);
            $now=time();$this->upsert('saloon_collections',$row['id'],['collected_at'=>$now]);
            return ['readyAt'=>$now+self::SALOON_REST];
        });
    }
    private function saloonReadyAt(mixed $at): int {return $at===null||$at===false?0:(int)$at+self::SALOON_REST;}

    // Guest: a signed-in viewer becomes the town's only guest, replacing any earlier one,
    // until the owner's game has saved them as a VIP. Owners are never their own guest.
    private function welcomeGuest(Request $r,array $town): void {
        try {$visitor=$this->auth->session($r)['player_id'];}catch(ApiError){return;}
        if($visitor===$town['player_id'])return;
        $names=$this->database->get()->fetchFirstColumn('SELECT name FROM towns WHERE player_id=? AND deleted_at IS NULL ORDER BY listed DESC,saved_at DESC',[$visitor]);
        foreach($names as $name)if($label=$this->guestName($name)) {
            $this->upsert('town_guests',$town['id'],['name'=>$label,'visited_at'=>time()]);
            return;
        }
    }
    // Guest names appear in another player's village: never a link or an email, only
    // letters, digits and single spaces, and they must pass the public-name moderation.
    public function guestName(string $name): ?string {
        $name=\Normalizer::normalize($name,\Normalizer::FORM_KC);
        if(preg_match('~@|://|\bwww\b|\.[a-z]{2,}\b~iu',$name))return null;
        $clean=trim(preg_replace('/ +/u',' ',preg_replace('/[^\p{L}\p{M}\p{N} ]+/u','',$name)));
        if(mb_strlen($clean)<3||mb_strlen($clean)>24||preg_match('~(^| )(https?|www)~iu',$clean))return null;
        try {$this->moderate($clean);}catch(ApiError){return null;}
        return $clean;
    }
    private function upsert(string $table,string $town,array $values): void {
        $db=$this->database->get();
        if(!$db->update($table,$values,['town_id'=>$town]))
            try {$db->insert($table,['town_id'=>$town]+$values);}
            catch(\Doctrine\DBAL\Exception\UniqueConstraintViolationException){$db->update($table,$values,['town_id'=>$town]);}
    }
}
