import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Globe,
  Wifi,
  Loader2,
  Settings2,
  CheckCircle2,
  Save,
  RotateCcw
} from 'lucide-react';
import { safeCopyToClipboard } from '../utils/formatters.js';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  lanIp?: string;
  publicUrl?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  lanIp,
  publicUrl
}) => {
  const [activeTab, setActiveTab] = useState<'internet' | 'wifi'>(publicUrl ? 'internet' : 'wifi');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customStaticUrl, setCustomStaticUrl] = useState('');
  const [isStaticSaved, setIsStaticSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if static URL is currently configured
  useEffect(() => {
    fetch('/api/network-info')
      .then((r) => r.json())
      .then((data) => {
        if (data?.staticUrl) {
          setCustomStaticUrl(data.staticUrl);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  // Internet (Global Tunnel) URL - works anywhere across 4G, other Wi-Fi, other cities
  const getInternetUrl = () => {
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/?room=${roomId}`;
    }
    return '';
  };

  // Local Wi-Fi URL - works within the same home/office network
  const getWifiUrl = () => {
    if (typeof window === 'undefined') return `http://localhost:4000/?room=${roomId}`;
    let host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : ':4000';
    if ((host === 'localhost' || host === '127.0.0.1') && lanIp && lanIp !== 'localhost') {
      host = lanIp;
    }
    return `http://${host}${port}/?room=${roomId}`;
  };

  const currentTab = activeTab === 'internet' && !publicUrl ? 'wifi' : activeTab;
  const currentUrl = currentTab === 'internet' ? getInternetUrl() : getWifiUrl();

  const handleCopyLink = async () => {
    if (!currentUrl) return;
    await safeCopyToClipboard(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = async () => {
    await safeCopyToClipboard(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveStaticDomain = async () => {
    setIsSaving(true);
    let clean = customStaticUrl.trim();
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
      setCustomStaticUrl(clean);
    }

    try {
      await fetch('/api/set-static-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticUrl: clean })
      });
      setIsStaticSaved(true);
      setTimeout(() => setIsStaticSaved(false), 2500);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToAuto = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/set-static-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticUrl: '' })
      });
      setCustomStaticUrl('');
      setIsStaticSaved(true);
      setTimeout(() => setIsStaticSaved(false), 2500);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold text-xs mb-3">
          <Smartphone className="w-4 h-4" />
          <span>Підключення смартфона</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Наведіть камеру телефона</h3>

        {/* Tab switchers: Internet vs Wi-Fi */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-2xl w-full mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('internet')}
            className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'internet'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Інтернет (4G / Будь-де)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wifi')}
            className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'wifi'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Домашній Wi-Fi</span>
          </button>
        </div>

        {/* Tab Description */}
        <p className="text-xs text-zinc-300 mb-3 max-w-xs leading-relaxed">
          {currentTab === 'internet' ? (
            publicUrl ? (
              <span className="text-emerald-400 font-medium">
                ⚡ Працює скрізь: мобільний інтернет 4G, інший Wi-Fi або інше місто.
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Підключення інтернет-тунелю... Зачекайте пару секунд.</span>
              </span>
            )
          ) : (
            <span>
              Пряме з'єднання через вашу домашню Wi-Fi мережу на максимальній швидкості роутера.
            </span>
          )}
        </p>

        {/* QR Code Container */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl shadow-2xl border-4 border-cyan-500/20 mb-3 relative">
          {currentUrl ? (
            <QRCodeSVG
              value={currentUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          ) : (
            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-zinc-500 text-xs">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
              <span>Генерація QR-коду...</span>
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3 mb-3 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">
              Код для ручного входу
            </span>
            <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-cyan-400">
              {roomId}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Скопійовано' : 'Копіювати код'}</span>
          </button>
        </div>

        {/* Copy full link button */}
        <button
          onClick={handleCopyLink}
          disabled={!currentUrl}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] mb-2"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <ExternalLink className="w-4 h-4" />}
          <span>
            {copiedLink
              ? 'Посилання скопійовано!'
              : currentTab === 'internet'
              ? 'Скопіювати посилання (для Viber / Telegram)'
              : 'Скопіювати посилання для Wi-Fi'}
          </span>
        </button>

        {/* Static Domain Settings Accordion */}
        <div className="w-full mt-2 pt-2 border-t border-zinc-800/80 text-left">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-cyan-400 py-1.5 transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              <span>Постійна адреса (статичний домен)</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              {showSettings ? 'Згорнути' : 'Налаштувати'}
            </span>
          </button>

          {showSettings && (
            <div className="mt-2.5 p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2.5 animate-fade-in">
              <p className="text-zinc-300 leading-relaxed text-[11px]">
                Вкажіть свій постійний домен (наприклад, безкоштовний static domain від ngrok чи Cloudflare). Тоді адреса буде <strong>завжди незмінною</strong>!
              </p>

              <div className="flex space-x-1.5">
                <input
                  type="text"
                  value={customStaticUrl}
                  onChange={(e) => setCustomStaticUrl(e.target.value)}
                  placeholder="https://my-app.ngrok-free.app"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveStaticDomain}
                  disabled={isSaving}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  {isStaticSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isStaticSaved ? 'Збережено' : 'Зберегти'}</span>
                </button>
              </div>

              {customStaticUrl && (
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  className="flex items-center space-x-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Скинути до автоматичного тунелю</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
