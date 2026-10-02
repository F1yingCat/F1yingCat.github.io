# Replays the cat state machine from index.html step by step, with no browser.
# headless only emits 2-3 rAF frames and then freezes every short timer
# (Chrome logs "no primary task provider"), so the wander cannot be observed
# there over time. This is a logic replay of the same branch structure, not a
# measurement of the running page - it answers "does the machine ever get
# stuck", not "does the browser run it".
$ErrorActionPreference='Stop'

$SCENE_W=640; $ZONE_W=960; $WORLD_W=3840
$WATER_X=3*$ZONE_W+540          # 3420
$cat = @{x=200.0; dir=1; target=$null; moving=$false
         idle=0.0; patrol=$null; pause=0.0; asleep=$false
         nap=0.0; napLim=9.0; pauseLim=2.4}

function Step([double]$dt){
  $c=$cat
  $run=$false; $userActed=$false
  if($c.target -ne $null -or $userActed){ $c.idle=0.0; $c.pause=0.0; $c.nap=0.0; $c.asleep=$false }
  else { $c.idle += $dt }

  if($null -eq $c.target){
    $hiRoad=[Math]::Max(60, $WATER_X-40)
    if($c.asleep){
      $c.nap += $dt
      if($c.nap -gt $c.napLim){ $c.asleep=$false; $c.nap=0.0; $c.idle=0.2 }
    } elseif($c.idle -gt 2.2){
      if($null -eq $c.patrol){
        $span = 300 + (Get-Random -Maximum 1000)*1.2
        if((Get-Random -Maximum 2) -eq 0){ $span = -$span }
        $tgt = $c.x + $span
        $tgt=[Math]::Max(46, [Math]::Min($hiRoad, $tgt))
        if([Math]::Abs($tgt-$c.x) -lt 40){ $tgt=[Math]::Max(46, [Math]::Min($hiRoad, $c.x-($tgt-$c.x))) }
        $c.patrol = $tgt
        $c.pause=0.0; $c.pauseLim = 1.4 + (Get-Random -Maximum 100)*0.032
      } else {
        $pd = $c.patrol - $c.x
        if([Math]::Abs($pd) -lt 4){
          $c.x += $pd; $c.pause += $dt
          if($c.pause -gt $c.pauseLim){
            $c.patrol=$null; $c.pause=0.0
            if($c.idle -gt 34){ $c.asleep=$true; $c.nap=0.0; $c.napLim=7 + (Get-Random -Maximum 100)*0.05 }
          }
        } else {
          $step=[Math]::Min([Math]::Abs($pd), 40*$dt)
          $c.x += $(if($pd -gt 0){$step}else{-$step})
          $c.dir = $(if($pd -lt 0){-1}else{1})
          $run=$true
        }
      }
    }
  } else { $c.asleep=$false }

  if($c.x -lt 30){ $c.x=30 }
  $waterEdge=$WATER_X-26
  if($c.x -gt $waterEdge){ $c.x=[double]$waterEdge; $c.patrol=$null }
  $c.moving = $run
  if($c.asleep){ $c.moving=$false }
  return $run
}

function State($c){
  if($c.asleep){ return 'NAP' }
  if($null -eq $c.patrol){ return 'idle' }
  if([Math]::Abs($c.patrol-$c.x) -lt 4){ return 'SIT' }
  if($c.moving){ return 'walk' }
  return 'stand'
}

$dt=0.05
$t=0.0
$prev=$null
$trans=@()
$minX=99999.0; $maxX=0.0
$longestStill=0.0; $still=0.0
$segs=@()
for($i=0;$i -lt 3000;$i++){
  $t += $dt
  [void](Step $dt)
  $s=State $cat
  $segs += $s
  if($cat.x -lt $minX){ $minX=$cat.x }
  if($cat.x -gt $maxX){ $maxX=$cat.x }
  if($s -eq 'walk'){ $still=0.0 } else { $still+=$dt; if($still -gt $longestStill){ $longestStill=$still } }
  if($s -ne $prev){
    $trans += ('{0,6:N1}s {1,-6} x={2,6:N0}' -f $t,$s,$cat.x)
    $prev=$s
  }
}
$counts=@{}
foreach($s in $segs){ $counts[$s] = 1 + $counts[$s] }

"simulated {0:N0}s of page time ({1} steps)" -f $t,$segs.Count
"x range      : {0:N0} .. {1:N0}   (walkable road is 30..3394)" -f $minX,$maxX
"longest still: {0:N1}s without walking" -f $longestStill
"state counts : {0}" -f (($counts.GetEnumerator()|Sort-Object Name|ForEach-Object{ "$($_.Name)=$($_.Value)" }) -join '  ')
"transitions  : $($trans.Count)"
""
"--- first 34 transitions ---"
$trans | Select-Object -First 34
""
"--- last 12 transitions ---"
$trans | Select-Object -Last 12
