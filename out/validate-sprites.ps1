$ErrorActionPreference = 'Stop'
$f = 'C:\WorkFiles\blog\static\index.html'
$t = [System.IO.File]::ReadAllText($f)

# ---- palette ------------------------------------------------------------
$palBlock = [regex]::Match($t, '(?s)var\s+PAL\s*=\s*\{(.*?)\n\};').Groups[1].Value
if(-not $palBlock){ throw 'PAL block not found' }
# 澶у皬鍐欐晱鎰燂細鐢ㄥ瓧绗︿覆鍋氭垚鍛樺垽瀹氥€傞粯璁?hashtable 鏄ぇ灏忓啓涓嶆晱鎰熺殑锛?# 浼氭妸 'K' 鍚堝苟杩?'k'銆?O' 鍚堝苟杩?'o'锛岄偅鏍疯鐢?K/O 涔熶細琚垽鍚堟硶锛岀瓑浜庢病鏍￠獙銆?$palChars = ''
foreach($m in [regex]::Matches($palBlock, '(\w+)\s*:\s*''#')){ $palChars += $m.Groups[1].Value }
"palette keys  : $($palChars.Length)  ->  $(($palChars.ToCharArray() | Sort-Object { $_ }) -join ' ')"

# ---- sprites ------------------------------------------------------------
$expect = @{
  'sit'=@(16,16); 'sleep'=@(16,16); 'house'=@(16,16); 'book'=@(16,16)
  'monitor'=@(16,16); 'sun'=@(16,16); 'search'=@(16,16); 'lock'=@(16,16)
  'cat24'=@(24,24); 'cat24_blink'=@(24,24); 'cat24_sleep_raw'=@(24,24); 'paw'=@(4,5)
}
$sprBlock = [regex]::Match($t, '(?s)var\s+SPR\s*=\s*\{(.*?)\n\};').Groups[1].Value
if(-not $sprBlock){ throw 'SPR block not found' }

$bad = @(); $checked = 0
$re = [regex]'(?s)(?<name>[a-z0-9_]+)\s*:\s*\[(?<body>.*?)\](?=\s*[,A-Za-z0-9_]*\s*[,}]|\s*$)'
foreach($m in $re.Matches($sprBlock)){
  $name = $m.Groups['name'].Value
  if(-not $expect.ContainsKey($name)){ continue }
  $w = $expect[$name][1]
  $h = $expect[$name][0]
  $rows = [regex]::Matches($m.Groups['body'].Value, '"([^"]*)"')
  $i = 0
  foreach($r in $rows){
    $i++
    # cat24_sleep_raw is hand-written in 6-cell groups separated by "|";
    # strip those before measuring, the loader does the same.
    $row = $r.Groups[1].Value -replace '\|',''
    if($row.Length -ne $w){ $bad += ("{0} row {1}: width {2} != {3}" -f $name,$i,$row.Length,$w) }
    foreach($ch in $row.ToCharArray()){
      if($ch -ne '.' -and $palChars.IndexOf($ch) -lt 0){
        $bad += ("{0} row {1}: char '{2}' not in PAL" -f $name,$i,$ch)
      }
    }
  }
  if($i -ne $h){ $bad += ("{0}: {1} rows, expected {2}" -f $name,$i,$h) }
  $checked++
}
"sprites checked: $checked / $($expect.Count)"
if($bad.Count -eq 0){
  'sprites       : OK  (every row width and every palette char valid)'
} else {
  "sprites       : $($bad.Count) PROBLEM(S)"
  $bad | Select-Object -First 20 | ForEach-Object { "   $_" }
}
