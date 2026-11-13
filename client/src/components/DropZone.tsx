import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Plus, Layers, Image as ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  hasPeers: boolean;
  onOpenQR: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected, hasPeers, onOpenQR }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        onFilesSelected(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="drop-zone"
      className={`relative w-full rounded-3xl p-6 sm:p-12 transition-all duration-300 overflow-hidden border-2 select-none ${
        isDragOver
          ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_50px_rgba(34,211,238,0.25)] scale-[1.01]'
          : 'border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700/80'
      }`}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Real Native File Input (Directly bound to labels) */}
      <input
        type="file"
        id="native-beamdrop-file-input"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
        data-testid="file-input"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Clickable Icon Label for Desktop & Mobile */}
        <label
          htmlFor="native-beamdrop-file-input"
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 sm:mb-6 transition-all duration-300 cursor-pointer ${
            isDragOver
              ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50 scale-110'
              : 'bg-zinc-800/80 text-cyan-400 border border-zinc-700/60 shadow-inner hover:scale-105 active:scale-95'
          }`}
        >
          {isDragOver ? (
            <Layers className="w-10 h-10 animate-bounce" />
          ) : (
            <UploadCloud className="w-10 h-10" />
          )}
        </label>

        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
          {isDragOver ? 'Відпустіть файли для відправки' : 'Натисніть або перетягніть файли'}
        </h2>

        <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
          Миттєва передача напряму між пристроями через WebRTC.
          <br />
          <span className="text-zinc-500">
            Без лімітів на розмір (підтримка 5+ ГБ) • Будь-які фото, відео та документи
          </span>
        </p>

        {/* Buttons Row with Native Labels */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
          {/* Big Primary Button for File Selection (Works natively on Android & iOS!) */}
          <label
            htmlFor="native-beamdrop-file-input"
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm sm:text-base shadow-lg shadow-cyan-500/25 cursor-pointer transition-all active:scale-95 text-center"
          >
            <Plus className="w-5 h-5" />
            <span>Обрати фото або файл</span>
          </label>

          {!hasPeers && (
            <button
              type="button"
              onClick={onOpenQR}
              className="flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs sm:text-sm font-semibold border border-cyan-800/40 transition-colors"
            >
              <span>Показати QR для телефону</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
