param(
  [string]$Page = 'docs/index.html',
  # Query string on the file:// URL. index.html reads ?z=N at boot and parks the
  # cat and the camera straight into that zone (line ~2855), which is the only
  # reliable way to get an off-camera panel into frame: goto() and cat live in
  # the page script's IIFE scope, so nothing outside it can call them.
  [string]$Query = '',
  [string]$Selector = '.btn',
  [double]$X = 0.5,
  [double]$Y = 0.5,
  [string]$Out = 'out/hover.png',
  [int]$Width = 1280,
  [int]$Height = 900,
  [int]$DelayMs = 2500,
  # Which zone to switch to first. The home page is a horizontal world: the
  # notice-board cards exist from the start but sit off-camera, so probing one
  # without moving there reports "no match" and looks like the effect is missing.
  # Uses the page's own #znav click wiring rather than calling goto() directly,
  # which may be private to its script scope.
  [int]$Zone = -1,
  # Extra CSS injected after the transition reset. Needed whenever the thing
  # under test is triggered by a CSS :hover rule that headless never fires --
  # .pip's zone label, for one: `.pip:hover b{opacity:1}`. Synthesised pointer
  # events reach glass.js's JS handlers but cannot set :hover, so without this
  # the label stays invisible and a clipping regression reads as "no bug".
  [string]$ExtraCss = '',
  # Skip the injected <style> entirely and read whatever the page really
  # computes. Needed for the questions the injection itself destroys: it forces
  # `transition:none !important`, so every restore-on-exit capture under it
  # reports "no transition" no matter what glass.css says.
  [switch]$Raw,
  # Dispatch pointerleave after the enter/move, so the report describes the
  # element *after* the pointer has gone. This is the only way to see the
  # restore half of the effect -- and the only way to read the transition
  # glass.css hands it on the way out.
  [switch]$Leave,
  # Leave the generated _hv.html on disk. The injected script is the part most
  # likely to be wrong (a JavaScript syntax error kills the whole listener and
  # the probe then silently draws nothing), and it cannot be read back out of a
  # screenshot.
  [switch]$Keep,
  # Dispatch the pointer events on a NESTED glass element instead of on the one
  # being read. The event still bubbles, so the outer element sees it too --
  # which is exactly the "pointer moved from the card onto a button inside it"
  # case. Reports the OUTER element, so you can watch whether it kept tilting or
  # reset to zero.
  [string]$Inner = ''
)

<#
  Hover cannot be photographed: headless has no real pointer, so :hover is
  never true. This synthesises pointerenter + pointermove at a chosen fraction
  of the element's box -- exactly what glass.js listens for. It adds
  .glass-live, and the CSS keys the glow off that class as well as :hover.

  Three headless-only workarounds live in the injected script, all of them
  measurement artefacts rather than fixes:

    1) prefers-reduced-motion is FALSE here, so glass.css's reduced-motion block
       is inactive and the tilt works unassisted.
    2) --virtual-time-budget does NOT advance the CSS animation timeline. Any
       transition sits frozen at its start value forever, and glass.css
       transitions opacity on the way OUT, so the glow's computed opacity reads
       0 and nothing paints. Transitions must therefore be killed outright --
       outside any media query.
    3) file:// stylesheets are cross-origin, so cssRules throws. Rules cannot be
       introspected; computed styles are all we get.

  The script paints its own numbers onto the screenshot (document.title is not
  in a picture) and paints any exception too -- a probe that silently draws
  nothing is indistinguishable from a probe that found no bug.
#>
$ErrorActionPreference = 'Stop'
$root = 'C:\WorkFiles\blog'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$ErrorActionPreference = 'Continue'

$src = Join-Path $root $Page
if (-not (Test-Path $src)) { throw ("no such page: " + $src) }
$probePath = Join-Path (Split-Path -Parent $src) '_hv.html'
$html = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)

# Switch values have to become JavaScript booleans here, not in the template.
# Writing `if ('$Raw' -ne 'True')` inside the script block is PowerShell syntax
# leaking into JavaScript: V8 reads `'False' - ne 'True'` as string, minus,
# identifier, string and stops with "SyntaxError: Unexpected string" -- which
# kills the entire <script> block SILENTLY. No window.onerror, no console, and a
# probe that draws nothing looks exactly like a probe that found no bug.
$jsRaw   = if ($Raw)   { 'false' } else { 'true' }
$jsLeave = if ($Leave) { 'true'  } else { 'false' }

