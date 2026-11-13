// Nhịp học (PLAN.md mục 3.5).
import { addDays, isDateStr } from './dates.js';

/** Cửa sổ tính nhịp: ngần này ngày ngay trước hôm nay. */
export const PACE_WINDOW_DAYS = 7;
/** Cần ít nhất ngần này ngày có thể tính thì mới báo nhịp. */
export const PACE_MIN_DAYS = 3;
/** Mỗi deck tốn 5 lượt trong đời nó: mới, +1, +3, +7, +16. */
export const UNITS_PER_DECK = 5;

/**
 * Nhịp học: số lượt/ngày trong 7 ngày ngay trước `today` (không gồm `today`), chỉ tính các ngày
 * từ ngày đầu tiên có bản ghi kiểu mới (có `d`). Ngày không có bản ghi tính 0.
 * @param {Record<string, any>} activity
 * @param {string} today
 * @returns {{pace: number | null, everyDays: number | null, everyDaysPlus1: number | null}}
 *   `everyDays`: với nhịp này, cứ bao nhiêu ngày thì kịp một deck mới; `everyDaysPlus1`: nếu thêm 1 lượt/ngày.
 */
export function paceInfo(activity, today) {
  let first = null;
  for (const k of Object.keys(activity || {})) {
    const rec = activity[k];
    if (isDateStr(k) && rec && typeof rec === 'object' && Array.isArray(rec.d) && (first === null || k < first)) first = k;
  }
  let days = 0;
  let units = 0;
  if (first !== null) {
    for (let i = PACE_WINDOW_DAYS; i >= 1; i--) {
      const day = addDays(today, -i);
      if (day < first) continue;
      days++;
      const rec = activity[day];
      if (rec && Array.isArray(rec.d)) units += rec.d.length;
    }
  }
  if (days < PACE_MIN_DAYS) return { pace: null, everyDays: null, everyDaysPlus1: null };
  const pace = Math.round((units / days) * 10) / 10;
  return {
    pace,
    everyDays: pace > 0 ? Math.max(1, Math.round(UNITS_PER_DECK / pace)) : null,
    everyDaysPlus1: Math.max(1, Math.round(UNITS_PER_DECK / (pace + 1))),
  };
}
