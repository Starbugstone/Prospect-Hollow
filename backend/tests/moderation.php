<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use App\NameModeration;
// Public-name moderation needs no database: run it before the API tests.
$count=0;$failures=[];
function expect(bool $ok,string $label): void {global $count,$failures;$count++;if(!$ok)$failures[]=$label;}
$names=new NameModeration();$dir=dirname(__DIR__).'/content/moderation';
$read=fn(string $file)=>array_filter(file($dir.'/'.$file,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES),fn($l)=>!str_starts_with($l,'#'));
$listed=[];foreach(['en.txt','fr.txt'] as $file)foreach($read($file) as $word)if(($f=$names->fold($word))!=='')$listed[$f]=$word;
$allowed=array_flip(array_map(fn($w)=>$names->fold($w),$read('allow.txt')));

// Every listed word is refused on its own, apart from the ones allow.txt deliberately clears.
foreach($listed as $folded=>$word)if(!isset($allowed[$folded]))expect(!$names->allows($word),'listed word refused: '.$word);
foreach($read('whole-word.txt') as $word)expect(isset($listed[$names->fold($word)]),'whole-word entry is a listed word: '.$word);
foreach($read('allow.txt') as $word)expect($names->allows($word),'allow entry accepted: '.$word);

foreach(['fuck town','p u t a i n','M3RDE','ＦＵＣＫ','𝐟𝐮𝐜𝐤 ridge','Fúck','Fuc'."\u{301}".'k Hill','fu'."\u{200B}".'ck','f.u.c.k','f u c k town',
    'Fuckville','fu ckville','Shitton','Cuntfield','Bitchton','Fuuuck','Shiiit Creek','Scunthorpefuck','Old Cunts','Сосk Town','Ѕhit Creek','Negro Town',
    'Grosse Bite','Le Con','Big Ass','P3nis Point','Wh0re House','Bastard Gulch','Sluts','Salope','Enculé','Nique ta mère'] as $name)
    expect(!$names->allows($name),'refused: '.$name);

// Ordinary names that the old substring rule or a careless fix would refuse.
foreach(['Dustwater','Prospect Hollow','Crystal Cascade','Scunthorpe','Penistone','Peterborough','Saint Peter','St. Peter\'s','Bitter Creek','Bittern Hollow',
    'Montenegro','Rio Negro','Pine Grove','Vine Grove','Lone Grove','Princes Town','Milford Haven','Cul de Sac','Gueule de Loup','Basement Flats','Settlement',
    'Connecticut','Canal Street','Grape Vine','Drapers Row','Scatter Creek','Spice Hill','Button Falls','Butterfield','Peacock Ridge','Cocoon Hollow','Raccoon Rapids',
    'Among Pines','Shiitake Farm','Annals','Cull Creek','Swank Hill','Therapist Row','Socialist Hall','Honeysuckle','Spoon Lake','Scrapings','Tapisserie','Succès',
    'Café Rouge','Château-Gaillard','Łódź','Zürich','Москва','Αθήνα','東京','Azizi','Washington','Middlesex','Essex','Sussex','Cockburn','Dickens Lane','Hitchcock'] as $name)
    expect($names->allows($name),'accepted: '.$name);

// Missing or empty lists fail closed rather than accepting every name.
expect(!(new NameModeration(sys_get_temp_dir().'/missing-moderation-'.bin2hex(random_bytes(4))))->allows('Dustwater'),'missing lists refuse');
$empty=sys_get_temp_dir().'/empty-moderation-'.bin2hex(random_bytes(4));mkdir($empty);
foreach(['en.txt','fr.txt','allow.txt','whole-word.txt'] as $file)touch($empty.'/'.$file);
expect(!(new NameModeration($empty))->allows('Dustwater'),'empty lists refuse');
array_map('unlink',glob($empty.'/*'));rmdir($empty);

if($failures){fwrite(STDERR,implode("\n",$failures)."\n".count($failures).' of '.$count." moderation checks failed\n");exit(1);}
echo "$count moderation checks passed\n";
