// Lịch ôn theo deck (PLAN.md mục 3.2, 3.3).

/** Ngày ôn kể từ Ngày 1 (`anchor`): Mới, +1, +3, +7, +16. `stageIdx` là chỉ số vào mảng này; 5 = xong chu kỳ. */
export const OFFSETS = [0, 1, 3, 7, 16];

/**
 * Deck đã từng học chưa (chuyển nguyên văn `daHoc` của v1, FIX 13/09):
 * có `lastCompleted`, hoặc có `history`, hoặc có thẻ nào từng trả lời đúng hay sai.
 * Deck đã từng học thì không bao giờ là "mới" nữa.
 * @param {any} set
 * @returns {boolean}
 */
export function hasStudied(set) {
  if (!set) return false;
  if (set.lastCompleted) return true;
  if ((set.history || []).length) return true;
  return (set.cards || []).some((c) => {
    const s = c && c.st;
    if (!s) return false;
    const p = s.prod || {};
    const r = s.recog || {};
    return (p.r || 0) > 0 || (p.w || 0) > 0 || (r.r || 0) > 0 || (r.w || 0) > 0;
  });
}
