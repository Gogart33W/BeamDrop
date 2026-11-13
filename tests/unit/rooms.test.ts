import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../server/src/rooms.js';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('generates a 4-character room code using safe characters', () => {
    const roomId = manager.generateRoomId();
    expect(roomId).toHaveLength(4);
    // Disallowed chars: 0, O, 1, I
    expect(roomId).not.toMatch(/[0O1I]/);
    expect(roomId).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  it('generates unique room IDs on consecutive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(manager.generateRoomId());
    }
    expect(ids.size).toBe(50);
  });

  it('creates and tracks active rooms', () => {
    expect(manager.getRoomCount()).toBe(0);
    const room = manager.createRoom();
    expect(room.id).toHaveLength(4);
    expect(manager.getRoomCount()).toBe(1);
    expect(manager.getRoom(room.id)).toBeDefined();
  });

  it('allows peers to join a room', () => {
    const room = manager.createRoom();
    const fakeWs1 = {} as any;
    const fakeWs2 = {} as any;

    const res1 = manager.joinRoom(room.id, 'peer-1', fakeWs1);
    expect(res1.success).toBe(true);

    const res2 = manager.joinRoom(room.id, 'peer-2', fakeWs2);
    expect(res2.success).toBe(true);

    const peerRoom = manager.getPeerRoom('peer-1');
    expect(peerRoom?.id).toBe(room.id);
    expect(peerRoom?.peers.size).toBe(2);
  });

  it('rejects joining a non-existent room', () => {
    const fakeWs = {} as any;
    const res = manager.joinRoom('ZZZZ', 'peer-1', fakeWs);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('removes empty rooms when all peers disconnect', () => {
    const room = manager.createRoom();
    const fakeWs = {} as any;
    manager.joinRoom(room.id, 'peer-1', fakeWs);
    expect(manager.getRoomCount()).toBe(1);

    const { remainingPeers } = manager.removePeer('peer-1');
    expect(remainingPeers.length).toBe(0);
    expect(manager.getRoomCount()).toBe(0);
  });
});
