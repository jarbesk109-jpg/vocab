import { toV1 } from '../../../logic/index.js';
import { supabaseBackend } from './supabaseBackend';
import type { Store } from './useStore';

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Số bản sao hằng tuần được giữ lại. */
export const WEEKLY_KEEP = 8;

/**
 * Mở app mà bản sao gần nhất trên máy chủ đã quá 7 ngày (hoặc chưa có bản nào) thì lặng lẽ ghi một bản mới
 * (`reason 'weekly'`) rồi dọn các bản hằng tuần cũ, chỉ giữ `WEEKLY_KEEP` bản gần nhất.
 * Không báo gì cho người dùng; lỗi thì bỏ qua, lần mở app sau thử lại.
 */
export async function weeklySnapshot(store: Store, now = Date.now()): Promise<'written' | 'fresh' | 'skipped'> {
  try {
    if (store.getStatus().empty) return 'skipped';
    const latest = await supabaseBackend.latestSnapshotAt();
    if (latest && now - Date.parse(latest) < WEEK_MS) return 'fresh';
    const s = store.getState();
    await supabaseBackend.snapshot('weekly', toV1(s.meta, s.decks));
    await supabaseBackend.pruneWeeklySnapshots(WEEKLY_KEEP);
    return 'written';
  } catch {
    return 'skipped';
  }
}
