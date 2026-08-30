import { getApiUrl } from './config';
import {
  getSyncQueue,
  removeSyncItems,
  saveLocalBooks,
  saveLocalBookmarks,
  saveLocalProgress,
  saveLocalSettings,
  setLastSyncTime,
  getLastSyncTime,
} from './localStorageDB';

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

type SyncListener = (state: SyncState, lastSyncTime: number, pendingCount: number) => void;

class SyncManager {
  private syncState: SyncState = 'synced';
  private listeners: Set<SyncListener> = new Set();
  private intervalId: any = null;
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Connection restored (online). Triggering sync...');
        this.performFullSync();
      });
      window.addEventListener('offline', () => {
        this.updateState('offline');
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial emit
    const pendingCount = getSyncQueue().length;
    listener(this.getSyncState(), getLastSyncTime(), pendingCount);
    return () => this.listeners.delete(listener);
  }

  public getSyncState(): SyncState {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'offline';
    }
    if (this.isSyncing) return 'syncing';
    const queue = getSyncQueue();
    if (queue.length > 0) return 'pending';
    return this.syncState;
  }

  public startPeriodicSync(intervalMs = 300000): void {
    if (this.intervalId) clearInterval(this.intervalId);

    // Run initial sync after a short delay
    setTimeout(() => {
      this.performFullSync();
    }, 2000);

    // Set 5-minute interval (300,000 ms)
    this.intervalId = setInterval(() => {
      console.log('[SyncManager] 5-minute periodic sync triggered');
      this.performFullSync();
    }, intervalMs);
  }

  public stopPeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateState(state: SyncState): void {
    this.syncState = state;
    const lastSync = getLastSyncTime();
    const pendingCount = getSyncQueue().length;
    this.listeners.forEach(fn => fn(this.getSyncState(), lastSync, pendingCount));
  }

  public async performFullSync(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('offline');
      return false;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;
    this.updateState('syncing');

    try {
      // 1. Push pending local changes to server DB
      const queue = getSyncQueue();
      const processedIds: string[] = [];

      for (const item of queue) {
        try {
          if (item.type === 'progress') {
            await fetch(getApiUrl('/api/progress'), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            processedIds.push(item.id);
          } else if (item.type === 'bookmark_add') {
            await fetch(getApiUrl('/api/bookmarks'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            processedIds.push(item.id);
          } else if (item.type === 'bookmark_delete') {
            await fetch(getApiUrl(`/api/bookmarks?id=${item.data.bookmarkId}`), {
              method: 'DELETE',
            });
            processedIds.push(item.id);
          } else if (item.type === 'settings') {
            await fetch(getApiUrl('/api/settings'), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            processedIds.push(item.id);
          }
        } catch (itemErr) {
          console.warn(`[SyncManager] Sync failed for queue item "${item.id}":`, itemErr);
          // Stop processing further queue items if network error occurs
          break;
        }
      }

      if (processedIds.length > 0) {
        removeSyncItems(processedIds);
      }

      // 2. Fetch fresh manifest & settings from server DB to keep local storage updated
      const booksRes = await fetch(getApiUrl('/api/books'));
      if (booksRes.ok) {
        const data: any = await booksRes.json();
        if (data.books) {
          saveLocalBooks(data.books);
        }
      }

      const settingsRes = await fetch(getApiUrl('/api/settings'));
      if (settingsRes.ok) {
        const sData: any = await settingsRes.json();
        if (sData.settings) {
          saveLocalSettings(sData.settings);
        }
      }

      const now = Date.now();
      setLastSyncTime(now);
      this.isSyncing = false;

      const remainingQueue = getSyncQueue();
      if (remainingQueue.length > 0) {
        this.updateState('pending');
      } else {
        this.updateState('synced');
      }

      return true;
    } catch (err) {
      console.error('[SyncManager] Error during full sync:', err);
      this.isSyncing = false;
      this.updateState('error');
      return false;
    }
  }
}

export const syncManager = new SyncManager();
