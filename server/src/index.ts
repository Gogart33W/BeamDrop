import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { RoomManager } from './rooms.js';
import type { WSMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const CONFIG_FILE = path.resolve(process.cwd(), 'beamdrop.config.json');

export function loadStaticConfig(): { staticUrl?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveStaticConfig(config: { staticUrl?: string }): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch {}
}

let activeTunnelProc: ChildProcess | null = null;
let currentTunnelUrl: string | null = null;
let tunnelRetryTimeout: NodeJS.Timeout | null = null;

export function getTunnelUrl(): string | null {
  const cfg = loadStaticConfig();
  if (cfg.staticUrl) return cfg.staticUrl;
  return currentTunnelUrl;
}

export function startGlobalTunnel(port: number = PORT): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  if (activeTunnelProc) return;

  try {
    const proc = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=3',
      '-R', `80:127.0.0.1:${port}`,
      'nokey@localhost.run'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    activeTunnelProc = proc;

    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      buffer += text;
      const match = buffer.match(/https:\/\/[a-zA-Z0-9-]+\.(app\.lhr\.life|localhost\.run)/);
      if (match && (!currentTunnelUrl || currentTunnelUrl !== match[0])) {
        currentTunnelUrl = match[0];
        console.log(`🌍 Глобальний доступ через Інтернет/4G: ${currentTunnelUrl}`);
      }
    });

    proc.on('error', (err) => {
      console.warn('Notice: Global tunnel ssh background worker:', err.message);
    });

    proc.on('close', () => {
      activeTunnelProc = null;
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        if (tunnelRetryTimeout) clearTimeout(tunnelRetryTimeout);
        tunnelRetryTimeout = setTimeout(() => {
          if (!activeTunnelProc) {
            startGlobalTunnel(port);
          }
        }, 5000);
      }
    });
  } catch (err: any) {
    console.warn('Notice: Could not spawn global tunnel:', err.message);
  }
}

export function stopGlobalTunnel(): void {
  if (tunnelRetryTimeout) {
    clearTimeout(tunnelRetryTimeout);
    tunnelRetryTimeout = null;
  }
  if (activeTunnelProc && !activeTunnelProc.killed) {
    try {
      activeTunnelProc.kill();
    } catch {}
    activeTunnelProc = null;
  }
}

process.on('exit', stopGlobalTunnel);
process.on('SIGINT', () => { stopGlobalTunnel(); process.exit(0); });
process.on('SIGTERM', () => { stopGlobalTunnel(); process.exit(0); });

/**
 * Discovers the local LAN IPv4 address (e.g. 192.168.x.x) for seamless mobile QR connections
 */
export function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Finds the built client dist folder across various running environments
 */
function findClientDist(): string | null {
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidates = [
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(process.cwd(), '..', 'client', 'dist'),
    path.resolve(currentDir, '..', '..', 'client', 'dist'),
    path.resolve(currentDir, '..', 'client', 'dist'),
    path.resolve(currentDir, 'client', 'dist')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, 'index.html'))) {
      return c;
    }
  }
  return null;
}

