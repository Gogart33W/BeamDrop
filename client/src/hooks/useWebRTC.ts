import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  FileTransfer,
  SharedText,
  ConnectionStatus,
  TransmissionMode,
  PeerInfo
} from '../types/index.js';
import {
  streamFileChunks,
  CHUNK_SIZE,
  BUFFER_THRESHOLD,
  FileMetaMessage,
  FileCompleteMessage,
  FileCancelMessage
} from '../utils/chunker.js';
import { FileAssembler } from '../utils/fileAssembler.js';
import { detectContentType } from '../utils/codeDetector.js';
import {
  formatBytes,
  safeRandomUUID,
  safeCopyToClipboard
} from '../utils/formatters.js';
import { soundFX } from '../components/SoundEffects.js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // OpenRelay High-Speed Public TURN servers for 4G/LTE mobile to home Wi-Fi traversal
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export function useWebRTC() {
  const [roomId, setRoomId] = useState<string>('');
  const [peerId, setPeerId] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [transmissionMode, setTransmissionMode] = useState<TransmissionMode>('direct-p2p');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [sharedTexts, setSharedTexts] = useState<SharedText[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discover local LAN IP & global public URL from server
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const fetchInfo = () => {
      fetch('/api/network-info')
        .then((res) => res.json())
        .then((data) => {
          if (data?.localIp) {
            setLanIp(data.localIp);
          }
          const tunnel = data?.tunnelUrl || data?.publicUrl;
          if (tunnel) {
            setPublicUrl(tunnel);
            if (interval) clearInterval(interval);
          }
        })
        .catch(() => {});
    };

    fetchInfo();
    interval = setInterval(fetchInfo, 2000);
    const timeout = setTimeout(() => {
      if (interval) clearInterval(interval);
    }, 25000);

    return () => {
      if (interval) clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const fileAssemblerRef = useRef<FileAssembler>(new FileAssembler());
  const activeAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const bufferDrainResolvers = useRef<(() => void)[]>([]);
  const webrtcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Get WebSocket URL dynamically
  const getWsUrl = useCallback(() => {
    if (typeof window === 'undefined') return 'ws://localhost:4000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    let port = window.location.port;
    if (!port && protocol === 'ws:' && (host === 'localhost' || host === '127.0.0.1')) {
      port = '4000';
    }
    const portStr = port ? `:${port}` : '';
    return `${protocol}//${host}${portStr}`;
  }, []);

  // Send raw message to WebSocket signaling server
  const sendWs = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Cleanup WebRTC connection
  const cleanupWebRTC = useCallback(() => {
    if (webrtcTimeoutRef.current) {
      clearTimeout(webrtcTimeoutRef.current);
      webrtcTimeoutRef.current = null;
    }
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {}
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
  }, []);

  // Send data over DataChannel or fast raw binary WebSocket relay
  const sendDataPacket = useCallback((buffer: ArrayBuffer) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(buffer);
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Direct raw binary transmission without Base64 overhead
      wsRef.current.send(buffer);
    }
  }, []);

  // Send control signal (file-meta, file-complete, file-cancel, text-share)
  const sendControlMessage = useCallback((msg: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(msg));
    } else {
      // Fallback relay via WebSocket
      sendWs({
        type: 'RELAY_MESSAGE',
        relay: {
          kind: msg.type === 'text-share' ? 'text-share' : 'file-meta',
          payload: msg
        }
      });
    }
  }, [sendWs]);

  // Handle incoming control messages
  const handleControlMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'file-meta': {
        const meta = msg as FileMetaMessage;
        fileAssemblerRef.current.registerTransfer(meta);

        setTransfers((prev) => [
          {
            id: meta.transferId,
            name: meta.name,
            size: meta.size,
            type: meta.mimeType,
            progress: 0,
            transferredBytes: 0,
            speed: 0,
            eta: 0,
            direction: 'incoming',
            status: 'transferring',
            isFallback: dataChannelRef.current?.readyState !== 'open',
            startedAt: Date.now()
          },
          ...prev.filter((t) => t.id !== meta.transferId)
        ]);
        break;
      }

      case 'file-complete': {
        const result = fileAssemblerRef.current.finalizeTransfer(msg.transferId);
        if (result) {
          const downloadUrl = FileAssembler.triggerDownload(result.blob, result.meta.name);
          soundFX.playFileReceived();

          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.8 }
            });
          } catch {}

          setTransfers((prev) =>
            prev.map((t) =>
              t.id === msg.transferId
                ? {
                    ...t,
                    progress: 100,
                    transferredBytes: t.size,
                    status: 'completed',
                    blobUrl: downloadUrl,
                    completedAt: Date.now()
                  }
                : t
            )
          );
        }
        break;
      }

      case 'file-cancel': {
        fileAssemblerRef.current.cancelTransfer(msg.transferId);
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === msg.transferId
              ? {
                  ...t,
                  status: 'cancelled',
                  errorMessage: msg.reason || 'Передачу скасовано'
                }
              : t
          )
        );
        break;
      }

      case 'text-share': {
        soundFX.playMessage();
        setSharedTexts((prev) => [msg.text, ...prev]);
        break;
      }

      default:
        break;
    }
  }, []);

  // Handle raw incoming chunk packet
  const handleIncomingChunk = useCallback((buffer: ArrayBuffer) => {
    fileAssemblerRef.current.processChunk(
      buffer,
      (transferId, receivedBytes, speed, eta, progress) => {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  transferredBytes: receivedBytes,
                  speed,
                  eta,
                  progress
                }
              : t
          )
        );
      }
    );
  }, []);

  // Setup RTCDataChannel event handlers
  const setupDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.binaryType = 'arraybuffer';
      channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;

      channel.onopen = () => {
        setTransmissionMode('direct-p2p');
        setStatus('connected');
        soundFX.playConnect();
        setPeers((prev) =>
          prev.map((p) => ({ ...p, isWebRTCConnected: true, transmissionMode: 'direct-p2p' }))
        );
        if (webrtcTimeoutRef.current) {
          clearTimeout(webrtcTimeoutRef.current);
          webrtcTimeoutRef.current = null;
        }
      };

      channel.onbufferedamountlow = () => {
        while (bufferDrainResolvers.current.length > 0) {
          const resolve = bufferDrainResolvers.current.shift();
          if (resolve) resolve();
        }
      };

      channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            handleControlMessage(parsed);
          } catch (err) {
            console.error('Failed to parse text message from DataChannel:', err);
          }
        } else if (event.data instanceof ArrayBuffer) {
          handleIncomingChunk(event.data);
        }
      };

      channel.onclose = () => {
        setTransmissionMode('fallback-relay');
      };

      channel.onerror = (err) => {
        console.warn('DataChannel notice, falling back to relay:', err);
        setTransmissionMode('fallback-relay');
      };
    },
    [handleControlMessage, handleIncomingChunk]
  );

  // Initialize WebRTC peer connection
  const initiatePeerConnection = useCallback(
    (targetPeerId: string, isInitiator: boolean) => {
      cleanupWebRTC();

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'SIGNAL',
            targetPeerId,
            signal: { candidate: event.candidate }
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setTransmissionMode('direct-p2p');
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setTransmissionMode('fallback-relay');
        }
      };

      if (isInitiator) {
        const dc = pc.createDataChannel('beamdrop-data', { ordered: true });
        setupDataChannel(dc);

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendWs({
              type: 'SIGNAL',
              targetPeerId,
              signal: { description: pc.localDescription }
            });
          })
          .catch((err) => {
            console.warn('Offer creation handled, using fallback relay:', err);
            setTransmissionMode('fallback-relay');
          });
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };
      }

      webrtcTimeoutRef.current = setTimeout(() => {
        if (dataChannelRef.current?.readyState !== 'open') {
          setTransmissionMode('fallback-relay');
          setStatus('connected');
        }
      }, 4000);
    },
    [cleanupWebRTC, sendWs, setupDataChannel]
  );

  // Connect to Signaling Server via WebSocket
  useEffect(() => {
    isMountedRef.current = true;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!isMountedRef.current) return;

      try {
        ws = new WebSocket(getWsUrl());
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          setStatus('connected');
          setErrorMessage(null);

          const urlParams = new URLSearchParams(window.location.search);
          const queryRoom = urlParams.get('room') || window.location.hash.replace('#', '');

          if (queryRoom) {
            ws?.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: queryRoom.toUpperCase().trim() }));
          } else {
            ws?.send(JSON.stringify({ type: 'CREATE_ROOM' }));
          }
        };

        ws.onmessage = async (event) => {
          if (!isMountedRef.current) return;
          if (event.data instanceof ArrayBuffer) {
            handleIncomingChunk(event.data);
            return;
          }
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'ROOM_CREATED': {
                setRoomId(msg.roomId);
                setPeerId(msg.peerId);
                window.history.replaceState({}, '', `?room=${msg.roomId}`);
                break;
              }

              case 'ROOM_JOINED': {
                setRoomId(msg.roomId);
                setPeerId(msg.peerId);
                window.history.replaceState({}, '', `?room=${msg.roomId}`);

                const existingPeers: PeerInfo[] = (msg.peers || []).map((id: string) => ({
                  id,
                  name: `Пристрій ${id.slice(0, 4)}`,
                  isWebRTCConnected: false,
                  transmissionMode: 'direct-p2p'
                }));
                setPeers(existingPeers);

                if (existingPeers.length > 0) {
                  initiatePeerConnection(existingPeers[0].id, true);
                }
                break;
              }

              case 'JOIN_ERROR': {
                setErrorMessage(msg.error || 'Помилка підключення до кімнати');
                break;
              }

              case 'PEER_JOINED': {
                const newPeer: PeerInfo = {
                  id: msg.peerId,
                  name: `Пристрій ${msg.peerId.slice(0, 4)}`,
                  isWebRTCConnected: false,
                  transmissionMode: 'direct-p2p'
                };
                setPeers((prev) => [...prev.filter((p) => p.id !== msg.peerId), newPeer]);
                break;
              }

              case 'PEER_LEFT': {
                setPeers((prev) => prev.filter((p) => p.id !== msg.peerId));
                cleanupWebRTC();
                break;
              }

              case 'SIGNAL': {
                const { signal, fromPeerId } = msg;
                let pc = pcRef.current;

                if (!pc) {
                  initiatePeerConnection(fromPeerId, false);
                  pc = pcRef.current;
                }

                if (pc && signal.description) {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
                  if (signal.description.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendWs({
                      type: 'SIGNAL',
                      targetPeerId: fromPeerId,
                      signal: { description: pc.localDescription }
                    });
                  }
                } else if (pc && signal.candidate) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                  } catch (candidateErr) {
                    console.warn('ICE candidate notice:', candidateErr);
                  }
                }
                break;
              }

              case 'RELAY_MESSAGE': {
                const relay = msg.relay;
                if (relay.kind === 'file-chunk') {
                  const binaryString = atob(relay.payload);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  handleIncomingChunk(bytes.buffer);
                } else {
                  handleControlMessage(relay.payload);
                }
                break;
              }

              default:
                break;
            }
          } catch (parseErr) {
            console.error('Error handling WebSocket message:', parseErr);
          }
        };

        ws.onerror = (err) => {
          if (!isMountedRef.current) return;
          console.warn('WebSocket connection note:', err);
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;
          setStatus('disconnected');
          // Auto-reconnect after 2 seconds
          reconnectTimeout = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, 2000);
        };
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setStatus('error');
        setErrorMessage(err?.message || 'Помилка ініціалізації з’єднання');
      }
    }

    connect();

    return () => {
      isMountedRef.current = false;
      cleanupWebRTC();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      }
    };
  }, [cleanupWebRTC, getWsUrl, handleControlMessage, handleIncomingChunk, initiatePeerConnection, sendWs]);

  // Join a custom room code
  const joinRoom = useCallback(
    (code: string) => {
      const cleanCode = code.toUpperCase().trim();
      if (!cleanCode) return;
      cleanupWebRTC();
      sendWs({ type: 'JOIN_ROOM', roomId: cleanCode });
    },
    [cleanupWebRTC, sendWs]
  );

  // Create a new room code
  const createNewRoom = useCallback(() => {
    cleanupWebRTC();
    sendWs({ type: 'CREATE_ROOM' });
  }, [cleanupWebRTC, sendWs]);

  // Send files (multiple files queue supported)
  const sendFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      for (const file of files) {
        const transferId = safeRandomUUID();
        const abortController = new AbortController();
        activeAbortControllers.current.set(transferId, abortController);

        const newTransfer: FileTransfer = {
          id: transferId,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          progress: 0,
          transferredBytes: 0,
          speed: 0,
          eta: 0,
          direction: 'outgoing',
          status: 'transferring',
          isFallback: dataChannelRef.current?.readyState !== 'open',
          startedAt: Date.now()
        };

        setTransfers((prev) => [newTransfer, ...prev]);

        streamFileChunks({
          file,
          transferId,
          abortSignal: abortController.signal,
          sendSignal: (msg) => sendControlMessage(msg),
          sendData: (buffer) => sendDataPacket(buffer),
          getBufferedAmount: () => {
            if (dataChannelRef.current?.readyState === 'open') {
              return dataChannelRef.current.bufferedAmount;
            }
            return wsRef.current?.bufferedAmount || 0;
          },
          waitForBufferDrain: () =>
            new Promise<void>((resolve) => {
              if (dataChannelRef.current?.readyState === 'open') {
                bufferDrainResolvers.current.push(resolve);
              } else {
                const checkDrain = () => {
                  if (!wsRef.current || wsRef.current.bufferedAmount < 512 * 1024) {
                    resolve();
                  } else {
                    setTimeout(checkDrain, 25);
                  }
                };
                setTimeout(checkDrain, 25);
              }
            }),
          onProgress: (transferredBytes, speed, eta) => {
            const progress = file.size > 0 ? Math.min(100, (transferredBytes / file.size) * 100) : 100;
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      transferredBytes,
                      speed,
                      eta,
                      progress
                    }
                  : t
              )
            );
          },
          onComplete: () => {
            activeAbortControllers.current.delete(transferId);
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      progress: 100,
                      transferredBytes: file.size,
                      status: 'completed',
                      completedAt: Date.now()
                    }
                  : t
              )
            );
          },
          onError: (err) => {
            activeAbortControllers.current.delete(transferId);
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      status: 'error',
                      errorMessage: err.message || 'Помилка передачі'
                    }
                  : t
              )
            );
          }
        });
      }
    },
    [sendControlMessage, sendDataPacket]
  );

  // Cancel an active transfer
  const cancelTransfer = useCallback(
    (transferId: string) => {
      const controller = activeAbortControllers.current.get(transferId);
      if (controller) {
        controller.abort();
        activeAbortControllers.current.delete(transferId);
      }
      sendControlMessage({ type: 'file-cancel', transferId, reason: 'Скасовано' });
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'cancelled' } : t))
      );
    },
    [sendControlMessage]
  );

  // Send live text / code snippet
  const sendSharedText = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      const detected = detectContentType(content);
      const shared: SharedText = {
        id: safeRandomUUID(),
        content,
        senderId: peerId,
        senderName: 'Ви',
        timestamp: Date.now(),
        type: detected.type,
        language: detected.language
      };

      setSharedTexts((prev) => [shared, ...prev]);

      sendControlMessage({
        type: 'text-share',
        text: {
          ...shared,
          senderName: `Пристрій ${peerId.slice(0, 4)}`
        }
      });
    },
    [peerId, sendControlMessage]
  );

  return {
    roomId,
    peerId,
    lanIp,
    publicUrl,
    status,
    transmissionMode,
    peers,
    transfers,
    sharedTexts,
    errorMessage,
    joinRoom,
    createNewRoom,
    sendFiles,
    cancelTransfer,
    sendSharedText
  };
}
