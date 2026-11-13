export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type TransmissionMode = 'direct-p2p' | 'fallback-relay';

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number; // 0 - 100
  transferredBytes: number;
  speed: number; // bytes/sec
  eta: number; // remaining seconds
  direction: 'outgoing' | 'incoming';
  status: 'pending' | 'transferring' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
  blobUrl?: string;
  isFallback?: boolean;
  startedAt: number;
  completedAt?: number;
}

export interface SharedText {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: number;
  type: 'text' | 'code' | 'url';
  language?: string;
}

export interface PeerInfo {
  id: string;
  name: string;
  isWebRTCConnected: boolean;
  transmissionMode: TransmissionMode;
  latencyMs?: number;
}
