# SSH Session Management and Connection Persistence

## Overview

The Medusa SSH Web Terminal implements a browser-based SSH client that maintains session state through a combination of browser-side configuration storage and server-side connection management. This document details how the SSH connection is established, maintained, and persisted across browser refreshes.

## Architecture Components

### 1. Frontend (Next.js)
- **Connection Form** (`src/app/page.tsx`): Collects SSH credentials and configuration
- **Terminal Interface** (`src/app/terminal/page.tsx`): Manages WebSocket connection and xterm.js terminal
- **Session Storage**: Persists SSH configuration in browser's sessionStorage

### 2. Backend (Node.js WebSocket Server)
- **WebSocket Server** (`server/index.js`): Bridges WebSocket connections to SSH
- **SSH Client**: Uses `ssh2` library to maintain actual SSH connections
- **Connection Management**: Handles multiple concurrent SSH sessions

## Connection Establishment Flow

### Phase 1: Configuration Collection
1. User accesses home page (`/`)
2. Fills in SSH connection details:
   - Host/IP address
   - Port (default: 22)
   - Username
   - Authentication method (password or private key)
   - Credentials (password or private key + passphrase)

3. On form submission:
   ```typescript
   const config = {
     host: host.trim(),
     port: Number(port) || 22,
     username: username.trim(),
     authMethod,
     password: authMethod === 'password' ? password : undefined,
     privateKey: authMethod === 'key' ? privateKey : undefined,
     passphrase: authMethod === 'key' ? passphrase : undefined,
   };
   sessionStorage.setItem('sshConfig', JSON.stringify(config));
   router.push('/terminal');
   ```

### Phase 2: WebSocket Connection Establishment
1. Terminal page loads and retrieves config from sessionStorage:
   ```typescript
   const raw = sessionStorage.getItem("sshConfig");
   if (!raw) {
     router.replace("/"); // Redirect if no config found
     return;
   }
   const cfg = JSON.parse(raw);
   ```

2. WebSocket connection is established:
   ```typescript
   const proto = window.location.protocol === "https:" ? "wss" : "ws";
   const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
   const port = process.env.NEXT_PUBLIC_WS_PORT || "3001";
   const wsUrl = `${proto}://${host}:${port}`;
   const ws = new WebSocket(wsUrl);
   ```

### Phase 3: SSH Connection Initialization
1. Once WebSocket is open, client sends connection request:
   ```typescript
   ws.send(JSON.stringify({
     type: "connect",
     config: cfg,
     cols: term.cols,
     rows: term.rows,
   }));
   ```

2. Server receives connection request and establishes SSH connection:
   ```javascript
   ssh = new Client();
   ssh.on('ready', () => {
     ws.send(JSON.stringify({ type: 'ready' }));
     ssh.shell({ cols, rows, term: 'xterm-256color' }, (err, stream) => {
       // Shell stream established
       shellStream = stream;
       // Bind data flow between WebSocket and SSH stream
     });
   }).connect({
     host: config.host,
     port: Number(config.port) || 22,
     username: config.username,
     // Authentication details...
   });
   ```

## Session Persistence Mechanism

### Why Sessions Persist Across Browser Refreshes

The key to understanding why SSH sessions persist across browser refreshes lies in the **server-side connection management**:

1. **Browser Refresh Behavior**:
   - When a browser page is refreshed, the JavaScript context is destroyed
   - The WebSocket connection is terminated
   - However, the SSH connection on the server side remains active briefly

2. **Server-Side Connection Lifecycle**:
   ```javascript
   wss.on('connection', (ws) => {
     let ssh; // ssh2 Client instance
     let shellStream; // Interactive shell stream
     
     // WebSocket handlers...
     
     ws.on('close', () => {
       // Cleanup when WebSocket closes
       if (shellStream) try { shellStream.close(); } catch {}
       if (ssh) try { ssh.end(); } catch {}
     });
   });
   ```

3. **Reconnection Process**:
   - After refresh, new WebSocket connection is established
   - SessionStorage still contains SSH configuration
   - New SSH connection is created with same credentials
   - From user perspective, session appears to persist

### Current Limitations

The current implementation has several limitations:

1. **No True Session Persistence**: Each browser refresh creates a completely new SSH connection
2. **Lost Terminal State**: Command history, current directory, and running processes are lost
3. **No Session Recovery**: Cannot reconnect to existing SSH sessions
4. **Single Session Per Browser**: Multiple tabs cannot share the same SSH session

## Connection Heartbeat and Keep-Alive

### WebSocket Heartbeat
```javascript
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

