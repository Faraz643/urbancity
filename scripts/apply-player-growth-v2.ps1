$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'frontend/src/App.tsx'
if (!(Test-Path $app)) { throw "Could not find $app" }

$text = Get-Content $app -Raw
$backup = "$app.before-player-growth-v2.bak"
Copy-Item $app $backup -Force

# 1. Add the growth import exactly once.
if ($text -notmatch "from './player-growth-react'") {
  $needle = "import { io, Socket } from 'socket.io-client';"
  $import = @"
$needle
import { GrowingPlayerAvatar, GrowthNameTag, PLAYER_BASE_HEIGHT, playerHeightFromSession } from './player-growth-react';
"@
  $text = $text.Replace($needle, $import)
}

# 2. Add a per-player session clock. This is React state, not a window global.
$heightState = " const [playerHeight,setPlayerHeight]=useState(PLAYER_BASE_HEIGHT);\n const sessionStartedAt=useRef(Date.now());\n useEffect(()=>{const tick=()=>setPlayerHeight(playerHeightFromSession(sessionStartedAt.current,Date.now(),10));tick();const id=window.setInterval(tick,1000);return()=>window.clearInterval(id)},[]);\n"
if ($text -notmatch 'sessionStartedAt=useRef\(Date\.now\(\)\)') {
  $needle = " const footfallInsideIds = useRef<Set<string>>(new Set());"
  if ($text.Contains($needle)) { $text = $text.Replace($needle, $needle + "`n" + $heightState) }
  else { throw 'Could not find Player state insertion point.' }
}

# 3. Replace only the original local avatar/name rendering. Never touch remote players.
$old = @"
   <PlayerAvatar moving={velocity.current.lengthSq()>.1}/>
   <Text position={[0,1.85,0]} fontSize={0.28} color="white" anchorX="center">You</Text>
"@
$new = @"
   <GrowingPlayerAvatar height={playerHeight}>
     <PlayerAvatar moving={velocity.current.lengthSq()>.1}/>
   </GrowingPlayerAvatar>
   <GrowthNameTag name="You" height={playerHeight}/>
"@
if ($text.Contains($old)) {
  $text = $text.Replace($old,$new)
} elseif ($text -notmatch '<GrowingPlayerAvatar height=\{playerHeight\}>') {
  throw 'Original local Player avatar block was not found; refusing to patch an unexpected App.tsx.'
}

# 4. Pass height through the network update without making it required server-side.
# The existing server can safely ignore unknown fields; clients that understand it can display it.
$oldMove = "moving:velocity.current.lengthSq()>.1})}"
$newMove = "moving:velocity.current.lengthSq()>.1,height:playerHeight})}"
if ($text.Contains($oldMove) -and $text -notmatch 'moving:boolean;height\?:number') {
  $text = $text.Replace($oldMove,$newMove)
}

# Keep Remote type backwards compatible.
$text = $text.Replace(
  "type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean };",
  "type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean; height?:number };"
)

Set-Content -Path $app -Value $text -Encoding UTF8
Write-Host "Player growth v2 integrated safely into App.tsx."
Write-Host "Backup: $backup"
