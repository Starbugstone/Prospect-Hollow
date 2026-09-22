<?php
declare(strict_types=1);
namespace App;

/** The browser submits intentions only; all board transitions and counters live here. */
final class PuzzleEngine {
    public const GEMS = ['ruby','sapphire','emerald','topaz','amethyst','moonstone'];
    public const BONUSES = ['bomb','cross','rainbow'];
    private \Closure $random;
    public function __construct(?\Closure $random=null) { $this->random=$random ?? fn(int $max)=>random_int(0,$max-1); }
    private function choose(array $values): mixed { return $values[($this->random)(count($values))]; }
    private function gem(string $type): array { return ['id'=>'gem-'.bin2hex(random_bytes(10)),'type'=>$type,'highlight'=>false]; }
    public static function anchored(?array $tile): bool { return ($tile['state']??'')==='FROZEN' || ($tile['chainHealth']??0)>0 || (($tile['type']??'')==='blocker' && ($tile['health']??0)>0); }
    private function swappable(?array $gem,?array $tile): bool { return $gem && $gem['type']!=='relic' && !self::anchored($tile); }
    private function neighbors(int $i,int $cols,int $rows): array {
        return array_values(array_filter([$i%$cols>0?$i-1:-1,$i%$cols<$cols-1?$i+1:-1,$i-$cols,$i+$cols],fn($n)=>$n>=0&&$n<$cols*$rows));
    }
    public function initial(array $level,string $mode): array {
        $layers=array_sum(array_map(fn($t)=>($t['health']??0)+($t['chainHealth']??0)+($t['signalHealth']??0),$level['tiles']));
        $relics=count(array_filter($level['board'],fn($g)=>($g['type']??'')==='relic'));
        return ['level'=>$level['id'],'mode'=>$mode,'board'=>$level['board'],'tiles'=>$level['tiles'],'cols'=>$level['boardCols'],'rows'=>$level['boardRows'],
            'gemTypes'=>$level['boardLayout']['gemTypes'],'score'=>0,'moves'=>0,'jewels'=>0,'remainingLayers'=>$layers,'totalLayers'=>$layers,'remainingRelics'=>$relics,'totalRelics'=>$relics,
            'oreOrders'=>array_map(fn($order)=>array_merge($order,['progress'=>0]),$level['oreOrders']??[]),'maxCascade'=>1,'comboCounts'=>[],'multiMatchCounts'=>[],'cleared'=>false,'status'=>'active','startedAt'=>time(),'steps'=>[],'receipt'=>null,'continuousCoins'=>0];
    }
    public function matches(array $board,int $cols,int $rows): array {
        $out=[]; $type=fn(int $i)=>in_array($board[$i]['type']??null,self::GEMS,true)?$board[$i]['type']:null;
        foreach($board as $i=>$gem) {
            $t=$type($i); if(!$t)continue;
            if($i%$cols===0 || $type($i-1)!==$t) {
                $line=[$i];for($j=$i+1;$j<count($board)&&$j%$cols!==0&&$type($j)===$t;$j++)$line[]=$j;
                if(count($line)>=3)$out[]=['type'=>$t,'indices'=>$line,'orientation'=>'horizontal'];
            }
            if($i<$cols || $type($i-$cols)!==$t) {
                $line=[$i];for($j=$i+$cols;$j<count($board)&&$type($j)===$t;$j+=$cols)$line[]=$j;
                if(count($line)>=3)$out[]=['type'=>$t,'indices'=>$line,'orientation'=>'vertical'];
            }
        }
        return $out;
    }
    public function bonuses(array $matches,?array $swap=null): array {
        $indices=$swap?[$swap['aIndex'],$swap['bIndex']]:[];$crosses=[];$out=[];$used=[];
        foreach($matches as $h)foreach($matches as $v) {
            if(($h['orientation']??'')!=='horizontal'||($v['orientation']??'')!=='vertical'||$h['type']!==$v['type'])continue;
            $overlap=array_values(array_intersect($h['indices'],$v['indices'])); if(!$overlap)continue;
            $union=array_values(array_unique(array_merge($h['indices'],$v['indices'])));if(count($union)<5)continue;
            $crosses[]=['index'=>$overlap[0],'indices'=>$union,'priority'=>[in_array($overlap[0],$indices,true)?1:0,array_intersect($union,$indices)?1:0,count($union)]];
        }
        usort($crosses,fn($a,$b)=>$b['priority']<=>$a['priority']);
        foreach($crosses as $c)if(!array_intersect($used,$c['indices'])){$out[]=['type'=>'cross','index'=>$c['index']];$used=array_merge($used,$c['indices']);}
        foreach($matches as $m) {
            if(!in_array($m['orientation']??'', ['horizontal','vertical'],true)||count($m['indices'])<4||array_intersect($used,$m['indices']))continue;
            $location=array_values(array_intersect($indices,$m['indices']))[0]??$m['indices'][intdiv(count($m['indices']),2)];
            $out[]=['type'=>count($m['indices'])>=5?'rainbow':'bomb','index'=>$location];
        }
        return $out;
    }
    private function footprint(string $type,array $board,int $cols,int $rows,int $index,?string $target=null,int $radius=1,bool $diagonals=false): array {
        $out=[];$y=intdiv($index,$cols);$x=$index%$cols;
        if($type==='rainbow') {
            if($target!==null) { foreach($board as $i=>$g)if($target==='all'||($g['type']??null)===$target)$out[]=$i; }
            else {
                $available=array_keys(array_filter($board,fn($g,$i)=>$g&&$i!==$index,ARRAY_FILTER_USE_BOTH));
                for($n=0;$n<15&&$available;$n++){$j=($this->random)(count($available));$out[]=array_splice($available,$j,1)[0];}
            }
            $out[]=$index;
        } elseif(in_array($type,['cross','tile-breaker'],true)) {
            for($col=0;$col<$cols;$col++)$out[]=$y*$cols+$col;
            for($row=0;$row<$rows;$row++) {
                $out[]=$row*$cols+$x;
                if($diagonals)foreach([$x+$row-$y,$x-$row+$y] as $col)if($col>=0&&$col<$cols)$out[]=$row*$cols+$col;
            }
        } else foreach($board as $i=>$gem) {
            $iy=intdiv($i,$cols);$ix=$i%$cols;
            $hit=match($type){
                'bomb','tnt'=>abs($iy-$y)<=$radius&&abs($ix-$x)<=$radius,
                'cross','tile-breaker'=>$iy===$y||$ix===$x||($diagonals&&abs($iy-$y)===abs($ix-$x)),
                'clear-row'=>$iy===$y,
                'color-wand'=>$target!==null&&($gem['type']??null)===$target,
                default=>false,
            };if($hit)$out[]=$i;
        }
        return array_values(array_unique($out));
    }
    private function dominant(array $board): string {
        $counts=array_fill_keys(self::GEMS,0);foreach($board as $g)if(isset($counts[$g['type']??'']))$counts[$g['type']]++;
        arsort($counts,SORT_NUMERIC);return array_key_first($counts);
    }
    public function fusion(array $board,int $cols,int $rows,array $swap): ?array {
        [$a,$b]=[$swap['aIndex'],$swap['bIndex']];
        if(!in_array($board[$a]['type']??null,self::BONUSES,true)||!in_array($board[$b]['type']??null,self::BONUSES,true))return null;
        if(!in_array($b,$this->neighbors($a,$cols,$rows),true))return null;
        $types=[$board[$a]['type'],$board[$b]['type']];sort($types);$key=implode('+',$types);$targets=[$a,$b];$target=null;$nodes=[];
        switch($key) {
            case 'rainbow+rainbow':$targets=range(0,count($board)-1);break;
            case 'bomb+cross':
                foreach($board as $i=>$g)if((intdiv($i,$cols)>=min(intdiv($a,$cols),intdiv($b,$cols))-1&&intdiv($i,$cols)<=max(intdiv($a,$cols),intdiv($b,$cols))+1)||($i%$cols>=min($a%$cols,$b%$cols)-1&&$i%$cols<=max($a%$cols,$b%$cols)+1))$targets[]=$i;
                foreach([$a,$b] as $i)$nodes[]=['index'=>$i,'type'=>'cross','width'=>3];
                break;
            case 'bomb+bomb':case 'cross+cross':
                foreach([$a,$b] as $i) {
                    $targets=array_merge($targets,$this->footprint($types[0],$board,$cols,$rows,$i,null,2,true));
                    $nodes[]=['index'=>$i,'type'=>$types[0]]+($types[0]==='bomb'?['radius'=>2]:['diagonals'=>true]);
                }break;
            default:
                $target=$this->dominant($board);$origins=[$a,$b];foreach($board as $i=>$g)if(($g['type']??null)===$target)$origins[]=$i;
                foreach($origins as $i) {
                    $targets=array_merge($targets,$this->footprint($types[0],$board,$cols,$rows,$i));
                    $nodes[]=['index'=>$i,'type'=>$types[0]]+($types[0]==='bomb'?['radius'=>1]:['diagonals'=>false]);
                }
        }
        $targets=array_values(array_unique($targets));sort($targets);
        return ['key'=>$key,'pair'=>[['index'=>$a,'type'=>$board[$a]['type']],['index'=>$b,'type'=>$board[$b]['type']]],'nodes'=>$nodes,'targetType'=>$target,'damage'=>2,'targets'=>$targets];
    }
    private function activate(array $board,int $cols,int $rows,array $swap,?array $fusion=null,?array $gems=null): array {
        [$a,$b]=[$swap['aIndex'],$swap['bIndex']];$gems??=['a'=>$board[$a]??null,'b'=>$board[$b]??null];$queue=[];$processed=[];$out=[];
        $enqueue=function(int $i,?array $g,?array $other=null,bool $chain=false)use(&$queue,$fusion,$board){
            if(!in_array($g['type']??null,self::BONUSES,true))return;
            $target=null;if($g['type']==='rainbow') {
                if($chain&&$fusion)$target=$fusion['targetType']??$this->dominant($board);
                elseif(!$chain&&$other)$target=$other['type']==='rainbow'?'all':(in_array($other['type'],self::BONUSES,true)?null:$other['type']);
            }
            $queue[]=[$i,$g['type'],$target];
        };
        if($fusion) {
            $processed[$a]=$processed[$b]=true;
            foreach($fusion['targets'] as $i){$out[$i]=true;if(!isset($processed[$i]))$enqueue($i,$board[$i]??null,null,true);}
        } else {$enqueue($a,$gems['a'],$gems['b']);$enqueue($b,$gems['b'],$gems['a']);}
        while($queue) {
            [$i,$type,$target]=array_shift($queue);if(isset($processed[$i]))continue;$processed[$i]=true;
            foreach($this->footprint($type,$board,$cols,$rows,$i,$target) as $j)if(!isset($out[$j])){$out[$j]=true;if($j!==$i&&!isset($processed[$j]))$enqueue($j,$board[$j]??null,null,true);}
        }
        return array_keys($out);
    }
    public function evaluate(array $board,array $tiles,int $cols,int $rows,int $a,int $b,bool $activate=false): array {
        $empty=['board'=>$board,'matches'=>[],'bonuses'=>[],'pendingBonus'=>null];
        if($a<0||$a>=count($board)||!$this->swappable($board[$a],$tiles[$a]??null))return $empty;
        if($activate) {
            if(!in_array($board[$a]['type'],self::BONUSES,true))return $empty;
            return array_replace($empty,['matches'=>[['type'=>'bonus-activation','indices'=>$this->activate($board,$cols,$rows,['aIndex'=>$a,'bIndex'=>-1])]]]);
        }
        if(!in_array($b,$this->neighbors($a,$cols,$rows),true)||!$this->swappable($board[$b],$tiles[$b]??null))return $empty;
        [$board[$a],$board[$b]]=[$board[$b],$board[$a]];$swap=['aIndex'=>$a,'bIndex'=>$b];
        $matches=$this->matches($board,$cols,$rows);$fusion=$this->fusion($board,$cols,$rows,$swap);$gems=['a'=>$board[$a],'b'=>$board[$b]];
        $usesBonus=in_array($gems['a']['type'],self::BONUSES,true)||in_array($gems['b']['type'],self::BONUSES,true);
        $pending=$matches&&$usesBonus?['swap'=>$swap,'fusion'=>$fusion,'swapGems'=>$gems]:null;
        $clear=$pending?[]:$this->activate($board,$cols,$rows,$swap,$fusion);
        if($clear)return ['board'=>$board,'matches'=>[['type'=>'bonus-activation','indices'=>$clear,'fusion'=>$fusion]],'bonuses'=>[],'pendingBonus'=>null];
        if(!$matches)return $empty;
        $bonuses=$this->bonuses($matches,$swap);foreach($bonuses as $bonus)$board[$bonus['index']]['type']=$bonus['type'];
        return ['board'=>$board,'matches'=>$matches,'bonuses'=>$bonuses,'pendingBonus'=>$pending];
    }
    public function hasMove(array $s): bool {
        foreach($s['board'] as $i=>$gem) {
            if(!$this->swappable($gem,$s['tiles'][$i]))continue;
            if(in_array($gem['type'],self::BONUSES,true))return true;
            foreach([$i%$s['cols']<$s['cols']-1?$i+1:-1,$i+$s['cols']] as $j) {
                if($j<0||$j>=count($s['board'])||!$this->swappable($s['board'][$j],$s['tiles'][$j]))continue;
                if($this->evaluate($s['board'],$s['tiles'],$s['cols'],$s['rows'],$i,$j)['matches'])return true;
            }
        }
        return false;
    }
    public function move(array &$s,int $a,int $b,bool $activate=false): void {
        $evaluation=$this->evaluate($s['board'],$s['tiles'],$s['cols'],$s['rows'],$a,$b,$activate);
        if(!$evaluation['matches'])throw new ApiError(422,'This move does not form a match or activate a bonus.');
        $s['moves']++;$this->resolve($s,$evaluation);$this->finish($s);
    }
    public function power(array &$s,string $power,?int $index): void {
        if($power==='shuffle'){$this->shuffle($s,true);$this->finish($s);return;}
        if(!in_array($power,['clear-row','tnt','color-wand','tile-breaker'],true))throw new ApiError(422,'Unknown power.');
        $index??=$power==='clear-row'?random_int(0,$s['rows']-1)*$s['cols']:-1;
        if($index<0||$index>=count($s['board']))throw new ApiError(422,'Choose a tile for this power.');
        $target=$s['board'][$index]['type']??null;
        if($power==='color-wand'&&(!in_array($target,self::GEMS,true)))throw new ApiError(422,'Choose a regular jewel.');
        $indices=$this->footprint($power,$s['board'],$s['cols'],$s['rows'],$index,$target);
        $this->resolve($s,['board'=>$s['board'],'matches'=>[['type'=>'bonus-activation','indices'=>$indices]],'bonuses'=>[],'pendingBonus'=>null]);
        $this->finish($s);
    }
    public function shuffle(array &$s,bool $paid=false): void {
        $movable=[];foreach($s['board'] as $i=>$g)if($this->swappable($g,$s['tiles'][$i]))$movable[]=$i;
        if(count($movable)<2)throw new ApiError(409,'This board cannot be shuffled.');
        // An automatic shuffle never awards free matches; a paid shuffle resolves normally.
        $original=$s['board'];
        for($attempt=0;$attempt<120;$attempt++) {
            $s['board']=$original;
            for($i=count($movable)-1;$i>0;$i--){$j=($this->random)($i+1);$a=$movable[$i];$b=$movable[$j];[$s['board'][$a],$s['board'][$b]]=[$s['board'][$b],$s['board'][$a]];}
            if($paid) {
                $matches=$this->matches($s['board'],$s['cols'],$s['rows']);$bonuses=$this->bonuses($matches);
                foreach($bonuses as $bonus)$s['board'][$bonus['index']]['type']=$bonus['type'];
                $this->resolve($s,['board'=>$s['board'],'matches'=>$matches,'bonuses'=>$bonuses]);$s['shuffled']=true;return;
            }
            if(!$this->matches($s['board'],$s['cols'],$s['rows'])&&$this->hasMove($s)){$s['shuffled']=true;return;}
        }
        $s['board']=$original;throw new ApiError(409,'A playable shuffle could not be generated. Try again.');
    }
    private function finish(array &$s): void {
        $s['remainingLayers']=array_sum(array_map(fn($t)=>($t['health']??0)+($t['chainHealth']??0)+($t['signalHealth']??0),$s['tiles']));
        $s['cleared']=$s['mode']==='normal'&&$s['remainingLayers']===0&&$s['remainingRelics']===0&&!array_filter($s['oreOrders']??[],fn($order)=>$order['progress']<$order['target']);
        if(!$s['cleared']&&!$this->hasMove($s))$this->shuffle($s);
    }
    private function gravity(array &$s,int $iteration,array &$step): void {
        $board=&$s['board'];$tiles=&$s['tiles'];$cols=$s['cols'];$rows=$s['rows'];
        for($col=0;$col<$cols;$col++) {
            $write=$rows-1;
            for($row=$rows-1;$row>=0;$row--) {
                $i=$row*$cols+$col;$t=$tiles[$i];
                if(($t['chainHealth']??0)>0&&($t['state']??'')!=='FROZEN'&&$t['type']!=='blocker')continue;
                if(self::anchored($t)){$write=$row-1;continue;}
                if($board[$i]) {
                    while($write>=0&&self::anchored($tiles[$write*$cols+$col]))$write--;
                    $to=$write*$cols+$col;
                    if($to!==$i){$board[$to]=$board[$i];$board[$i]=null;$step['drops'][]=['from'=>$i,'to'=>$to,'gem'=>$board[$to]];}
                    $write--;
                }
            }
            for($row=$write;$row>=0;$row--) {
                $i=$row*$cols+$col;if(self::anchored($tiles[$i]))continue;
                $type=$this->choose($s['gemTypes']);
                if($iteration>=24)foreach($s['gemTypes'] as $candidate) {
                    $test=$board;$test[$i]=['type'=>$candidate];$bad=false;
                    foreach($this->matches($test,$cols,$rows) as $m)if(in_array($i,$m['indices'],true)){$bad=true;break;}
                    if(!$bad){$type=$candidate;break;}
                }
                $board[$i]=$this->gem($type);$step['spawns'][]=['index'=>$i,'gem'=>$board[$i]];
            }
        }
    }
    private function step(int $iteration,array $matches=[]): array {
        return ['index'=>$iteration,'matches'=>array_map(fn($m)=>array_intersect_key($m,array_flip(['type','indices','orientation'])),$matches),'cleared'=>[],'drops'=>[],'spawns'=>[],'bonuses'=>[],'tileUpdates'=>[],'collectedJewels'=>[]];
    }
    public function resolve(array &$s,array $evaluation): void {
        $s['board']=$evaluation['board'];$board=&$s['board'];$tiles=&$s['tiles'];$cols=$s['cols'];$rows=$s['rows'];
        $pending=$evaluation['matches'];$pendingBonus=$evaluation['pendingBonus']??null;$steps=[];$iteration=0;
        while($pending) {
            if($iteration>=128)throw new ApiError(409,'The cascade could not settle. Please retry.');
            $impacted=[];$cleared=[];$protected=[];$fusion=null;
            foreach($pending as $m)if($m['fusion']??null){$fusion=$m['fusion'];break;}
            $fusionTargets=array_fill_keys($fusion['targets']??[],true);
            foreach($pending as $m)foreach($m['indices'] as $i) {
                if($i<0||$i>=count($board))continue;
                if(($tiles[$i]['state']??'')==='FROZEN'&&!isset($fusionTargets[$i]))continue;
                $impacted[$i]=true;if($board[$i]&&$board[$i]['type']!=='relic'&&!self::anchored($tiles[$i]))$cleared[$i]=true;
            }
            $bonuses=$steps?$this->bonuses($pending):($evaluation['bonuses']??[]);
            foreach($bonuses as $bonus) {
                $i=$bonus['index'];if($steps)$board[$i]=$this->gem($bonus['type']);
                $protected[$i]=true;unset($cleared[$i]);
            }
            $damage=$impacted+$protected;
            foreach(array_keys($damage) as $i)foreach($this->neighbors($i,$cols,$rows) as $j)if($tiles[$j]['type']==='blocker'&&$tiles[$j]['health']>0)$damage[$j]=true;
            if(!$damage&&!$pendingBonus)break;
            $step=$this->step($iteration,$pending);
            foreach($bonuses as $bonus)$step['bonuses'][]=$bonus+['gem'=>$board[$bonus['index']]];
            if($fusion){$step['bonusFusion']=$fusion;$step['bonusSwap']=$fusion['pair'];}
            // Survey markers advance one order per cascade step; lanterns accept any adjacent hit.
            $survey=PHP_INT_MAX;$touched=$impacted+$protected;
            foreach($tiles as $tile)if(($tile['signalHealth']??0)>0&&($tile['surveyOrder']??0)>0)$survey=min($survey,$tile['surveyOrder']);
            foreach(array_keys($touched) as $i)foreach($this->neighbors($i,$cols,$rows) as $j)$touched[$j]=true;
            foreach(array_keys($touched) as $i)if(($tiles[$i]['signalHealth']??0)>0&&(!($tiles[$i]['surveyOrder']??0)||$tiles[$i]['surveyOrder']===$survey)) {
                $tiles[$i]['signalHealth']=0;$step['tileUpdates'][]=['index'=>$i,'signalHealth'=>0];
            }
            foreach(array_keys($damage) as $i) {
                $tile=&$tiles[$i];$hits=isset($fusionTargets[$i])?2:1;$isFusion=$hits===2;
                if($isFusion&&($tile['state']??'')==='FROZEN'){$tile['state']='PLAYABLE';$step['tileUpdates'][]=['index'=>$i,'state'=>'PLAYABLE'];}
                if(($tile['chainHealth']??0)>0) {
                    $n=min($hits,$tile['chainHealth']);$tile['chainHealth']-=$n;$hits-=$n;
                    $step['tileUpdates'][]=['index'=>$i,'chainHealth'=>$tile['chainHealth']];
                    if(!$hits){unset($tile);continue;}
                }
                $sealHit=!isset($tile['sealColor'])||$isFusion;
                if(!$sealHit)foreach($pending as $m)if(in_array($i,$m['indices'],true)&&($m['type']===$tile['sealColor']||!in_array($m['type'],self::GEMS,true)))$sealHit=true;
                if(($tile['health']??0)>0&&$sealHit) {
                    $before=$tile['health'];$tile['maxHealth']??=$before;$tile['health']=max(0,$before-$hits);$tile['cleared']=$tile['health']===0;
                    if($tile['type']==='blocker'&&$tile['cleared'])$tile['type']='standard';
                    $step['tileUpdates'][]=['index'=>$i,'health'=>$tile['health'],'maxHealth'=>$tile['maxHealth'],'type'=>$tile['type']];
                }
                if($isFusion&&$board[$i]&&$board[$i]['type']!=='relic'&&!self::anchored($tile)&&!isset($protected[$i]))$cleared[$i]=true;
                if(isset($cleared[$i])&&!isset($protected[$i])) {
                    // Preserve the existing fusion economy: fusion hits score but do not count mining jewels.
                    if(in_array($board[$i]['type']??null,self::GEMS,true))$step[$isFusion?'fusionOreJewels':'collectedJewels'][]=['id'=>$board[$i]['id'],'type'=>$board[$i]['type']];
                    $board[$i]=null;
                }
                unset($tile);
            }
            $step['cleared']=array_keys($cleared);sort($step['cleared']);
            foreach(array_keys($cleared) as $i)foreach($this->neighbors($i,$cols,$rows) as $j)if(($tiles[$j]['state']??'')==='FROZEN'){$tiles[$j]['state']='PLAYABLE';$step['tileUpdates'][]=['index'=>$j,'state'=>'PLAYABLE'];}
            if($pendingBonus) {
                $steps[]=$step;$indices=$this->activate($board,$cols,$rows,$pendingBonus['swap'],$pendingBonus['fusion'],$pendingBonus['swapGems']);
                $pending=[['type'=>'bonus-activation','indices'=>$indices,'fusion'=>$pendingBonus['fusion']]];$pendingBonus=null;continue;
            }
            $this->gravity($s,$iteration,$step);$steps[]=$step;
            while(true) {
                $collected=[];for($i=($rows-1)*$cols;$i<count($board);$i++)if(($tiles[$i]['exit']??false)&&($board[$i]['type']??null)==='relic'&&!self::anchored($tiles[$i])){$collected[]=['index'=>$i,'gem'=>$board[$i]];$board[$i]=null;}
                if(!$collected)break;
                $s['remainingRelics']-=count($collected);$collection=$this->step($iteration);$collection['collectedRelics']=$collected;$this->gravity($s,$iteration,$collection);$steps[]=$collection;
            }
            $pending=$this->matches($board,$cols,$rows);$iteration++;
        }
        $s['steps']=$steps;
        foreach($steps as $step) {
            foreach(array_merge($step['collectedJewels'],$step['fusionOreJewels']??[]) as $jewel) {
                foreach($s['oreOrders'] as &$order)if($order['color']===$jewel['type']){$order['progress']=min($order['target'],$order['progress']+1);break;}
                unset($order);
            }
            $s['jewels']+=count($step['collectedJewels']);$count=count($step['cleared']);if(!$count)continue;
            $tier=$step['index']+1;$s['score']+=$count*100*$tier;$s['maxCascade']=max($s['maxCascade'],$tier);
            if($s['mode']==='normal') {
                if($tier>=2)$s['comboCounts'][$tier]=($s['comboCounts'][$tier]??0)+1;
                $lines=count(array_filter($step['matches'],fn($m)=>in_array($m['type'],self::GEMS,true)&&in_array($m['orientation']??'', ['horizontal','vertical'],true)&&count($m['indices'])>=3&&array_intersect($m['indices'],$step['cleared'])));
                if($lines>=2)$s['multiMatchCounts'][$lines]=($s['multiMatchCounts'][$lines]??0)+1;
            }
        }
    }
}
