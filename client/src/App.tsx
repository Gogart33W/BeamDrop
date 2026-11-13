import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { DropZone } from './components/DropZone.js';
import { FileTransferList } from './components/FileTransferList.js';
import { LiveClipboard } from './components/LiveClipboard.js';
import { ConnectionStatus } from './components/ConnectionStatus.js';
import { QRCodeModal } from './components/QRCodeModal.js';
import { JoinRoomModal } from './components/JoinRoomModal.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import {
  Smartphone,
  Sparkles,
  AlertCircle,
  QrCode,
  FolderUp,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export function App() {
  const {
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
  } = useWebRTC();

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [showGrandmaGuide, setShowGrandmaGuide] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('Щоб встановити BeamDrop як додаток:\n1. Натисніть кнопку меню (три крапки або «Поділитися»)\n2. Оберіть «Додати на головний екран» або «Встановити додаток»');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black antialiased relative selection:bg-cyan-500/30">
      {/* Ambient background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-600/10 via-blue-600/5 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-blue-600/5 blur-3xl rounded-full" />
      </div>

      {/* Main Header */}
      <Header
        roomId={roomId}
        peerId={peerId}
        status={status}
        mode={transmissionMode}
        peers={peers}
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenJoin={() => setIsJoinModalOpen(true)}
        publicUrl={publicUrl}
        lanIp={lanIp}
      />

      {/* Error alert banner if any */}
      {errorMessage && (
        <div className="relative z-10 max-w-4xl mx-auto px-4 mt-4 w-full">
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center space-x-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={createNewRoom}
              className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-xs text-white font-medium transition-colors"
            >
              Створити нову кімнату
            </button>
          </div>
        </div>
      )}

      {/* Main container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Simple 3-Step Guide (Super intuitive for grandmas & beginners) */}
        <section className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800/90 rounded-3xl p-5 sm:p-7 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Як передати файл або фото? (3 простих кроки)
              </h2>
            </div>
            <button
              onClick={() => setShowGrandmaGuide(!showGrandmaGuide)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center space-x-1"
            >
              <span>{showGrandmaGuide ? 'Сховати' : 'Показати інструкцію'}</span>
              {showGrandmaGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showGrandmaGuide && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 animate-fade-in">
              {/* Step 1 */}
              <div
                onClick={() => setIsQRModalOpen(true)}
                className="bg-zinc-950/70 border border-cyan-900/40 hover:border-cyan-500/50 rounded-2xl p-4 cursor-pointer transition-all hover:bg-cyan-950/10 group"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-cyan-500 text-black font-extrabold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold text-sm">
                    <QrCode className="w-4 h-4" />
                    <span>Скануйте QR-код</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Натисніть сюди або відкрийте камеру на телефоні й наведіть на екран. Телефон відкриє сайт сам!
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-500 text-black font-extrabold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div className="flex items-center space-x-1.5 text-blue-300 font-semibold text-sm">
                    <FolderUp className="w-4 h-4" />
                    <span>Виберіть фото чи файл</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Перетягніть мишкою будь-яке фото чи відео у велике поле або просто натисніть «Обрати файли».
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-black font-extrabold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div className="flex items-center space-x-1.5 text-emerald-300 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Миттєво збережено!</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Файл за лічені секунди передасться напряму без проводів, пошти, флешок та реєстрацій.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Quick Connection Hero Bar */}
        <section className="bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-900/90 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Миттєве з’єднання пристроїв</h2>
                <span className="flex items-center space-x-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  <span>Без реєстрації</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Відкрийте цей сайт на телефоні або ноутбуці та введіть код або відскануйте QR-код
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Ваш код</span>
              <span className="font-mono text-xl font-bold tracking-widest text-cyan-300">
                {roomId || '....'}
              </span>
            </div>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-800/60 text-xs font-bold transition-all active:scale-95"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Встановити додаток</span>
              </button>
            )}

            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Показати QR</span>
            </button>
          </div>
        </section>

        {/* File Drag & Drop Zone */}
        <section>
          <DropZone
            onFilesSelected={sendFiles}
            hasPeers={peers.length > 0}
            onOpenQR={() => setIsQRModalOpen(true)}
          />
        </section>

        {/* Active & Completed File Transfers */}
        <section>
          <FileTransferList transfers={transfers} onCancel={cancelTransfer} />
        </section>

        {/* Live Clipboard & Code Sharing */}
        <section>
          <LiveClipboard
            sharedTexts={sharedTexts}
            onSendText={sendSharedText}
            hasPeers={peers.length > 0}
          />
        </section>

        {/* Technical connection & fallback specs */}
        <section>
          <ConnectionStatus
            status={status}
            mode={transmissionMode}
            peers={peers}
            roomId={roomId}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/80 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BeamDrop • P2P WebRTC & WebSocket Chunk Streaming</span>
          <span>Zero Server Storage • Unlimited File Size</span>
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomId={roomId}
        lanIp={lanIp}
        publicUrl={publicUrl}
      />

      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={joinRoom}
        currentRoomId={roomId}
      />
    </div>
  );
}

export default App;
