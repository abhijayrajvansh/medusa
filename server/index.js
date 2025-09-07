/* Simple WebSocket -> SSH bridge for local development */
const http = require('http');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');

const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SSH WS server running');
});

const wss = new WebSocketServer({ server });

function log(...args) {
  if (process.env.DEBUG) console.log('[WS]', ...args);
}

wss.on('connection', (ws) => {
  log('client connected');
  let ssh; // ssh2 Client
  let shellStream; // interactive shell stream

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch {
      return;
    }

    if (msg.type === 'connect') {
      const { config, cols = 80, rows = 24 } = msg;
      if (!config || !config.host || !config.username) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing host or username' }));
        return;
      }
      ssh = new Client();
      ssh.on('ready', () => {
        ws.send(JSON.stringify({ type: 'ready' }));
        ssh.shell({ cols, rows, term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            ws.send(JSON.stringify({ type: 'error', error: String(err) }));
            ws.close();
            return;
          }
          shellStream = stream;
          stream.on('data', (d) => {
            try { ws.send(JSON.stringify({ type: 'data', data: d.toString('utf8') })); } catch {}
          });
          stream.on('close', () => {
            try { ws.send(JSON.stringify({ type: 'close' })); } catch {}
            ws.close();
            ssh.end();
          });
        });
      }).on('error', (err) => {
        try { ws.send(JSON.stringify({ type: 'error', error: String(err?.message || err) })); } catch {}
      }).on('end', () => {
        try { ws.send(JSON.stringify({ type: 'close' })); } catch {}
        ws.close();
      }).connect({
        host: config.host,
        port: Number(config.port) || 22,
        username: config.username,
        password: config.authMethod === 'password' ? config.password : undefined,
        privateKey: config.authMethod === 'key' ? config.privateKey : undefined,
        passphrase: config.authMethod === 'key' ? config.passphrase : undefined,
        tryKeyboard: true,
        readyTimeout: 20000,
      });
    } else if (msg.type === 'input') {
      if (shellStream) shellStream.write(msg.data);
    } else if (msg.type === 'resize') {
      if (shellStream) shellStream.setWindow(msg.rows || 24, msg.cols || 80, 600, 800);
    } else if (msg.type === 'disconnect') {
      try { ws.send(JSON.stringify({ type: 'info', message: 'Disconnecting' })); } catch {}
      try { if (shellStream) shellStream.close(); } catch {}
      try { if (ssh) ssh.end(); } catch {}
      try { ws.close(); } catch {}
    }
  });

  ws.on('close', () => {
    if (shellStream) try { shellStream.close(); } catch {}
    if (ssh) try { ssh.end(); } catch {}
  });
});

server.listen(PORT, () => console.log(`WS SSH server listening on :${PORT}`));

