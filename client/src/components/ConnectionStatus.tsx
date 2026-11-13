import React from 'react';
import { Shield, Zap, Radio, Cpu, Network } from 'lucide-react';
import { ConnectionStatus as ConnStatusType, TransmissionMode, PeerInfo } from '../types/index.js';

interface ConnectionStatusProps {
  status: ConnStatusType;
  mode: TransmissionMode;
  peers: PeerInfo[];
  roomId: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  mode,
  peers,
  roomId
}) => {
  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 backdrop-blur-sm">
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono mb-4 flex items-center space-x-2">
        <Network className="w-4 h-4 text-cyan-400" />
        <span>Мережевий протокол та безпека</span>
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Transmission Mode */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center space-x-2 mb-1.5">
            <Radio
              className={`w-4 h-4 ${
                mode === 'direct-p2p' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span className="text-xs font-medium text-zinc-300">Канал передачі</span>
          </div>
          <div className="font-mono text-sm font-bold text-white flex items-center space-x-2">
            <span>
              {peers.length === 0
                ? 'Очікування піра'
                : mode === 'direct-p2p'
                ? 'WebRTC DataChannel'
                : 'WebSocket Relay'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {mode === 'direct-p2p'
              ? 'Прямий тунель без проміжних серверів'
              : 'Автоматичний обхід суворих NAT/фаєрволів'}
          </p>
        </div>

        {/* Security / Privacy */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center space-x-2 mb-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-zinc-300">Конфіденційність</span>
          </div>
          <div className="font-mono text-sm font-bold text-white">
            Zero-Knowledge P2P
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Файли не потрапляють на диск сервера і не зберігаються
          </p>
        </div>

        {/* Chunks & Performance */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center space-x-2 mb-1.5">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-zinc-300">Потокова обробка</span>
          </div>
          <div className="font-mono text-sm font-bold text-white">
            64 KB Chunks + Backpressure
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Постійні ~2 MB RAM навіть при 5+ ГБ файлах
          </p>
        </div>
      </div>
    </div>
  );
};
