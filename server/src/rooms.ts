import type { WebSocket } from 'ws';

// Unambiguous characters (excluding 0, O, 1, I to avoid human transcription errors)
const ROOM_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface RoomPeer {
  id: string;
  ws: WebSocket;
  joinedAt: number;
}

export interface Room {
  id: string;
  createdAt: number;
  peers: Map<string, RoomPeer>;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private peerToRoom: Map<string, string> = new Map();

  /**
   * Generates a unique 4-character room code.
   */
  public generateRoomId(): string {
    let id = '';
    let attempts = 0;
    do {
      id = '';
      for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * ROOM_CHARSET.length);
        id += ROOM_CHARSET[randomIndex];
      }
      attempts++;
      if (attempts > 1000) {
        // Fallback to 5 chars if dense
        id += ROOM_CHARSET[Math.floor(Math.random() * ROOM_CHARSET.length)];
      }
    } while (this.rooms.has(id));

    return id;
  }

  /**
   * Creates a room with an optional requested ID or generated 4-char ID.
   */
  public createRoom(requestedId?: string): Room {
    const roomId = requestedId ? requestedId.toUpperCase().trim() : this.generateRoomId();
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const room: Room = {
      id: roomId,
      createdAt: Date.now(),
      peers: new Map()
    };
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Adds a peer to a room.
   */
  public joinRoom(roomId: string, peerId: string, ws: WebSocket): { success: boolean; error?: string; room?: Room } {
    const cleanRoomId = roomId.toUpperCase().trim();
    const room = this.rooms.get(cleanRoomId);

    if (!room) {
      return { success: false, error: `Кімнату з кодом ${cleanRoomId} не знайдено.` };
    }

    // Support up to 8 peers in a room for multi-device beam
    if (room.peers.size >= 8) {
      return { success: false, error: `Кімната ${cleanRoomId} переповнена (макс 8 пристроїв).` };
    }

    // Remove from any prior room
    this.removePeer(peerId);

    room.peers.set(peerId, {
      id: peerId,
      ws,
      joinedAt: Date.now()
    });
    this.peerToRoom.set(peerId, cleanRoomId);

    return { success: true, room };
  }

  /**
   * Gets a room by ID.
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase().trim());
  }

  /**
   * Gets the roomId for a peer.
   */
  public getPeerRoom(peerId: string): Room | undefined {
    const roomId = this.peerToRoom.get(peerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /**
   * Removes a peer from their current room.
   * If the room becomes empty, it is deleted after a short grace period.
   */
  public removePeer(peerId: string): { roomId?: string; remainingPeers: string[] } {
    const roomId = this.peerToRoom.get(peerId);
    if (!roomId) {
      return { remainingPeers: [] };
    }

    this.peerToRoom.delete(peerId);
    const room = this.rooms.get(roomId);
    if (!room) {
      return { roomId, remainingPeers: [] };
    }

    room.peers.delete(peerId);
    const remainingPeers = Array.from(room.peers.keys());

    if (room.peers.size === 0) {
      // Free room immediately if empty
      this.rooms.delete(roomId);
    }

    return { roomId, remainingPeers };
  }

  /**
   * Total active rooms
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }
}
