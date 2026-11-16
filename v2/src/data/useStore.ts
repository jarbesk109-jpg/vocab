import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CACHE_KEY, OUTBOX_KEY, createStore, studyDay } from '../../../logic/index.js';
import { supabaseBackend } from './supabaseBackend';
import { weeklySnapshot } from './weeklySnapshot';

export type Store = ReturnType<typeof createStore>;
export type StoreState = ReturnType<Store['getState']>;
export type StoreStatus = ReturnType<Store['getStatus']>;

/** `loading`: chưa có gì để vẽ; `error`: không tải được và máy chưa có bản lưu; `ready`: vẽ được. */
export type BootState = 'loading' | 'ready' | 'error';

/** Bản lưu trên máy (cache + outbox) là của tài khoản nào. */
const OWNER_KEY = 'recall.owner';
const FLUSH_EVERY_MS = 30_000;
/** Khi cửa sổ được focus mà không có gì chờ gửi thì tải lại bản server, nhưng không dày hơn mức này. */
const RELOAD_MIN_MS = 15_000;

const isOnline = () => navigator.onLine !== false;

/** Bản lưu trên máy của tài khoản khác thì bỏ: không bao giờ gửi lệnh của người này vào tài khoản người kia. */
function claimStorage(userId: string): void {
  try {
    if (localStorage.getItem(OWNER_KEY) === userId) return;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(OUTBOX_KEY);
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* không dùng được localStorage: store vẫn chạy bằng bản trong bộ nhớ */
  }
}

const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value); // store tự bắt lỗi hết chỗ lưu
  },
};

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Kho dữ liệu của người đang đăng nhập.
 * - Mở app: vẽ ngay từ bản lưu trên máy (nếu có) rồi tải bản server.
 * - Gửi lệnh đang chờ: sau mỗi lệnh (`send`), khi có mạng lại, khi cửa sổ được focus, và mỗi 30 giây.
 */
export function useStore(userId: string) {
  const store = useMemo(() => {
    claimStorage(userId);
    return createStore({ backend: supabaseBackend, storage: safeStorage, newId, today: () => studyDay(Date.now()), isOnline });
  }, [userId]);

  const [boot, setBoot] = useState<BootState>(() => (store.getStatus().empty ? 'loading' : 'ready'));
  const [attempt, setAttempt] = useState(0);

  // Hai giá trị dưới đây đổi đối tượng mỗi lần store báo thay đổi; giữa hai lần báo thì giữ nguyên.
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const status = useSyncExternalStore(store.subscribe, useStatusSnapshot(store));
  const online = useOnline();

  useEffect(() => {
    let alive = true;
    setBoot(store.getStatus().empty ? 'loading' : 'ready');
    store.load().then((res) => {
      if (!alive) return;
      // Không tải được: còn bản lưu trên máy thì vẫn dùng (đang chờ mạng); không có thì báo lỗi,
      // KHÔNG coi là tài khoản trống.
      setBoot(res.ok || !store.getStatus().empty ? 'ready' : 'error');
      if (res.ok) {
        // gửi nốt lệnh đang chờ rồi mới xét bản sao hằng tuần (bản sao lấy dữ liệu mới nhất)
        void Promise.resolve(store.flush()).then(() => {
          if (alive) void weeklySnapshot(store);
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [store, attempt]);

  useEffect(() => {
    let lastLoad = Date.now();
    const sync = () => {
      const s = store.getStatus();
      if (s.pending > 0) void store.flush();
      else if (!s.syncing && isOnline() && Date.now() - lastLoad > RELOAD_MIN_MS) {
        lastLoad = Date.now();
        void store.load();
      }
    };
    const flushPending = () => {
      if (store.getStatus().pending > 0 && isOnline()) void store.flush();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(flushPending, FLUSH_EVERY_MS);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [store]);

  const api = useMemo(
    () => ({
      /** Phát một lệnh rồi gửi ngay. */
      send(cmd: Record<string, unknown>) {
        const full = store.dispatch(cmd);
        void store.flush();
        return full;
      },
      /** Thử tải lại sau khi mở app không tải được. */
      retry: () => setAttempt((n) => n + 1),
    }),
    [store],
  );

  return { store, state, status, online, boot, ...api };
}

/** `getStatus()` trả đối tượng mới mỗi lần gọi; useSyncExternalStore cần cùng một đối tượng khi chưa đổi. */
function useStatusSnapshot(store: Store): () => StoreStatus {
  return useMemo(() => {
    let last: StoreStatus | null = null;
    return () => {
      const next = store.getStatus();
      if (last && last.pending === next.pending && last.syncing === next.syncing && last.error === next.error && last.empty === next.empty) {
        return last;
      }
      last = next;
      return next;
    };
  }, [store]);
}

function subscribeOnline(fn: () => void): () => void {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline);
}
