import React, { useState } from 'react';
import {
  Clipboard,
  Send,
  Copy,
  Check,
  ExternalLink,
  Code2,
  FileText,
  Globe
} from 'lucide-react';
import { SharedText } from '../types/index.js';
import { safeCopyToClipboard } from '../utils/formatters.js';

interface LiveClipboardProps {
  sharedTexts: SharedText[];
  onSendText: (content: string) => void;
  hasPeers: boolean;
}

export const LiveClipboard: React.FC<LiveClipboardProps> = ({
  sharedTexts,
  onSendText,
  hasPeers
}) => {
  const [inputContent, setInputContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const handleSend = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const clean = inputContent.trim();
    if (!clean) return;
    onSendText(clean);
    setInputContent('');
    setJustSent(true);
    setTimeout(() => setJustSent(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (id: string, content: string) => {
    await safeCopyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLanguageBadge = (type: string, lang?: string) => {
    if (type === 'url') {
      return (
        <span className="flex items-center space-x-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/40">
          <Globe className="w-2.5 h-2.5" />
          <span>Посилання</span>
        </span>
      );
    }
    if (type === 'code') {
      return (
        <span className="flex items-center space-x-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-800/40">
          <Code2 className="w-2.5 h-2.5" />
          <span>{lang || 'CODE'}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/40">
        <FileText className="w-2.5 h-2.5" />
        <span>Текст</span>
      </span>
    );
  };

  return (
    <div className="w-full bg-zinc-900/60 border border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clipboard className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-white text-base">Live-буфер обміну</h3>
        </div>
        <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
          Ctrl + Enter для швидкої відправки
        </span>
      </div>

      {/* Input box */}
      <form onSubmit={handleSend} className="relative mb-6">
        <textarea
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasPeers
              ? 'Вставте посилання, код або будь-який текст для миттєвої передачі...'
              : 'Введіть текст (буде передано одразу після підключення пристрою)...'
          }
          data-testid="clipboard-input"
          rows={3}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 pr-28 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-transparent transition-all resize-none font-mono"
        />

        <div className="absolute right-2.5 bottom-3.5 flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputContent.trim()}
            data-testid="send-clipboard-button"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            <span>{justSent ? 'Надіслано!' : 'Надіслати'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Shared items stream */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1" data-testid="shared-texts-list">
        {sharedTexts.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs border border-dashed border-zinc-800/80 rounded-2xl">
            Спільний буфер порожній. Надішліть перше повідомлення або посилання.
          </div>
        ) : (
          sharedTexts.map((item) => (
            <div
              key={item.id}
              data-testid={`shared-text-${item.id}`}
              className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 transition-all hover:border-zinc-700/80 group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getLanguageBadge(item.type, item.language)}
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {item.senderName || 'Пристрій'} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  {item.type === 'url' && (
                    <a
                      href={item.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors mr-1"
                      title="Відкрити посилання"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleCopy(item.id, item.content)}
                    data-testid={`copy-text-button-${item.id}`}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Скопійовано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-zinc-400" />
                        <span className="text-[11px]">Копіювати</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Content box */}
              {item.type === 'url' ? (
                <a
                  href={item.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline text-sm break-all font-mono"
                >
                  {item.content}
                </a>
              ) : (
                <pre className="text-xs text-zinc-200 font-mono whitespace-pre-wrap break-all bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/40 max-h-48 overflow-y-auto">
                  {item.content}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
