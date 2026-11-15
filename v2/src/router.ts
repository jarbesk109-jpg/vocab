import { useSyncExternalStore } from 'react';

/** Các màn của app. Định tuyến bằng hash để chạy được trên GitHub Pages và nút Back đi đúng màn. */
export type Route = 'today' | 'decks' | 'settings';

const PATHS: Record<Route, string> = {
  today: '#/',
  decks: '#/decks',
  settings: '#/settings',
};

/** Đường dẫn (hash) của một màn, dùng cho thuộc tính href. */
export function hrefOf(route: Route): string {
  return PATHS[route];
}

function parse(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '') return 'today';
  if (path === 'decks') return 'decks';
  if (path === 'settings') return 'settings';
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function snapshot(): Route {
  const route = parse(window.location.hash);
  if (route) return route;
  // Hash lạ: về Hôm nay, không thêm mục vào lịch sử (để Back không quay lại địa chỉ hỏng).
  window.history.replaceState(null, '', PATHS.today);
  return 'today';
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot);
}
