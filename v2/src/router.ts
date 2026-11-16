import { useSyncExternalStore } from 'react';

/** Các màn của app. Định tuyến bằng hash để chạy được trên GitHub Pages và nút Back đi đúng màn. */
export type Route = 'today' | 'decks' | 'deck' | 'deckNew' | 'deckEdit' | 'settings' | 'import' | 'study' | 'fx';

const PATHS: Record<Route, string> = {
  today: '#/',
  decks: '#/decks',
  deck: '#/decks',
  deckNew: '#/decks/new',
  deckEdit: '#/decks',
  settings: '#/settings',
  import: '#/import',
  study: '#/study',
  fx: '#/fx',
};

/** Đường dẫn vào màn học của một deck: `#/study/<id>`. */
export function studyHref(deckId: string): string {
  return `${PATHS.study}/${encodeURIComponent(deckId)}`;
}

/** Đường dẫn vào màn chi tiết của một deck: `#/decks/<id>`. */
export function deckHref(deckId: string): string {
  return `${PATHS.decks}/${encodeURIComponent(deckId)}`;
}

/** Đường dẫn vào màn sửa một deck: `#/decks/<id>/edit`. */
export function deckEditHref(deckId: string): string {
  return `${deckHref(deckId)}/edit`;
}

/** Đường dẫn (hash) của một màn, dùng cho thuộc tính href. */
export function hrefOf(route: Route): string {
  return PATHS[route];
}

function parse(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '') return 'today';
  if (path === 'decks') return 'decks';
  if (path === 'decks/new') return 'deckNew';
  if (/^decks\/[^/]+$/.test(path)) return 'deck';
  if (/^decks\/[^/]+\/edit$/.test(path)) return 'deckEdit';
  if (path === 'settings') return 'settings';
  if (path === 'import') return 'import';
  if (path === 'fx') return 'fx';
  if (/^study\/[^/]+$/.test(path)) return 'study';
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

function paramSnapshot(): string {
  const m = window.location.hash.match(/^#\/?(?:study|decks)\/([^/]+)(?:\/edit)?\/?$/);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return '';
  }
}

/** Id deck trong `#/study/<id>`, `#/decks/<id>`, `#/decks/<id>/edit` (chuỗi rỗng ở các màn khác). */
export function useStudyDeckId(): string {
  return useSyncExternalStore(subscribe, paramSnapshot);
}
