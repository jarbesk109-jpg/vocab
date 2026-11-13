// Ngày học (PLAN.md mục 3.1).
// Mọi "hôm nay" trong app là NGÀY HỌC: múi giờ Asia/Bangkok (UTC+7, không đổi giờ),
// ngày mới bắt đầu lúc 4h sáng. Ngày luôn là chuỗi 'YYYY-MM-DD', tính bằng UTC,
// không bao giờ dùng giờ máy. File này không gọi Date.now(): thời điểm luôn truyền vào.

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
/** +7 giờ múi giờ, −4 giờ mốc ngày mới. */
const STUDY_SHIFT_MS = (7 - 4) * HOUR_MS;

/**
 * Ngày học của một thời điểm.
 * @param {number} ms thời điểm (epoch milliseconds, ví dụ Date.now() do bên gọi truyền vào)
 * @returns {string} 'YYYY-MM-DD'
 */
export function studyDay(ms) {
  return new Date(ms + STUDY_SHIFT_MS).toISOString().slice(0, 10);
}

/**
 * @param {unknown} s
 * @returns {boolean} true khi `s` là chuỗi dạng YYYY-MM-DD
 */
export function isDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** @param {string} day */
function toUtcMs(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * @param {string} day 'YYYY-MM-DD'
 * @param {number} n số ngày cộng thêm (âm thì lùi)
 * @returns {string} 'YYYY-MM-DD'
 */
export function addDays(day, n) {
  return new Date(toUtcMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param {string} a 'YYYY-MM-DD'
 * @param {string} b 'YYYY-MM-DD'
 * @returns {number} a − b, tính bằng ngày
 */
export function dayDiff(a, b) {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS);
}
