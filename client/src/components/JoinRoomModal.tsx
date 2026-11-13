import React, { useState } from 'react';
import { X, LogIn, ArrowRight } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
  currentRoomId?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  currentRoomId
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let clean = code.trim().toUpperCase();

    // If user pasted a full URL (e.g. https://.../?room=M8J4)
    if (clean.includes('ROOM=')) {
      const match = clean.match(/ROOM=([A-Z0-9]+)/i);
      if (match && match[1]) {
        clean = match[1].toUpperCase();
      }
    } else if (clean.includes('/#')) {
      const parts = clean.split('#');
      if (parts[1]) clean = parts[1].toUpperCase();
    }

    if (!clean || clean.length < 3) {
      setError('Введіть 4-значний код кімнати (наприклад: 7X9K)');
      return;
    }
    if (clean === currentRoomId) {
      setError('Ви вже перебуваєте в цій кімнаті');
      return;
    }
    onJoin(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 mb-2 text-blue-400 font-medium text-sm">
          <LogIn className="w-4 h-4" />
          <span>Підключення до сесії</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-1">Введіть код кімнати</h3>
        <p className="text-xs text-zinc-400 mb-6">
          Введіть 4-значний код або вставте посилання з іншого пристрою
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              data-testid="join-room-input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="7X9K"
              className="w-full text-center font-mono text-2xl sm:text-3xl font-bold tracking-widest uppercase bg-zinc-950 border border-zinc-700/80 rounded-2xl py-3 px-4 text-cyan-300 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all shadow-inner"
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}
          </div>

          <button
            type="submit"
            data-testid="submit-join-room-button"
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
          >
            <span>Підключитися</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