$probe = @"
<script>
function hvBox(lines, bad) {
  var b = document.createElement('pre');
  b.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;margin:0;padding:6px 10px;' +
    'background:' + (bad ? '#3a0008' : '#000') + ';color:' + (bad ? '#ff9aa8' : '#0f0') + ';' +
    'font:13px/1.5 Consolas,monospace;white-space:pre;border-bottom:2px solid ' +
    (bad ? '#ff9aa8' : '#0f0') + ';max-width:100%';
  b.textContent = lines.join('\n');
  document.body.appendChild(b);
}
window.addEventListener('error', function (e) {
  hvBox(['PROBE ERROR: ' + (e.message || e) + ' @' + (e.lineno || '?')], true);
});
window.addEventListener('load', function () {
  setTimeout(function () {
    try { run(); } catch (err) { hvBox(['PROBE THREW: ' + err.message + '\n' + (err.stack || '')], true); }
  }, 700);

  function run() {
    /* -Raw injects nothing. Every other run neutralises the transition
       timeline (--virtual-time-budget does not advance it) and pins the tilt
       formula, which is what makes a hover state photographable -- and what
       makes it useless for asking "what does this page really compute". */
    if ($jsRaw) {
      var s = document.createElement('style');
      s.textContent =
        '.glass{ transition:none !important; }' +
        '.glass.tilt{ transform:perspective(700px) rotateX(var(--rx)) rotateY(var(--ry)) !important; }' +
        '.glass.glass-live{ border-color:var(--amber) !important; }' +
        '$ExtraCss';
      document.head.appendChild(s);
    }

    var el = document.querySelector('$Selector');
    if (!el) {
      hvBox(['NO MATCH for $Selector',
             'present:', (document.querySelectorAll('$Selector') || []).length,
             'glass count:', document.querySelectorAll('.glass').length,
             'glass tilt :', document.querySelectorAll('.glass.tilt').length], true);
      return;
    }
    if ($Zone >= 0) { moveIntoView(el, 0); } else { probe(el); }
    return;

    // The home page is a horizontal world and the camera follows the cat, which
    // walks there over several animation frames. Clicking the nav button and
    // hoping 1.8s is enough makes the capture a shot of empty sky with the
    // numbers still correct -- which reads as "off-screen, no bug" when the card
    // was simply never on camera. Poll the element's own rect instead of
    // guessing a delay.
    function moveIntoView(el, triesLeft) {
      if (triesLeft <= 0) { probe(el); return; }
      var r = el.getBoundingClientRect();
      var onScreen = r.left >= 0 && r.right <= window.innerWidth &&
                     r.top >= 0 && r.bottom <= window.innerHeight;
      if (onScreen) { setTimeout(function () { probe(el); }, 400); return; }
      /* goto() only sets cat.target; the cat walks there over several frames and
         the camera trails it. Under --virtual-time-budget those frames do not
         reliably advance, so the capture ends up photographing empty sky while
         the numbers still read correctly -- which reads as "card is off-screen,
         no bug" rather than "the camera never got there". Teleport the cat as
         well, then let one frame settle the camera. */
      if (typeof goto === 'function') { goto($Zone); }
      try { cat.x = cat.target; } catch (e) {}
      setTimeout(function () { moveIntoView(el, triesLeft - 1); }, 260);
    }
  }

  function probe(target) {
    var r = target.getBoundingClientRect();
    if (!r.width) { hvBox(['zero-size target: ' + target.className], true); return; }
    /* Dispatch on a nested glass child when asked, so the outer element receives
       the same bubbled event and we can see whether it kept its tilt. */
    var src = target;
    if ('$Inner' !== '') {
      var inr = target.querySelector('$Inner');
      if (!inr) {
        hvBox(['NO INNER $Inner inside $Selector',
               'inner count:', target.querySelectorAll('$Inner').length], true);
        return;
      }
      src = inr;
    }
    var ev = { clientX: r.left + r.width * $X, clientY: r.top + r.height * $Y,
               bubbles: true, pointerId: 1, pointerType: 'mouse' };
    src.dispatchEvent(new PointerEvent('pointerenter', ev));
    src.dispatchEvent(new PointerEvent('pointermove', ev));
    /* report() runs in its own task, so the try/catch around run() cannot see
       it -- a throw there draws nothing at all, and a probe that draws nothing
       is indistinguishable from a probe that found no bug. Wrap both exits. */
    function finish() {
      try { report(target, r, src); }
      catch (e) { hvBox(['REPORT THREW: ' + e.message + '\n' + (e.stack || '')], true); }
    }
    if ($jsLeave) {
      setTimeout(function () {
        target.dispatchEvent(new PointerEvent('pointerleave', ev));
        setTimeout(finish, 120);
      }, 300);
      return;
    }
    setTimeout(finish, 500);
  }

  function report(el, r, src) {
    var cs = getComputedStyle(el);
    var pb = getComputedStyle(el, '::before');
    var pa = getComputedStyle(el, '::after');
    var rows = [
      '$Selector @$X,$Y   ' + Math.round(r.width) + 'x' + Math.round(r.height) +
             '   src=' + ('$Inner' === '' ? 'self' : '$Inner'),
      'class = ' + el.className,
      'point gx=' + el.style.getPropertyValue('--gx') +
             '  gy=' + el.style.getPropertyValue('--gy'),
      'tilt  rx=' + el.style.getPropertyValue('--rx') +
             '  ry=' + el.style.getPropertyValue('--ry') +
             '   live=' + el.classList.contains('glass-live'),
      'box   l=' + pb.left + ' t=' + pb.top + ' w=' + pb.width +
             '  bgSize=' + pb.backgroundSize,
      'paint before=' + pb.opacity + ' after=' + pa.opacity +
             '  blend=' + pb.mixBlendMode,
      'bg    ' + cs.backgroundColor + '  border=' + cs.borderTopWidth + ' ' + cs.borderTopColor,
      'edge  ' + pa.borderTopWidth + ' ' + pa.borderTopColor +
             '  mask=' + pa.webkitMaskSize + ' @' + pa.webkitMaskPosition,
      'xform ' + cs.transform.slice(0, 52),
      'trans prop=' + cs.transitionProperty.slice(0, 34) +
             '  dur=' + cs.transitionDuration.slice(0, 30) +
             '  ease=' + cs.transitionTimingFunction.slice(0, 22),
      'rect   L' + Math.round(r.left) + ' T' + Math.round(r.top) + ' R' + Math.round(r.right) + ' B' + Math.round(r.bottom) + '  vp=' + window.innerWidth + 'x' + window.innerHeight + '\n' +
      'count glass=' + document.querySelectorAll('.glass').length +
             '  tilt=' + document.querySelectorAll('.glass.tilt').length +
             '  flat=' + document.querySelectorAll('.glass.glass-flat').length
    ];
    /* Read the nested level in the SAME run. "The outer card kept its tilt while
       the pointer sat on the inner button" is only provable if both numbers come
       from one page at one pointer position -- two separate runs are two separate
       moments and prove nothing about simultaneity. */
    if (src && src !== el) {
      var si = getComputedStyle(src);
      rows.push('INNER ' + src.className);
      rows.push('  rx=' + src.style.getPropertyValue('--rx') +
                '  ry=' + src.style.getPropertyValue('--ry') +
                '   live=' + src.classList.contains('glass-live') +
                '  border=' + si.borderTopColor);
    }
    hvBox(rows, false);
  }
});
</script>
"@

