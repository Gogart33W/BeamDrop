export type MessageType =
  | 'CREATE_ROOM'
  | 'ROOM_CREATED'
  | 'JOIN_ROOM'
  | 'ROOM_JOINED'
  | 'JOIN_ERROR'
  | 'PEER_JOINED'
  | 'PEER_LEFT'
  | 'SIGNAL'
  | 'RELAY_MESSAGE'
  | 'PING'
  | 'PONG';

export interface BaseMessage {
  type: MessageType;
}

export interface CreateRoomMessage extends BaseMessage {
  type: 'CREATE_ROOM';
}

export interface RoomCreatedMessage extends BaseMessage {
  type: 'ROOM_CREATED';
  roomId: string;
  peerId: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: 'JOIN_ROOM';
  roomId: string;
}

export interface RoomJoinedMessage extends BaseMessage {
  type: 'ROOM_JOINED';
  roomId: string;
  peerId: string;
  peers: string[];
}

export interface JoinErrorMessage extends BaseMessage {
  type: 'JOIN_ERROR';
  error: string;
}

export interface PeerJoinedMessage extends BaseMessage {
  type: 'PEER_JOINED';
  peerId: string;
  peerCount: number;
}

export interface PeerLeftMessage extends BaseMessage {
  type: 'PEER_LEFT';
  peerId: string;
  peerCount: number;
}

export interface SignalMessage extends BaseMessage {
  type: 'SIGNAL';
  targetPeerId: string;
  fromPeerId?: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit | any;
}

export interface RelayPayload {
  kind: 'file-meta' | 'file-chunk' | 'file-complete' | 'file-cancel' | 'text-share';
  transferId?: string;
  payload: any;
}

export interface RelayMessage extends BaseMessage {
  type: 'RELAY_MESSAGE';
  targetPeerId?: string;
  fromPeerId?: string;
  relay: RelayPayload;
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
}

export interface PongMessage extends BaseMessage {
  type: 'PONG';
}

export type WSMessage =
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | RoomJoinedMessage
  | JoinErrorMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | SignalMessage
  | RelayMessage
  | PingMessage
  | PongMessage;