export function createServer(port: number = PORT) {
  const roomManager = new RoomManager();
  const clientDistPath = findClientDist();

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const cleanUrl = (req.url || '/').split('?')[0];

    // Health & Service Discovery API
    if (cleanUrl === '/health' || cleanUrl === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'BeamDrop Signaling & Relay Server',
          uptime: process.uptime(),
          activeRooms: roomManager.getRoomCount(),
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    // Network IP API for 1-click clean mobile QR code rendering
    if (cleanUrl === '/api/network-info') {
      const cfg = loadStaticConfig();
      const effectiveUrl = cfg.staticUrl || getTunnelUrl();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          localIp: getLocalIp(),
          port,
          tunnelUrl: effectiveUrl,
          tunnelReady: !!effectiveUrl,
          isStaticConfigured: !!cfg.staticUrl,
          staticUrl: cfg.staticUrl || ''
        })
      );
      return;
    }

    // Save custom permanent static URL endpoint
    if (cleanUrl === '/api/set-static-url' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const staticUrl = typeof parsed.staticUrl === 'string' ? parsed.staticUrl.trim() : '';
          saveStaticConfig({ staticUrl });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, staticUrl }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    // Serve static client assets in production with Gzip & Immutable Caching
    if (clientDistPath && req.method === 'GET') {
      let filePath = path.join(clientDistPath, cleanUrl === '/' ? 'index.html' : cleanUrl);

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(clientDistPath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
          '.woff': 'font/woff',
          '.ttf': 'font/ttf'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const acceptEncoding = (req.headers['accept-encoding'] || '') as string;
        const canGzip = /\bgzip\b/.test(acceptEncoding) && (ext === '.js' || ext === '.css' || ext === '.html' || ext === '.json' || ext === '.svg');
        const isImmutable = ext === '.js' || ext === '.css' || ext === '.png' || ext === '.woff2' || ext === '.ico';

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache'
        };

        if (canGzip) {
          headers['Content-Encoding'] = 'gzip';
          res.writeHead(200, headers);
          fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
        } else {
          res.writeHead(200, headers);
          fs.createReadStream(filePath).pipe(res);
        }
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('BeamDrop Signaling & Relay Server is operational.');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    const peerId = crypto.randomUUID().slice(0, 8);
    (ws as any).peerId = peerId;

    const send = (msg: WSMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      try {
        // Fast-path raw binary chunk relay: route ArrayBuffer directly without JSON/Base64 overhead
        if (isBinary || (data instanceof Buffer && data[0] !== 0x7b /* '{' */)) {
          const room = roomManager.getPeerRoom(peerId);
          if (room) {
            for (const [id, peer] of room.peers.entries()) {
              if (id !== peerId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(data, { binary: true });
              }
            }
          }
          return;
        }

        const message: WSMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'CREATE_ROOM': {
            const room = roomManager.createRoom();
            roomManager.joinRoom(room.id, peerId, ws);
            send({
              type: 'ROOM_CREATED',
              roomId: room.id,
              peerId
            });
            break;
          }

          case 'JOIN_ROOM': {
            const targetRoomId = message.roomId ? message.roomId.toUpperCase().trim() : '';
            const joinResult = roomManager.joinRoom(targetRoomId, peerId, ws);

            if (!joinResult.success || !joinResult.room) {
              send({
                type: 'JOIN_ERROR',
                error: joinResult.error || 'Не вдалося підключитися до кімнати.'
              });
              return;
            }

            const room = joinResult.room;
            const existingPeers = Array.from(room.peers.keys()).filter((id) => id !== peerId);

            send({
              type: 'ROOM_JOINED',
              roomId: room.id,
              peerId,
              peers: existingPeers
            });

            for (const [id, peer] of room.peers.entries()) {
              if (id !== peerId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(
                  JSON.stringify({
                    type: 'PEER_JOINED',
                    peerId,
                    peerCount: room.peers.size
                  })
                );
              }
            }
            break;
          }

          case 'SIGNAL': {
            const room = roomManager.getPeerRoom(peerId);
            if (!room) return;

            const targetPeer = room.peers.get(message.targetPeerId);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(
                JSON.stringify({
                  type: 'SIGNAL',
                  targetPeerId: message.targetPeerId,
                  fromPeerId: peerId,
                  signal: message.signal
                })
              );
            }
            break;
          }

          case 'RELAY_MESSAGE': {
            const room = roomManager.getPeerRoom(peerId);
            if (!room) return;

            if (message.targetPeerId) {
              const target = room.peers.get(message.targetPeerId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(
                  JSON.stringify({
                    type: 'RELAY_MESSAGE',
                    fromPeerId: peerId,
                    relay: message.relay
                  })
                );
              }
            } else {
              for (const [id, peer] of room.peers.entries()) {
                if (id !== peerId && peer.ws.readyState === WebSocket.OPEN) {
                  peer.ws.send(
                    JSON.stringify({
                      type: 'RELAY_MESSAGE',
                      fromPeerId: peerId,
                      relay: message.relay
                    })
                  );
                }
              }
            }
            break;
          }

          case 'PING': {
            send({ type: 'PONG' });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling message from peer:', peerId, err);
      }
    });

    ws.on('close', () => {
      const { roomId, remainingPeers } = roomManager.removePeer(peerId);
      if (roomId) {
        const room = roomManager.getRoom(roomId);
        if (room) {
          for (const peer of room.peers.values()) {
            if (peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(
                JSON.stringify({
                  type: 'PEER_LEFT',
                  peerId,
                  peerCount: remainingPeers.length
                })
              );
            }
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.warn(`WebSocket error on peer ${peerId}:`, err.message);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return { server, wss, roomManager, clientDistPath };
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const { server } = createServer(PORT);
  server.listen(PORT, HOST, () => {
    const localIp = getLocalIp();
    console.log(`====================================================`);
    console.log(`🚀 BeamDrop запущено і готово до роботи!`);
    console.log(`🌐 На цьому комп'ютері:   http://localhost:${PORT}`);
    console.log(`📱 Для телефону (Wi-Fi): http://${localIp}:${PORT}`);
    console.log(`====================================================`);
    startGlobalTunnel(PORT);
  });
}