[System.IO.File]::WriteAllText($probePath, ($html -replace '</body>', ($probe + "`n</body>")), $utf8)
if (-not [System.IO.Path]::IsPathRooted($Out)) { $Out = Join-Path $root $Out }
$prof = Join-Path $env:TEMP ('hvprof-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
$errLog = Join-Path $env:TEMP 'hover-err.log'
$probeUrl = 'file:///' + (($probePath -replace '\\', '/') -replace ' ', '%20')
if ($Query -ne '') { $probeUrl = $probeUrl + '?' + $Query }
& $edge '--headless=new' '--disable-gpu' '--no-sandbox' '--hide-scrollbars' `
        '--force-device-scale-factor=1' ('--window-size={0},{1}' -f $Width, $Height) `
        ('--user-data-dir=' + $prof) ('--virtual-time-budget=' + ($DelayMs + 4000)) `
        ('--screenshot=' + $Out) $probeUrl *> $errLog
Start-Sleep -Milliseconds 1200
if (-not $Keep) { [System.IO.File]::Delete($probePath) } else { Write-Output ("probe kept: " + $probePath) }
if (-not (Test-Path $Out)) { throw "no screenshot: $Out" }
Write-Output ("OK " + $Out + "  (" + (Get-Item $Out).Length + " bytes)")
