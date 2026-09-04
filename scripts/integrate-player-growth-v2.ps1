$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'frontend\src\App.tsx'
$backup = "$app.before-growth-v2.bak"

if (!(Test-Path $app)) { throw "App.tsx not found: $app" }
$content = Get-Content $app -Raw

# Import the isolated growth system exactly once.
if ($content -notmatch "from './player-growth-react'") {
  $needle = "import { io, Socket } from 'socket.io-client';"
  if (!$content.Contains($needle)) { throw 'Could not find socket.io import in App.tsx' }
  $import = @"
$needle
import { GrowingPlayerAvatar, GrowthNameTag, PLAYER_BASE_HEIGHT, playerHeightFromSession } from './player-growth-react';
"@
  $content = $content.Replace($needle, $import.TrimEnd())
}

# Add a per-player session clock immediately after the Player function opens.
$playerStart = 'function Player({onNearby,onMove,onPosition,onFootfallEnter,onFootfallLeave}:{onNearby:(b:Billboard|null)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void;onPosition:(p:[number,number,number])=>void;onFootfallEnter:(id:string)=>void;onFootfallLeave:(id:string)=>void}) {'
if ($content.Contains($playerStart) -and $content -notmatch 'const growthSessionStartedAt') {
  $growthState = @"
$playerStart
 const growthSessionStartedAt = useRef(Date.now()).current;
 const [playerHeight, setPlayerHeight] = useState(PLAYER_BASE_HEIGHT);
 useEffect(()=>{
   const updateHeight=()=>setPlayerHeight(playerHeightFromSession(growthSessionStartedAt));
   updateHeight();
   const timer=window.setInterval(updateHeight,250);
   return()=>window.clearInterval(timer);
 },[growthSessionStartedAt]);
"@
  $content = $content.Replace($playerStart, $growthState.TrimEnd())
}

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

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new.TrimEnd())
} elseif ($content -notmatch '<GrowingPlayerAvatar height=\{playerHeight\}') {
  throw 'Could not find the original PlayerAvatar/You block. App.tsx was not modified.'
}

Set-Content -Path $backup -Value (Get-Content $app -Raw) -Encoding UTF8
Set-Content -Path $app -Value $content -Encoding UTF8
Write-Host 'Player growth v2 integrated successfully.'
Write-Host "Backup: $backup"
