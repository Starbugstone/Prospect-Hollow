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
    public function visit(Request $r,string $id): object {
        $this->auth->session($r);
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(404,'Town unavailable.');
        $json=$this->database->get()->fetchOne('SELECT appearance FROM towns WHERE public_id=? AND listed=1 AND deleted_at IS NULL',[$id]);
        if(!$json)throw new ApiError(404,'Town unavailable.');return json_decode($json);
    }
}
