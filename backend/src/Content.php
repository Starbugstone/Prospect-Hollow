<?php
declare(strict_types=1);
namespace App;
final class Content {
    public readonly array $data;
    public function __construct() { $this->data = json_decode(file_get_contents(dirname(__DIR__).'/content/game.json'), true, 512, JSON_THROW_ON_ERROR); }
    public function building(string $id): array {
        foreach ($this->data['buildings'] as $b) if ($b['id'] === $id) return $b;
        throw new ApiError(422, 'Unknown building.');
    }
    public function level(int $id): array {
        foreach ($this->data['levels'] as $l) if ($l['id'] === $id) return $l;
        throw new ApiError(422, 'Unknown level.');
    }
    /** Add catalog keys only to an already trusted, persisted server profile. Never import client state. */
    public function hydrate(array $profile): array {
        foreach(['buildings','buildingEras','buildingEraLevels'] as $key) {
            foreach($this->data['town'][$key] as $id=>$default) {
                if(!array_key_exists($id,$profile['town'][$key]))$profile['town'][$key][$id]=$default;
            }
        }
        // Existing era, projects and receipts retain their original meaning and content versions.
        // In particular, inserting Post-war never downgrades an existing Motor Age account.
        $profile['town']['presentations']??=[];
        $profile['community']??=['listed'=>false,'villageName'=>''];
        $profile['contentVersion']=$this->data['version'];
        return $profile;
    }
    public function fresh(): array {
        return ['community'=>['listed'=>false,'villageName'=>''], 'schemaVersion'=>2, 'contentVersion'=>$this->data['version'], 'records'=>[], 'continuousRecords'=>[], 'powers'=>array_map(fn($p)=>array_merge($p,['quantity'=>0]),$this->data['powers']), 'builderHammers'=>0, 'pendingChests'=>[], 'chestsWithoutBuilderHammer'=>0, 'town'=>$this->data['town'], 'shopStock'=>[], 'shopVisit'=>0, 'seenObstacles'=>[], 'issuedRun'=>0, 'settledRun'=>0, 'firstStartUsed'=>false];
    }
}
