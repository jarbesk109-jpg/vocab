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