let hb = setInterval(() => {
  if (ws.readyState === ws.OPEN) {
    try { ws.ping(); } catch {}
  }
}, HEARTBEAT_INTERVAL_MS);
```

### SSH Keep-Alive
```javascript
ssh.connect({
  // ... other config
  keepaliveInterval: Number(process.env.SSH_KEEPALIVE_INTERVAL_MS || 15000),
  keepaliveCountMax: Number(process.env.SSH_KEEPALIVE_COUNT_MAX || 10),
});
```

## Data Flow Architecture

### Client to Server (Input)
```
User Input → xterm.js → WebSocket → Server → SSH Stream
```

### Server to Client (Output)
```
SSH Stream → Server → WebSocket → xterm.js → Terminal Display
```

### Message Types
- **connect**: Initiate SSH connection with credentials
- **input**: Send user input to SSH shell
- **resize**: Update terminal dimensions
- **disconnect**: Explicitly close SSH connection
- **data**: SSH output data
- **ready**: SSH connection established
- **error**: Connection or authentication errors
- **close**: SSH session terminated

## Security Considerations

### Current Security Model
1. **Client-Side Credential Storage**: SSH credentials stored in sessionStorage
2. **Local WebSocket Server**: Assumes server runs on trusted local network
3. **No Encryption**: WebSocket traffic not encrypted (ws://)
4. **No Authentication**: WebSocket server has no access control

### Security Risks
- Credentials exposed in browser memory
- Man-in-the-middle attacks on WebSocket connection
- No protection against unauthorized WebSocket connections
- SSH credentials transmitted in plaintext over WebSocket

## Error Handling and Recovery

### Connection Failure Scenarios
1. **SSH Authentication Failure**: Redirects to home with error message
2. **Network Connectivity Issues**: WebSocket connection fails
3. **SSH Server Unavailable**: Connection timeout
4. **WebSocket Server Down**: Cannot establish initial connection

### Error Recovery Mechanisms
```typescript
const bounceHomeWithError = (message: string) => {
  try {
    sessionStorage.setItem("sshError", message);
    sessionStorage.removeItem("sshConfig");
    wsRef.current?.close();
  } catch {}
  router.replace("/");
};
```

## Configuration Options

### Environment Variables
- `WS_PORT`: WebSocket server port (default: 3001)
- `DEBUG`: Enable debug logging
- `SSH_KEEPALIVE_INTERVAL_MS`: SSH keepalive interval (default: 15000)
- `SSH_KEEPALIVE_COUNT_MAX`: Max keepalive failures (default: 10)
- `WS_HEARTBEAT_INTERVAL_MS`: WebSocket ping interval (default: 30000)

### Client Configuration
- `NEXT_PUBLIC_WS_HOST`: WebSocket server hostname
- `NEXT_PUBLIC_WS_PORT`: WebSocket server port
- `NEXT_PUBLIC_WS_PATH`: WebSocket path
- `NEXT_PUBLIC_WS_URL`: Complete WebSocket URL override

## Areas for Improvement

### 1. True Session Persistence
- Implement session storage on server side
- Use session IDs to reconnect to existing SSH connections
- Maintain session state across browser refreshes

### 2. Multi-Session Support
- Support multiple SSH connections per user
- Session management interface
- Tab-based session switching

### 3. Enhanced Security
- Implement WebSocket authentication
- Add TLS/SSL support for WebSocket connections
- Secure credential storage mechanisms
- Connection encryption

### 4. Connection Recovery
- Automatic reconnection on network failures
- Session migration between WebSocket connections
- Graceful degradation during connectivity issues

### 5. Terminal State Persistence
- Save and restore terminal scrollback buffer
- Preserve command history
- Maintain working directory state

### 6. Monitoring and Logging
- Connection metrics and analytics
- Session duration tracking
- Error reporting and diagnostics

This documentation provides the foundation for understanding the current SSH session management implementation and identifies key areas for enhancement to achieve true session persistence and improved reliability.
