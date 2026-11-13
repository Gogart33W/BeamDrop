import React from 'react';
import {
  FileText,
  Download,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  Video,
  Music
} from 'lucide-react';
import { FileTransfer } from '../types/index.js';
import { formatBytes, formatSpeed, formatEta, truncateFilename } from '../utils/formatters.js';

interface FileTransferListProps {
  transfers: FileTransfer[];
  onCancel: (id: string) => void;
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimeType.startsWith('image/')) {
    return <ImageIcon className="w-5 h-5 text-amber-400" />;
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext) || mimeType.startsWith('video/')) {
    return <Video className="w-5 h-5 text-purple-400" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext) || mimeType.startsWith('audio/')) {
    return <Music className="w-5 h-5 text-pink-400" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-yellow-400" />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'sql', 'cpp', 'rs'].includes(ext)) {
    return <FileCode className="w-5 h-5 text-emerald-400" />;
  }
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
  }
  return <FileText className="w-5 h-5 text-cyan-400" />;
}

export const FileTransferList: React.FC<FileTransferListProps> = ({ transfers, onCancel }) => {
  if (transfers.length === 0) return null;

  return (
    <div className="w-full space-y-3" data-testid="file-transfer-list">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
          Передачі файлів ({transfers.length})
        </h3>
      </div>

      <div className="space-y-3">
        {transfers.map((transfer) => {
          const isOutgoing = transfer.direction === 'outgoing';
          const isTransferring = transfer.status === 'transferring';
          const isCompleted = transfer.status === 'completed';
          const isCancelled = transfer.status === 'cancelled';
          const isError = transfer.status === 'error';

          return (
            <div
              key={transfer.id}
              data-testid={`transfer-item-${transfer.id}`}
              className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-4 shadow-sm backdrop-blur-sm transition-all hover:border-zinc-700/80"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
                {/* File info */}
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50">
                    {getFileIcon(transfer.type, transfer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className="font-medium text-sm text-zinc-100 truncate block"
                        title={transfer.name}
                      >
                        {truncateFilename(transfer.name, 28)}
                      </span>
                      {transfer.isFallback && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40 shrink-0">
                          WS Relay
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-zinc-400 mt-0.5">
                      <span>{formatBytes(transfer.size)}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 shrink-0">
                        {isOutgoing ? (
                          <>
                            <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                            <span>Відправка</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                            <span>Отримання</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right action / status */}
                <div className="flex items-center justify-between sm:justify-end space-x-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-zinc-800/60">
                  {isTransferring && (
                    <button
                      onClick={() => onCancel(transfer.id)}
                      title="Скасувати"
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {isCompleted && (
                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      <span className="flex items-center space-x-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Завершено</span>
                      </span>
                      {transfer.blobUrl && (
                        <a
                          href={transfer.blobUrl}
                          download={transfer.name}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-800/80 text-xs text-emerald-300 font-semibold transition-all shadow-sm active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Завантажити</span>
                        </a>
                      )}
                    </div>
                  )}

                  {isCancelled && (
                    <span className="text-xs text-zinc-500 font-medium flex items-center space-x-1">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Скасовано</span>
                    </span>
                  )}

                  {isError && (
                    <span className="text-xs text-red-400 font-medium flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{transfer.errorMessage || 'Помилка'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800/80 relative">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : isCancelled
                      ? 'bg-zinc-600'
                      : isError
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                  }`}
                  style={{ width: `${transfer.progress}%` }}
                />
              </div>

              {/* Transfer Metrics Footer (Speed & ETA) */}
              {isTransferring && (
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-cyan-400 font-semibold">{transfer.progress.toFixed(0)}%</span>
                    <span>•</span>
                    <span>
                      {formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.size)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-300 font-medium">{formatSpeed(transfer.speed)}</span>
                    <span>•</span>
                    <span>Залишилось: {formatEta(transfer.eta)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
