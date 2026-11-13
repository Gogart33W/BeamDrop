import React, { useState } from 'react';
import {
  Zap,
  QrCode,
  LogIn,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  Link as LinkIcon
} from 'lucide-react';
import { ConnectionStatus, TransmissionMode, PeerInfo } from '../types/index.js';
import { soundFX } from './SoundEffects.js';
import { safeCopyToClipboard } from '../utils/formatters.js';

interface HeaderProps {
  roomId: string;
  peerId: string;
  status: ConnectionStatus;
  mode: TransmissionMode;
  peers: PeerInfo[];
  onOpenQR: () => void;
  onOpenJoin: () => void;
  publicUrl?: string;
  lanIp?: string;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  status,
  mode,
  peers,
  onOpenQR,
  onOpenJoin,
  publicUrl,
  lanIp
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMuted, setIsMuted] = useState(soundFX.getMuted());

  const handleCopyCode = async () => {
    if (!roomId) return;
    await safeCopyToClipboard(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!roomId) return;
    let base = window.location.origin;
    if (publicUrl) {
      base = publicUrl.replace(/\/$/, '');
    } else if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && lanIp) {
      base = `${window.location.protocol}//${lanIp}:${window.location.port}`;
    }
    const url = `${base}?room=${roomId}`;
    await safeCopyToClipboard(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.setMuted(next);
  };

  return (
    <header className="w-full border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                BeamDrop
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                P2P
              </span>
            </div>
          </div>
        </div>

        {/* Room Code & Quick Connection Badge */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          {roomId ? (
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 pl-2.5 shadow-inner">
              <span className="text-xs text-zinc-400 mr-2 hidden sm:inline">Кімната:</span>
              <span
                data-testid="room-code-display"
                className="font-mono font-bold text-sm tracking-wider text-cyan-300 mr-1.5"
              >
                {roomId}
              </span>

              {/* Copy Code button */}
              <button
                onClick={handleCopyCode}
                title="Скопіювати код кімнати"
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Copy Link button */}
              <button
                onClick={handleCopyLink}
                title="Скопіювати посилання для підключення"
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-colors hidden sm:inline-block"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : null}

          {/* QR Code Action Button */}
          {roomId && (
            <button
              onClick={onOpenQR}
              data-testid="open-qr-button"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">QR-код</span>
            </button>
          )}

          {/* Enter another code Button */}
          <button
            onClick={onOpenJoin}
            data-testid="open-join-button"
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Ввести код</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Subheader status ribbon */}
      <div className="bg-zinc-900/50 border-t border-zinc-800/40 px-4 py-1.5 text-[11px] text-zinc-400 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              {status === 'connected' && peers.length > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status === 'connected'
                    ? peers.length > 0
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
            </span>
            <span data-testid="connection-status-text">
              {status === 'connected'
                ? peers.length > 0
                  ? `З'єднано з пристроєм (${peers.length})`
                  : 'Очікування підключення другого пристрою...'
                : status === 'connecting'
                ? 'Підключення до сигнального сервера...'
                : 'Відключено'}
            </span>
          </div>

          {peers.length > 0 && (
            <div className="flex items-center space-x-1 text-zinc-500 hidden sm:flex">
              <span>•</span>
              <Radio className="w-3 h-3 text-cyan-400" />
              <span className="font-mono text-zinc-300">
                {mode === 'direct-p2p' ? 'WebRTC DataChannel (Прямий P2P)' : 'WebSocket Fallback Relay'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">End-to-End • Без серверного зберігання</span>
        </div>
      </div>
    </header>
  );
};
