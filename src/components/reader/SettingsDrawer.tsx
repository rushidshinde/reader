'use client';

import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Maximize2, Minimize2, ZoomIn, ZoomOut, Monitor, Layers, RefreshCw, CheckCircle2, CloudOff, AlertCircle } from 'lucide-react';
import { ReaderSettings } from '@/lib/db';
import { syncManager, SyncState } from '@/lib/syncManager';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isFullscreen,
  onToggleFullscreen
}) => {
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [manualSyncing, setManualSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state, lastSync, count) => {
      setSyncState(state);
      setLastSyncTime(lastSync);
      setPendingCount(count);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setManualSyncing(true);
    await syncManager.performFullSync();
    setManualSyncing(false);
  };

  if (!isOpen) return null;

  const formatLastSync = (ts: number) => {
    if (!ts) return 'Never synced';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h2 className="font-serif font-bold text-lg">Reader Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Database Sync */}
          <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-750">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Database Sync
              </label>
              <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                {formatLastSync(lastSyncTime)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                {syncState === 'syncing' || manualSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-blue-500 font-semibold">Syncing with DB...</span>
                  </>
                ) : syncState === 'offline' ? (
                  <>
                    <CloudOff className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-500 font-medium">Offline ({pendingCount} unsynced)</span>
                  </>
                ) : syncState === 'pending' ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-500 font-medium">{pendingCount} local changes pending</span>
                  </>
                ) : syncState === 'error' ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 font-medium">Sync error</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Database Synced</span>
                  </>
                )}
              </div>

              <button
                onClick={handleManualSync}
                disabled={syncState === 'syncing' || manualSyncing}
                className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' || manualSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`py-3 px-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1.5 transition-all ${
                  settings.theme === 'light'
                    ? 'bg-white border-blue-600 text-blue-600 shadow-md ring-2 ring-blue-600/20'
                    : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                onClick={() => onUpdateSettings({ theme: 'sepia' })}
                className={`py-3 px-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1.5 transition-all ${
                  settings.theme === 'sepia'
                    ? 'bg-[#f8f1e5] border-amber-700 text-amber-900 shadow-md ring-2 ring-amber-700/20'
                    : 'bg-[#f2e7d5] border-amber-300/60 text-amber-900/80 hover:bg-[#ebdcc7]'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-amber-700/20 border border-amber-700" />
                <span>Sepia</span>
              </button>

              <button
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`py-3 px-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1.5 transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-stone-950 border-blue-500 text-blue-400 shadow-md ring-2 ring-blue-500/20'
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-750'
                }`}
              >
                <Moon className="w-4 h-4 text-blue-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Brightness */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Brightness
              </label>
              <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                {Math.round(settings.brightness * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Sun className="w-4 h-4 text-stone-400" />
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={settings.brightness}
                onChange={e => onUpdateSettings({ brightness: parseFloat(e.target.value) })}
                className="flex-1 accent-blue-600 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
              />
              <Sun className="w-5 h-5 text-stone-700 dark:text-stone-200" />
            </div>
          </div>

          {/* Zoom Level */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Zoom Scale
              </label>
              <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                {Math.round(settings.zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateSettings({ zoom: Math.max(0.5, Math.round((settings.zoom - 0.1) * 10) / 10) })}
                className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={settings.zoom}
                onChange={e => onUpdateSettings({ zoom: parseFloat(e.target.value) })}
                className="flex-1 accent-blue-600 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => onUpdateSettings({ zoom: Math.min(2.5, Math.round((settings.zoom + 0.1) * 10) / 10) })}
                className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reading Mode */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              Reading Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ reading_mode: 'continuous' })}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  settings.reading_mode === 'continuous'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Continuous Scroll</span>
              </button>

              <button
                onClick={() => onUpdateSettings({ reading_mode: 'paged' })}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  settings.reading_mode === 'paged'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Page-by-Page</span>
              </button>
            </div>
          </div>

          {/* Page Width */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              Page Max Width
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'compact', label: 'Compact' },
                { id: 'comfortable', label: 'Comfortable' },
                { id: 'wide', label: 'Wide' },
                { id: 'full', label: 'Full Width' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onUpdateSettings({ page_width: opt.id })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    settings.page_width === opt.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                      : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fullscreen Option */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              onClick={() => {
                onToggleFullscreen();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>Enter Fullscreen (F)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
