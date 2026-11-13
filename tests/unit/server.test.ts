import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../server/src/index.js';
import type { Server } from 'http';

describe('Signaling Server', () => {
  let server: Server;
  const TEST_PORT = 4999;
  const WS_URL = `ws://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    const app = createServer(TEST_PORT);
    server = app.server;
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('responds to HTTP health check', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toContain('BeamDrop');
  });

  it('creates room and connects two peers', async () => {
    const client1 = new WebSocket(WS_URL);
    let roomId = '';
    let peerId1 = '';
    let peerId2 = '';

    await new Promise<void>((resolve) => {
      client1.on('open', () => {
        client1.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      });

      client1.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ROOM_CREATED') {
          roomId = msg.roomId;
          peerId1 = msg.peerId;
          expect(roomId).toHaveLength(4);
          expect(peerId1).toBeDefined();
          resolve();
        }
      });
    });

    // Client 2 joins the room
    const client2 = new WebSocket(WS_URL);
    await new Promise<void>((resolve) => {
      client2.on('open', () => {
        client2.send(JSON.stringify({ type: 'JOIN_ROOM', roomId }));
      });

      client2.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ROOM_JOINED') {
          peerId2 = msg.peerId;
          expect(msg.roomId).toBe(roomId);
          expect(msg.peers).toContain(peerId1);
          resolve();
        }
      });
    });

    // Client 1 sends a fallback RELAY message to Client 2
    await new Promise<void>((resolve) => {
      client2.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'RELAY_MESSAGE') {
          expect(msg.fromPeerId).toBe(peerId1);
          expect(msg.relay.payload).toBe('Relayed Payload test');
          resolve();
        }
      });

      client1.send(
        JSON.stringify({
          type: 'RELAY_MESSAGE',
          targetPeerId: peerId2,
          relay: {
            kind: 'text-share',
            payload: 'Relayed Payload test'
          }
        })
      );
    });

    client1.close();
    client2.close();
  });
});
