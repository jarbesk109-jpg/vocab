// Streak (PLAN.md mục 3.4). Mọi hàm đều thuần: trả về bản mới, không sửa đầu vào.
//
// activity[day] có 2 dạng:
//   cũ:  true  hoặc  { n }                       (giữ nguyên, không chuyển đổi)
//   mới: { n, by: { [deckId]: số câu }, d: [deckId đã tính lượt], a: số lượt có thể làm hôm đó }
import { addDays, isDateStr } from './dates.js';

/** Số câu thay cho một lượt khi thiếu deck. Cũng là giá trị quy đổi của bản ghi cũ `true`. */
export const UNIT_ANSWERS = 20;
/** Cứ ngần này ngày streak thì nhận 1 băng giữ lửa. */
export const FREEZE_EVERY = 21;
/** Giữ tối đa ngần này băng. */
export const FREEZE_MAX = 1;

/** Bản ghi của một ngày ở dạng mới (bản sao), để cộng thêm vào. */
function openRecord(rec) {
  if (rec === true) return { n: UNIT_ANSWERS, by: {}, d: [] };
  if (!rec || typeof rec !== 'object') return { n: 0, by: {}, d: [] };
  return { ...rec, n: rec.n || 0, by: { ...(rec.by || {}) }, d: [...(rec.d || [])] };
}

/**
 * Ghi nhận MỘT câu trả lời (lật flashcard không phải là câu).
 * @param {Record<string, any>} activity
 * @param {string} day ngày học
 * @param {string} deckId
 * @param {number} avail `availableUnits(sets, day, d)` tính SAU khi đã cập nhật deck
 */
export function recordAnswer(activity, day, deckId, avail) {
  const rec = openRecord(activity[day]);
  rec.n += 1;
  rec.by[deckId] = (rec.by[deckId] || 0) + 1;
  rec.a = rec.d.length + avail;
  return { ...activity, [day]: rec };
}

/**
 * Ghi nhận một LƯỢT (deck được `credit` bởi applySessionResult). Mỗi deck tối đa 1 lượt/ngày.
 * @param {Record<string, any>} activity
 * @param {string} day
 * @param {string} deckId
 * @param {number} avail `availableUnits(sets, day, d)` tính SAU khi đã cập nhật deck và đã thêm deck này vào d
 */
export function creditSession(activity, day, deckId, avail) {
  const rec = openRecord(activity[day]);
  if (!rec.d.includes(deckId)) rec.d.push(deckId);
  rec.a = rec.d.length + avail;
  return { ...activity, [day]: rec };
}

/**
 * Số lượt của một ngày, khi cần `needed` lượt (1 = ngày thường, 2 = ngày cứu streak).
 * Câu lẻ (ngoài các deck đã tính lượt) chỉ thay được cho lượt THIẾU DECK: 20 câu = 1 lượt.
 * @param {any} rec activity[day]
 * @param {number} needed
 * @returns {number}
 */
export function dayUnits(rec, needed) {
  if (!rec) return 0;
  if (rec === true) return 1;
  if (rec.d === undefined) return rec.n > 0 ? 1 : 0; // ngày kiểu cũ: luật v1, tối đa 1
  const S = rec.d.length;
  let inCredited = 0;
  for (const id of rec.d) inCredited += (rec.by && rec.by[id]) || 0;
  const extra = (rec.n || 0) - inCredited;
  const a = Math.max(rec.a ?? S, S);
  return S + Math.min(Math.floor(extra / UNIT_ANSWERS), Math.max(0, needed - a));
}

/**
 * Bấm "Dùng băng" cho ngày `day`.
 * @param {string[] | undefined} freezeUsedDays
 * @param {string} day
 * @returns {string[]}
 */
export function useFreeze(freezeUsedDays, day) {
  const list = freezeUsedDays || [];
  return list.includes(day) ? [...list] : [...list, day];
}

/**
 * Tính streak bằng cách đi từng ngày, từ ngày sớm nhất trong activity tới `today`.
 * `status` chỉ có nghĩa cho hôm nay: 'safe' (đã tính), 'pending' (chưa đủ, chưa nguy),
 * 'atRisk' (hôm qua lỡ, hôm nay chưa cứu xong).
 * @param {Record<string, any>} activity
 * @param {string[] | undefined} freezeUsedDays các ngày đã bấm "Dùng băng"
 * @param {string} today ngày học hôm nay
 * @returns {{count: number, best: number, freezes: number, status: 'safe' | 'pending' | 'atRisk', needUnits: number}}
 */
export function computeStreak(activity, freezeUsedDays, today) {
  const used = new Set(freezeUsedDays || []);
  const days = Object.keys(activity || {}).filter((k) => isDateStr(k) && k <= today).sort();

  let count = 0;
  let best = 0;
  let freezes = 0;
  let missed = false;
  /** @type {'safe' | 'pending' | 'atRisk'} */
  let status = 'pending';
  const inc = () => {
    count++;
    best = Math.max(best, count);
    if (count % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_MAX, freezes + 1);
  };

  if (days.length) {
    for (let day = days[0]; day <= today; day = addDays(day, 1)) {
      const rec = activity[day];
      const isToday = day === today;
      const met1 = dayUnits(rec, 1) >= 1;
      if (!missed) {
        if (met1) {
          inc();
          status = 'safe';
        } else if (isToday) status = 'pending';
        else if (count > 0) missed = true; // lỡ 1 ngày
      } else if (dayUnits(rec, 2) >= 2) {
        inc();
        missed = false;
        status = 'safe';
      } else if (met1 && used.has(day) && freezes > 0) {
        freezes--;
        inc();
        missed = false;
        status = 'safe';
      } else if (isToday) {
        status = 'atRisk'; // chưa cứu xong, ngày còn dang dở
      } else if (met1) {
        count = 1; // chuỗi cũ mất, hôm đó là ngày 1 của chuỗi mới
        best = Math.max(best, 1);
        missed = false;
      } else {
        count = 0; // lỡ 2 ngày liên tiếp
        missed = false;
      }
    }
  }

  const rec = activity ? activity[today] : undefined;
  let needUnits = 0;
  if (status === 'pending') needUnits = 1 - dayUnits(rec, 1);
  else if (status === 'atRisk') {
    needUnits = used.has(today) && freezes > 0 ? 1 - dayUnits(rec, 1) : 2 - dayUnits(rec, 2);
  }
  return { count, best, freezes, status, needUnits };
}

/**
 * Hiệu ứng cần chạy khi streak đổi từ `before` sang `after` (hai kết quả `computeStreak`
 * của cùng một ngày, trước và sau một lệnh). Luật 7 mục 3.4.
 * - `increased`: số streak vừa tăng.
 * - `fire`: lửa bùng (mỗi lần lên số, từ streak 3).
 * - `milestone`: màn chúc mừng lớn ở mốc 10, 50, 100, 200, 300, 400…
 * - `freezeEarned`: vừa nhận thêm một băng giữ lửa.
 * Chưa có `before` (lần đầu mở app) thì không có hiệu ứng nào.
 * @param {{ count: number, freezes: number } | null | undefined} before
 * @param {{ count: number, freezes: number }} after
 * @returns {{ increased: boolean, fire: boolean, milestone: boolean, freezeEarned: boolean }}
 */
export function streakEvents(before, after) {
  const increased = !!before && after.count > before.count;
  const n = after.count;
  return {
    increased,
    fire: increased && n >= 3,
    milestone: increased && (n === 10 || n === 50 || n % 100 === 0),
    freezeEarned: increased && after.freezes > before.freezes,
  };
}
