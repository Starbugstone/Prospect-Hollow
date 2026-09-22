<?php
declare(strict_types=1);
namespace App;
final class TownService {
    private const EVENT='dusty-trail-visitors';
    private const COIN_CAP=1000000000;
    public function __construct(private Content $content) {}
    public function capacity(array $p): int { return ($this->content->data['capacities'][min(3,$p['town']['buildings']['armory'])]??3)+($p['town']['buildings']['garage']??0)*2; }
    private function service(array $t,string $id): int { return $this->content->data['services'][$id][$t['buildings'][$id]??0]??0; }
    /** Functional stages alone provide city effects; modernization never multiplies them. */
    private function cityCapacity(array $t,string $stat): int {
        $capacity=0;
        foreach($this->content->data['buildings'] as $building) $capacity+=($building['effects'][$stat]??0)*($t['buildings'][$building['id']]??0);
        return $capacity;
    }
    public function capacities(array $t): array {
        $food=0;$water=0;$housing=0;
        foreach($this->content->data['buildings'] as $building) {
            $level=$this->service($t,$building['id']);
            if($building['kind']==='farm')$food+=$level*6;
            if($building['kind']==='well')$water+=$level*6;
            if($building['kind']==='home')$housing+=$level*2;
        }
        $b=$t['buildings'];
        $food+=min(5,$this->service($t,'fisherman'))+($b['market']??0)*10+$this->cityCapacity($t,'food');
        $food+=$this->content->data['serviceCarry'][$t['buildingEras']['farm']][$t['buildingEraLevels']['farm']]['food'];
        if($b['well'])$water+=$this->content->data['serviceCarry'][$t['buildingEras']['well']][$t['buildingEraLevels']['well']]['water'];
        $water+=$this->cityCapacity($t,'water');
        $housing+=($b['home5']??0)*8+([0,6,12,16][$b['rowHouses']??0])+($b['gardenCourt']??0)*6+$this->cityCapacity($t,'housing');
        $visitors=$this->service($t,'stable')*2+max(0,$this->service($t,'museum')-1)*2+($b['railDepot']??0)*2+($b['hotel']??0)*2+($b['busDepot']??0)*2+$this->cityCapacity($t,'visitors');
        return ['food'=>$food,'water'=>$water,'housing'=>$housing,'visitors'=>$visitors];
    }
    public function population(array $t): array {
        ['food'=>$food,'water'=>$water,'housing'=>$housing,'visitors'=>$visitors]=$this->capacities($t);
        $b=$t['buildings'];
        $residents=min($housing,$water,$food);$population=$residents+min($visitors,max(0,$water-$residents),max(0,$food-$residents));
        $demand=$housing+$visitors;$needs=$demand?min(1,$water/$demand,$food/$demand):0;
        $happiness=min(100,(int)round($needs*40+($b['square']??0)*8+$this->service($t,'museum')*2+$b['saloon']*2+min(5,$this->service($t,'school'))+($b['horseField']??0)*2+($b['park']??0)*3+$this->cityCapacity($t,'happiness')));
        return [$population,$happiness];
    }
    public function incomeRate(array $t): int {
        [$population,$happiness]=$this->population($t);
        return (int)floor(2.25*$t['buildings']['saloon']*$population*(100+1.25*$happiness)*(1+($t['buildings']['diner']??0)*0.05)/100);
    }
    public function accrue(array &$p,?int $now=null): void {
        $now??=(int)floor(microtime(true)*1000); $income=&$p['town']['income'];
        if (($income['at']??null)!==null && $now<=$income['at']) return;
        $rate=$this->incomeRate($p['town']); $elapsed=isset($income['at']) ? min(28800000,$now-$income['at']) : 0;
        $credit=$elapsed*$rate+($income['remainder']??0); $stored=$income['stored']??0;
        $earned=max(0,min(intdiv($credit,3600000),$rate*8-$stored));
        $income=['at'=>$now,'stored'=>$stored+$earned,'remainder'=>$stored+$earned>=$rate*8?0:$credit%3600000];
    }
    public function offer(array $p,string $id): array {
        $t=$p['town']; $b=$this->content->building($id); $eras=array_column($this->content->data['eras'],'id');
        if (array_search($b['introducedEra'],$eras,true)>array_search($t['era'],$eras,true)) throw new ApiError(422,'This plot belongs to a later era.');
        foreach($b['unlock']??[] as $requirement) if (!$t['buildings'][$id] && $t['buildings'][$requirement['id']]<$requirement['level']) throw new ApiError(422,'Complete this plot’s prerequisites first.');
        if (isset($t['projects'][$id])) throw new ApiError(409,'This plot is already under construction.');
        $stage=$t['buildings'][$id]; $offer=$b['upgrades'][$stage]??null;
        if (!$offer) {
            $eraLevel=$t['buildingEras'][$id]===$t['era'] ? ($t['buildingEraLevels'][$id]?:1) : 0;
            $offer=$this->content->data['modernizations'][$t['era']][$id][$eraLevel]??null;
        }
        if (!$offer) throw new ApiError(422,'This building is already complete.');
        if (($offer['requiresPower']??false) && !$t['buildings']['powerHouse']) throw new ApiError(422,'Complete the power house first.');
        $offer['stage']=$offer['stage']??$stage;
        $offer['runs']=min(2,$offer['runs']??1);
        if ($t['era']==='river-rail' && ($offer['type']??'')!=='modernization') $offer['cost']=$this->content->data['riverRailPrices'][$stage]??$offer['cost'];
        $offer['targetEra']=$t['era'];
        if (!$p['firstStartUsed'] && !$t['projects'] && !array_sum($t['buildings'])) $offer['cost']=0;
        return $offer;
    }
    private function finish(array &$p,string $id,array $project): void {
        $t=&$p['town']; $modern=($project['type']??'')==='modernization';
        $previous=$t['buildings'][$id];
        if (!$modern) $t['buildings'][$id]=$project['stage'];
        if (!$previous && $t['buildings'][$id]>0)foreach($this->content->data['presentations'] as $presentation)if($presentation['building']===$id)$t['presentations'][$presentation['id']]='pending';
        $t['buildingEras'][$id]=$project['targetEra']??$t['era'];
        $t['buildingEraLevels'][$id]=$modern ? $project['eraLevel'] : ($t['era']==='frontier'?0:$project['stage']);
        if (in_array($id,['bridge','riverPort','railDepot'],true)) $t['infrastructure'][$id==='railDepot'?'rail':$id]=$t['buildings'][$id];
        unset($t['projects'][$id]); $t['constructionTipSeen']=true;
        $this->shop($p,false);
        $this->scheduleRaid($p);
        $forge=&$t['forge'];
        if($t['buildings']['blacksmith'] && !$forge['charge'] && $forge['progress']>=($this->content->data['forgeRuns'][$t['buildings']['blacksmith']-1]??6)) $forge=['progress'=>0,'charge'=>1];
    }
    public function action(array &$p,string $type,array $a): void {
        $t=&$p['town'];
        switch($type) {
            case 'town.sync': ProfileService::keys($a,[]); return;
            case 'town.collect':
                ProfileService::keys($a,['source']); $source=$a['source']??'';
                if (!in_array($source,['saloon','blacksmith'],true)) throw new ApiError(422,'Unknown collection.');
                $now=(int)floor(microtime(true)*1000);
                if ($now-($t['lastCollections'][$source]??0)<30000) throw new ApiError(409,'Please wait before collecting again.');
                if (!$t['buildings'][$source]) throw new ApiError(422,'Complete this building first.');
                if ($source==='saloon') { $this->coins($p,$t['income']['stored']); $t['income']['stored']=0; }
                else {
                    if (!$t['forge']['charge'] || $this->quantity($p,'tnt')>=$this->capacity($p)) throw new ApiError(422,'No TNT is ready or storage is full.');
                    $this->grant($p,['id'=>'tnt','kind'=>'power','quantity'=>1,'label'=>'TNT']); $t['forge']=['progress'=>0,'charge'=>0];
                }
                $t['lastCollections'][$source]=$now; return;
            case 'town.upgrade': case 'town.hammer':
                ProfileService::keys($a,['id','stage']); $id=$this->buildingArgument($a); $offer=$this->offer($p,$id);
                if (($a['stage']??null)!==$offer['stage']) throw new ApiError(409,'The building stage changed.');
                if ($type==='town.hammer') {
                    if ($p['builderHammers']<1) throw new ApiError(422,'No builder hammers remain.');
                    $p['builderHammers']--;
                } else {
                    if ($t['coins']<$offer['cost']) throw new ApiError(422,'Not enough coins.');
                    $t['coins']-=$offer['cost'];
                }
                $p['firstStartUsed']=true;
                $project=['id'=>$id,'stage'=>isset($offer['type'])?$offer['stage']:$offer['stage']+1,'wins'=>0,'required'=>$offer['runs'],'contentVersion'=>$this->content->data['version']];
                foreach(['type','targetEra','eraLevel','cost'] as $key) if(isset($offer[$key]))$project[$key]=$offer[$key];
                if(isset($offer['type'])) $project['fromEra']=$t['buildingEras'][$id];
                if ($type==='town.hammer' || !$offer['runs']) $this->finish($p,$id,$project); else $t['projects'][$id]=$project;
                return;
            case 'town.finish':
                ProfileService::keys($a,['id','stage']); $id=$this->buildingArgument($a); $project=$t['projects'][$id]??null;
                if (!$project || $project['stage']!==($a['stage']??null) || $project['wins']<$project['required']) throw new ApiError(409,'This project is not ready.');
                if (($project['type']??'')==='modernization' && ($project['fromEra']!==$t['buildingEras'][$id] || $project['targetEra']!==$t['era'])) throw new ApiError(409,'The building era changed.');
                if (($project['type']??'')!=='modernization' && $project['stage']!==$t['buildings'][$id]+1) throw new ApiError(409,'The building stage changed.');
                $this->finish($p,$id,$project); return;
            case 'town.raid': ProfileService::keys($a,[]); return; // Already settled with the accepted victory.
            case 'town.raid-seen':
                ProfileService::keys($a,['id']); $event=$t['events'][self::EVENT]??null;
                if (!$event || $event['id']!==($a['id']??null) || $event['seen']) throw new ApiError(409,'This encounter was already acknowledged.');
                $t['events'][self::EVENT]['seen']=true; return; // Presentation never changes balances or immutable outcome.
            case 'town.bell': throw new ApiError(422,'A saved encounter cannot be changed.');
            case 'town.presentation-seen':
                ProfileService::keys($a,['id']); $id=$a['id']??null;
                if(!is_string($id)||!isset($this->content->data['presentations'][$id])||($t['presentations'][$id]??null)!=='pending')throw new ApiError(409,'This presentation is not pending.');
                $t['presentations'][$id]='seen'; return;
            case 'town.tour': ProfileService::keys($a,[]); $t['tourSeen']=true; return;
            case 'town.lights': ProfileService::keys($a,[]); if ($t['buildings']['powerHouse']) $t['firstLightsSeen']=true; return;
            case 'town.era-seen':
                ProfileService::keys($a,[]); if(isset($t['transition'])) {$t['transition']['pending']=false;$t['eraTransitionSeen'][$t['era']]=true;} return;
            case 'town.era':
                ProfileService::keys($a,['era']); $eras=array_column($this->content->data['eras'],'id'); $next=$this->content->data['eras'][array_search($t['era'],$eras,true)+1]??null;
                if (($a['era']??null)!==$t['era'] || $t['projects'] || !($next['enabled']??false) || ($t['transition']['pending']??false) || (isset($t['events'][self::EVENT])&&!$t['events'][self::EVENT]['seen'])) throw new ApiError(422,'The next era is not ready.');
                foreach($this->content->data['buildings'] as $b) {
                    if (!($b['requiredForEraCompletion']??false) || array_search($b['introducedEra'],$eras,true)>array_search($t['era'],$eras,true)) continue;
                    if ($t['buildings'][$b['id']]!==count($b['upgrades']) || isset($t['projects'][$b['id']]) || ($t['era']!=='frontier' && ($t['buildingEras'][$b['id']]!==$t['era'] || ($b['introducedEra']===$t['era']?$t['buildings'][$b['id']]:$t['buildingEraLevels'][$b['id']])!==3))) throw new ApiError(422,'Complete the village before entering the next era.');
                }
                $t['transition']=['id'=>$t['era'].':'.$next['id'],'from'=>$t['era'],'to'=>$next['id'],'pending'=>true]; $t['era']=$next['id']; return;
            case 'shop.buy':
                ProfileService::keys($a,['id','visit']);
                if (($a['visit']??null)!==$p['shopVisit'] || !$t['buildings']['shop']) throw new ApiError(409,'Shop stock has changed.');
                foreach($p['shopStock'] as &$offer) if($offer['id']===($a['id']??null) && !$offer['sold']) {
                    foreach($this->content->data['shop'] as $item) if($item['id']===$offer['id']) {
                        if($t['coins']<$item['price'])throw new ApiError(422,'Not enough coins.');
                        if(($item['kind']==='builder-hammer' ? $p['builderHammers']>=5 : $this->quantity($p,$item['id'])>=$this->capacity($p)))throw new ApiError(422,'Storage is full.');
                        $t['coins']-=$item['price']; $this->grant($p,$item);$offer['sold']=true;return;
                    }
                }
                throw new ApiError(422,'This item is unavailable.');
            default: throw new ApiError(422,'Unknown action.');
        }
    }
    public function quantity(array $p,string $id): int { foreach($p['powers'] as $slot)if($slot['id']===$id)return $slot['quantity'];return 0; }
    public function consume(array &$p,string $id): void {
        foreach($p['powers'] as &$slot) if($slot['id']===$id && $slot['quantity']>0){$slot['quantity']--;return;}
        throw new ApiError(422,'This power is unavailable.');
    }
    private function buildingArgument(array $a): string {
        if (!is_string($a['id']??null)) throw new ApiError(422,'A building ID is required.');
        $this->content->building($a['id']);
        if (!is_int($a['stage']??null)) throw new ApiError(422,'A building stage is required.');
        return $a['id'];
    }
    private function coins(array &$p,int $amount): void {
        $p['town']['coins']=min(self::COIN_CAP,$p['town']['coins']+max(0,$amount));
    }
    public function grant(array &$p,array $reward): array {
        $amount=$reward['quantity']??null;
        if(!is_int($amount) || $amount<=0 || $amount>self::COIN_CAP) throw new ApiError(422,'Invalid reward.');
        $accepted=$amount;
        if($reward['kind']==='coins') $this->coins($p,$amount);
        elseif($reward['kind']==='builder-hammer') {
            $accepted=min($amount,max(0,$this->content->data['hammerCapacity']-$p['builderHammers']));$p['builderHammers']+=$accepted;
        } elseif($reward['kind']==='power') {
            $found=false;
            foreach($p['powers'] as &$slot) if($slot['id']===$reward['id']) {
                $found=true;$accepted=min($amount,max(0,$this->capacity($p)-$slot['quantity']));$slot['quantity']+=$accepted;break;
            }
            unset($slot);
            if(!$found) throw new ApiError(422,'Unknown power.');
        } else throw new ApiError(422,'Unknown reward.');
        $overflow=($amount-$accepted)*$this->content->data['overflowCoins'];$this->coins($p,$overflow);
        if(!$accepted) return ['id'=>'coins','kind'=>'coins','label'=>'Coins','quantity'=>$overflow,'convertedFrom'=>$reward['label']];
        return array_merge($reward,['quantity'=>$accepted,'overflowCoins'=>$overflow]);
    }
    private function shop(array &$p,bool $refresh): void {
        $slots=$this->content->data['shopSlots'][$p['town']['buildings']['shop']]??0;
        if(!$slots || (!$refresh&&count($p['shopStock'])>=$slots)) return;
        $stock=$refresh?[]:$p['shopStock'];
        $ids=array_column($stock,'id');
        $items=array_values(array_filter($this->content->data['shop'],fn($item)=>!in_array($item['id'],$ids,true)));
        while(count($stock)<$slots && $items) {
            $index=random_int(0,count($items)-1);$stock[]=['id'=>$items[$index]['id'],'sold'=>false];array_splice($items,$index,1);
        }
        $p['shopStock']=$stock;$p['shopVisit']++;
    }
    public function stars(int $score,int $target,int $combo): int {
        return 1+(int)($target>0 && $score>=$target)+(int)($combo>=4 || ($target>0 && $score>=$target*1.35));
    }
    public function payout(array $run): int {
        $bonusCount=count(array_filter($run['board'],fn($g)=>in_array($g['type']??'',['bomb','cross','rainbow'],true)));
        $base=$run['jewels']+10*$bonusCount;
        foreach([['comboCounts','comboCoinStep'],['multiMatchCounts','multiMatchCoinStep']] as [$key,$step])
            foreach($run[$key] as $tier=>$count) if((int)$tier>=2 && is_int($count) && $count>0) $base+=((int)$tier-1)*$this->content->data[$step]*$count;
        return min(self::COIN_CAP,$base*$this->content->data['miningMultipliers'][$run['level']]);
    }
    private function chapters(array $records): int {
        $chapters=0;
        while($chapters<count($this->content->data['chapterGifts'])) {
            for($i=1;$i<=6;$i++) if(!isset($records[$chapters*6+$i])) return $chapters;
            $chapters++;
        }
        return $chapters;
    }
    private function rollChest(array &$p,int $level): array {
        $available=array_values(array_filter($this->content->data['chestDrops'],fn($drop)=>
            $drop['kind']==='coins' || ($drop['kind']==='builder-hammer' ? $p['builderHammers']<$this->content->data['hammerCapacity'] : $this->quantity($p,$drop['id'])<$this->capacity($p))));
        if($p['chestsWithoutBuilderHammer']>=9) {
            $id=$p['builderHammers']<$this->content->data['hammerCapacity']?'builder-hammer':'coins';
            $reward=array_values(array_filter($available,fn($drop)=>$drop['id']===$id))[0];
        } else {
            // Integer hundredths retain the exact fractional catalog weights.
            $roll=random_int(1,array_sum(array_map(fn($drop)=>(int)round($drop['weight']*100),$available)));
            $reward=$available[count($available)-1];
            foreach($available as $drop) { $roll-=(int)round($drop['weight']*100);if($roll<=0){$reward=$drop;break;} }
        }
        $p['chestsWithoutBuilderHammer']=$reward['kind']==='builder-hammer'?0:min(9,$p['chestsWithoutBuilderHammer']+1);
        return $this->grant($p,['id'=>$reward['id'],'kind'=>$reward['kind'],'label'=>$reward['label'],'quantity'=>$reward['kind']==='coins'?$this->content->data['chestCoins'][$level]:$reward['quantity']]);
    }
    public function victory(array &$p,array $run,string $runId): array {
        $level=$this->content->level($run['level']);$id=$run['level'];
        $target=$level['chestTarget'];$elapsed=max(1,(time()-$run['startedAt'])*1000);
        $previous=$p['records'][$id]??[];$previousChapter=$this->chapters($p['records']);
        $p['records'][$id]=['score'=>max($previous['score']??0,$run['score']),'stars'=>max($previous['stars']??0,$this->stars($run['score'],$target,$run['maxCascade'])),'bestTimeMs'=>min($previous['bestTimeMs']??PHP_INT_MAX,$elapsed)];
        $p['town']['completedRuns']++;$construction=[];
        foreach($p['town']['projects'] as $plot=>&$project) {
            if($project['wins']>=$project['required']) continue;
            $project['wins']=min($project['required'],$project['wins']+1);$construction[]=$project+['ready'=>$project['wins']>=$project['required']];
        }
        unset($project);
        $forge=&$p['town']['forge'];$forgeLevel=$p['town']['buildings']['blacksmith'];
        if($forgeLevel && !$forge['charge']) {$forge['progress']++;if($forge['progress']>=($this->content->data['forgeRuns'][$forgeLevel-1]??6))$forge=['progress'=>0,'charge'=>1];}
        $this->shop($p,true);
        $chapter=$this->chapters($p['records']);$chapterReward=null;
        if($chapter>$previousChapter) {
            $gift=$this->content->data['chapterGifts'][$chapter-1];
            if($this->quantity($p,$gift['id'])>=$this->capacity($p)) $gift=['id'=>'coins','kind'=>'coins','label'=>'Coins','quantity'=>$chapter*100,'convertedFrom'=>$gift['label']];
            $chapterReward=['chapter'=>$chapter,'gift'=>$this->grant($p,$gift)];
        }
        $scoreTier=null;$speedTier=null;
        foreach($this->content->data['chestTiers'] as $candidate) if($target>0 && $run['score']>=$candidate['multiplier']*$target)$scoreTier=$candidate;
        foreach($this->content->data['speedChestTiers'] as $candidate) if(($level['speedTargetMs']??0)>0 && $elapsed<=$candidate['timeMultiplier']*$level['speedTargetMs'])$speedTier=$candidate;
        $sources=[];
        if($scoreTier)$sources['score']=$scoreTier;
        elseif(!$speedTier)$sources['completion']=$this->content->data['chestTiers'][0];
        if($speedTier)$sources['speed']=$speedTier;
        $chests=[];
        foreach($sources as $source=>$tier) {
            $reward=$this->rollChest($p,$id);
            $chests[]=array_merge($tier,['id'=>$runId.'-'.$source,'runId'=>$runId,'levelId'=>$id,'economyVersion'=>$this->content->data['chestEconomyVersion'],'count'=>1,'source'=>$source,'items'=>[$reward],'serverGranted'=>true]);
        }
        $coins=$this->payout($run);$this->coins($p,$coins);
        $p['settledRun']=$p['issuedRun'];$this->raid($p);
        return ['coins'=>$coins,'chests'=>$chests,'construction'=>$construction,'chapterReward'=>$chapterReward];
    }
    private function scheduleRaid(array &$p): void {
        $t=&$p['town'];
        if($t['nextRaidRun']===null && $this->population($t)[0]>0)$t['nextRaidRun']=$t['completedRuns']+5;
    }
    private function raid(array &$p): void {
        $this->scheduleRaid($p);$t=&$p['town'];
        // Acknowledgment controls the notice only; withholding it cannot suspend losses.
        if($this->population($t)[0]<=0 || $t['nextRaidRun']===null || $t['completedRuns']<$t['nextRaidRun'])return;
        if($t['era']==='river-rail' && !$t['buildings']['railDepot'] && !$t['buildings']['riverPort'])return;
        if($t['era']==='industrial' && !$t['buildings']['powerHouse'] && !$t['buildings']['mill'])return;
        $kind=$this->content->data['eraEventKinds'][$t['era']];
        $dev=array_sum($t['buildings']);$riders=$dev>=70?10:($dev>=50?8:($dev>=30?6:($dev>=16?4:2)));
        $sheriff=$t['buildings']['sheriff'];$bank=$t['buildings']['bank'];$fire=$t['buildings']['fireStation'];
        $protection=in_array($kind,['workshop-fire','storm-cleanup'],true)?$this->content->data['fireProtection'][min(3,$fire)]:(min($riders,2*$sheriff)+min($riders,2*$bank))/($riders*2);
        $loss=$protection===1 || $protection===1.0?0:min(30,(int)ceil(5*$riders*(1-$protection)),intdiv($t['coins'],10),max(0,$t['coins']-50));$t['coins']-=$loss;
        $targets=$kind==='bandits'?['mine']:[];
        foreach(match($kind){'storm-cleanup'=>['riverPark','riverPort','square'],'workshop-fire'=>['mill','blacksmith','powerHouse'],'cargo-theft'=>['warehouse','railDepot','riverPort'],default=>['saloon','armory','farm','home']} as $target) if($t['buildings'][$target]){$targets[]=$target;break;}
        $t['events'][self::EVENT]=['id'=>($t['events'][self::EVENT]['id']??0)+1,'atRun'=>$t['completedRuns'],'gangSize'=>$riders,'sheriffLevel'=>$sheriff,'bankLevel'=>$bank,'kind'=>$kind,'fireStationLevel'=>$fire,'targets'=>$targets,'outcome'=>$protection>=1?'protected':($loss?'stolen':'harmless'),'loss'=>$loss,'seen'=>false,'contentVersion'=>$this->content->data['version'],'balance'=>$t['coins']];
        $t['nextRaidRun']=$t['completedRuns']+5;
    }
}
