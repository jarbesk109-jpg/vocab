// Việc trên deck (PLAN.md mục 3.10; `parseCards`, `findDupTerms` thêm ở task 2.13a).

/** Tên để so trùng: bỏ khoảng trắng hai đầu, chữ thường. Không phải chuỗi → ''. */
function nameKey(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/**
 * Tên deck theo ngày xong Ngày 1: `DDMM` của ngày học `today`.
 * Trùng tên deck khác thì thêm hậu tố trống đầu tiên: b, c, … z, rồi `-27`, `-28`…
 * @param {string} today ngày học 'YYYY-MM-DD'
 * @param {any[]} otherNames tên các deck KHÁC (chưa xoá)
 * @returns {string}
 */
export function day1Name(today, otherNames) {
  const base = today.slice(8, 10) + today.slice(5, 7);
  const taken = new Set((otherNames || []).map(nameKey));
  if (!taken.has(base)) return base;
  for (let k = 2; ; k++) {
    const name = base + (k <= 26 ? String.fromCharCode(96 + k) : '-' + k);
    if (!taken.has(name)) return name;
  }
}

/**
 * Deck vừa xong Ngày 1 (kết quả `applySessionResult` lên mốc từ mốc 0) thì đổi tên theo `day1Name`.
 * Mọi trường hợp khác (ôn, học dở, trượt) trả lại đúng `result.set`. Không sửa đầu vào.
 * @param {{ set: any, advanced: boolean, stageFrom: number }} result kết quả của `applySessionResult`
 * @param {any[]} otherNames tên các deck KHÁC (chưa xoá)
 * @param {string} today ngày học 'YYYY-MM-DD'
 * @returns {any} deck
 */
export function renameOnDay1(result, otherNames, today) {
  if (!result.advanced || result.stageFrom !== 0) return result.set;
  return { ...result.set, name: day1Name(today, otherNames) };
}

/** Deck xong Ngày 1 trên v1 từ ngày này trở đi thì được đổi tên lúc chuyển dữ liệu sang v2 (Khang 15/11). */
export const DAY1_RENAME_FROM = '2026-11-15';

/**
 * Lúc chuyển dữ liệu v1 → v2: v1 không tự đổi tên, nên deck nào xong Ngày 1 trên v1
 * (`startedAt`) từ `fromDay` trở đi thì đổi tên theo ngày xong Ngày 1 THẬT, đúng luật `day1Name`.
 * Xử lý theo thứ tự (`startedAt`, vị trí trong mảng); thứ tự mảng giữ nguyên. Chạy lại cho cùng kết quả.
 * Không sửa đầu vào; deck không đổi tên là chính đối tượng cũ.
 * @param {any[]} sets các deck dạng v1
 * @param {string} [fromDay]
 * @returns {{ sets: any[], renamed: { id: string, from: string, to: string }[] }}
 */
export function renameDay1OnImport(sets, fromDay = DAY1_RENAME_FROM) {
  const out = [...sets];
  const renamed = [];
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const todo = out
    .map((s, i) => i)
    .filter((i) => isDay(out[i].startedAt) && out[i].startedAt >= fromDay)
    .sort((a, b) => (out[a].startedAt < out[b].startedAt ? -1 : out[a].startedAt > out[b].startedAt ? 1 : a - b));
  for (const i of todo) {
    const set = out[i];
    const others = out.filter((_, j) => j !== i).map((s) => s.name);
    const name = day1Name(set.startedAt, others);
    if (name === set.name) continue;
    out[i] = { ...set, name };
    renamed.push({ id: set.id, from: set.name, to: name });
  }
  return { sets: out, renamed };
}
