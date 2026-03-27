/**
 * Terminal-to-Mobile WebSocket Handshake
 *
 * Starts an HTTP + WebSocket server. The QR code encodes the server URL.
 * When scanned, the phone opens a mobile-optimized page and connects.
 * The terminal detects the connection and streams any text the user types
 * on their phone directly into the terminal session.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

// Minimal mobile web UI — served to the phone browser after scan
const MOBILE_PAGE = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terminal Link</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d0d;color:#00ff41;font-family:monospace;padding:20px;min-height:100vh}
h1{font-size:14px;letter-spacing:3px;color:#444;margin-bottom:20px}
#st{font-size:18px;font-weight:bold;padding:14px;border:1px solid;border-radius:4px;text-align:center;margin-bottom:20px}
.on{border-color:#00ff41;background:#0a1a0a}.off{border-color:#ff0040;color:#ff0040;background:#1a000a}
textarea{width:100%;height:160px;background:#111;color:#00ff41;border:1px solid #00ff41;padding:12px;font-size:15px;font-family:monospace;outline:none;resize:none;border-radius:4px}
button{display:block;width:100%;margin-top:12px;padding:18px;background:#00ff41;color:#000;border:none;font-size:18px;font-family:monospace;font-weight:bold;border-radius:4px;cursor:pointer;letter-spacing:2px}
button:active{background:#00cc33}
#log{margin-top:14px;font-size:12px;color:#444;min-height:20px}
</style>
</head>
<body>
<h1>◈ QR TERMINAL LINK</h1>
<div id="st" class="off">○ CONNECTING...</div>
<textarea id="inp" placeholder="Type here — press TRANSMIT to send to the terminal"></textarea>
<button onclick="send()">▶ TRANSMIT TO TERMINAL</button>
<div id="log"></div>
<script>
var ws=new WebSocket('ws://'+location.host);
var st=document.getElementById('st');
var log=document.getElementById('log');
ws.onopen=function(){st.textContent='● DEVICE LINKED';st.className='on'};
ws.onclose=function(){st.textContent='○ DISCONNECTED';st.className='off'};
function send(){
  var t=document.getElementById('inp').value.trim();
  if(!t||ws.readyState!==1)return;
  ws.send(t);
  log.textContent='✓ Sent '+t.length+' chars';
  document.getElementById('inp').value='';
}
document.getElementById('inp').addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();send()}
});
</script>
</body>
</html>`;

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

/**
 * Start the handshake server.
 *
 * @returns {Promise<{url, waitForDevice, onMessage, close}>}
 *   url           — The URL to encode in the QR code
 *   waitForDevice — Promise that resolves when the first phone connects
 *   onMessage     — Register a callback for incoming phone messages
 *   close         — Shut down the server
 */
export function startHandshakeServer() {
  return new Promise((resolve, reject) => {
    const port = 3847 + Math.floor(Math.random() * 100);
    const ip   = getLocalIP();
    const url  = `http://${ip}:${port}`;

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(MOBILE_PAGE);
    });

    const wss = new WebSocketServer({ server });
    const messageHandlers = [];
    let deviceConnectResolve = null;
    const deviceConnected = new Promise(r => { deviceConnectResolve = r; });

    wss.on('connection', (ws) => {
      deviceConnectResolve(); // signal first connection
      ws.on('message', (raw) => {
        const text = raw.toString();
        messageHandlers.forEach(h => h(text));
      });
    });

    server.on('error', reject);

    server.listen(port, () => {
      resolve({
        url,
        waitForDevice: deviceConnected,
        onMessage:     (handler) => messageHandlers.push(handler),
        close:         () => { wss.close(); server.close(); },
      });
    });
  });
}
