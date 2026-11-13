// Lịch ôn theo deck (PLAN.md mục 3.2, 3.3).
import { addDays, dayDiff } from './dates.js';

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

/** Số deck ôn tối đa mỗi ngày (khi hôm đó có deck mới). */
export const REV_PER_DAY = 3;
/** Số deck mới tối đa mỗi ngày. */
export const NEW_PER_DAY = 1;
/** Trần: quá ngần này ngày chưa bắt đầu deck mới nào thì vẫn mời 1 deck mới dù còn bài ôn tồn. */
export const NEW_MAX_GAP_DAYS = 3;
/** Van an toàn: có HƠN ngần này deck ôn trễ thì tạm bỏ trần. */
export const LATE_VALVE = 4;
/** Ôn trễ HƠN ngần này ngày là lượt phục hồi. */
export const RECOVERY_LATE = 2;

/**
 * Trạng thái của một deck vào ngày `today` (mục 3.2). Không dời ngày, không sửa deck.
 * @param {any} set
 * @param {string} today 'YYYY-MM-DD'
 * @returns {{kind: 'graduated'} | {kind: 'stock'}
 *   | {kind: 'waiting', stage: number, late: number, gap: number, due?: string, ratio?: number, recovery?: boolean}
 *   | {kind: 'scheduled', due: string, days: number}}
 */
export function deckStatus(set, today) {
  const stageIdx = set.stageIdx || 0;
  if (stageIdx >= OFFSETS.length) return { kind: 'graduated' };
  if (stageIdx === 0) {
    if (!hasStudied(set)) return { kind: 'stock' };
    return { kind: 'waiting', stage: 0, late: Math.max(0, dayDiff(today, set.anchor)), gap: 1 };
  }
  const due = addDays(set.anchor, OFFSETS[stageIdx]);
  if (due > today) return { kind: 'scheduled', due, days: dayDiff(due, today) };
  const late = dayDiff(today, due);
  const gap = stageIdx <= 1 ? 1 : OFFSETS[stageIdx] - OFFSETS[stageIdx - 1];
  return {
    kind: 'waiting',
    due,
    stage: OFFSETS[stageIdx],
    late,
    gap,
    ratio: late / gap,
    recovery: set.recovering === true || late > RECOVERY_LATE,
  };
}

/**
 * Ngày deck bắt đầu được học: `startedAt`; không có thì ngày sớm nhất trong `history`;
 * không có thì `lastCompleted`; không có thì null.
 * @param {any} set
 * @returns {string | null}
 */
export function startedDay(set) {
  if (set.startedAt) return set.startedAt;
  let first = null;
  for (const h of set.history || []) {
    if (h && h.date && (first === null || h.date < first)) first = h.date;
  }
  return first ?? set.lastCompleted ?? null;
}

/** So sánh hai giá trị cùng kiểu (chuỗi hoặc số), tăng dần. */
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Thứ tự ưu tiên của hai deck `waiting` (mục 3.2). */
function byPriority(x, y) {
  const sx = x.set.stageIdx || 0;
  const sy = y.set.stageIdx || 0;
  return (
    cmp(sx <= 1 ? 0 : 1, sy <= 1 ? 0 : 1) ||
    cmp(y.status.late / y.status.gap, x.status.late / x.status.gap) ||
    cmp(sx, sy) ||
    cmp(x.set.anchor || '', y.set.anchor || '') ||
    cmp(x.set.name || '', y.set.name || '')
  );
}

/**
 * Danh sách Hôm nay: chọn tối đa 3 deck ôn + 1 deck mới (hoặc 4 deck ôn khi không có deck mới).
 * Hàm thuần: không sửa `sets`, không sửa deck nào.
 * @param {any[]} sets
 * @param {string} today 'YYYY-MM-DD'
 */
export function planToday(sets, today) {
  const items = sets.map((set) => ({ set, status: deckStatus(set, today) }));

  const done = items
    .filter((x) => x.set.lastCompleted === today)
    .map((x) => ({ ...x, wasNew: x.set.startedAt === today }));
  const newDone = done.filter((x) => x.wasNew).length;
  const revDone = done.length - newDone;

  const waiting = items
    .filter((x) => x.status.kind === 'waiting' && x.set.lastCompleted !== today)
    .sort(byPriority);
  const stockAll = items
    .filter((x) => x.status.kind === 'stock')
    .sort(
      (x, y) =>
        cmp(x.set.anchor || '', y.set.anchor || '') ||
        cmp(x.set.createdAt || '', y.set.createdAt || '') ||
        cmp(x.set.name || '', y.set.name || ''),
    );
  const lateCount = waiting.filter((x) => x.status.late >= 1).length;

  let lastNew = null;
  for (const set of sets) {
    if (!hasStudied(set)) continue;
    const d = startedDay(set);
    if (d && (lastNew === null || d > lastNew)) lastNew = d;
  }
  const daysSinceNew = lastNew ? dayDiff(today, lastNew) : null;

  const onTrack = lateCount === 0 && waiting.length <= Math.max(0, REV_PER_DAY - revDone);
  const ceiling = daysSinceNew === null || daysSinceNew > NEW_MAX_GAP_DAYS;
  const valve = lateCount > LATE_VALVE;

  let open = false;
  let reason;
  if (newDone >= NEW_PER_DAY) reason = 'doneNew';
  else if (stockAll.length === 0) reason = 'emptyStock';
  else if (onTrack) [open, reason] = [true, 'onTrack'];
  else if (valve) reason = 'valve';
  else if (ceiling) [open, reason] = [true, 'ceiling'];
  else reason = lateCount > 0 ? 'late' : 'full';

  const fresh = open ? stockAll[0] : null;
  const revCap = fresh || newDone > 0 ? REV_PER_DAY : REV_PER_DAY + NEW_PER_DAY;
  const revSlots = Math.max(0, revCap - revDone);

  return {
    today,
    done,
    reviews: waiting.slice(0, revSlots),
    fresh,
    more: waiting.slice(revSlots),
    stock: fresh ? stockAll.slice(1) : stockAll,
    upcoming: items.filter((x) => x.status.kind === 'scheduled').sort((x, y) => cmp(x.status.due, y.status.due)),
    gate: { open, reason, lateCount, daysSinceNew },
  };
}

/**
 * Số lượt còn có thể làm hôm nay (dùng cho streak, mục 3.4):
 * số deck đang chờ chưa xong hôm nay và chưa tính lượt, cộng tối đa 1 deck mới trong kho
 * (0 nếu hôm nay đã bắt đầu một deck mới).
 * @param {any[]} sets
 * @param {string} today 'YYYY-MM-DD'
 * @param {Iterable<string>} creditedIds id các deck đã tính lượt hôm nay
 * @returns {number}
 */
export function availableUnits(sets, today, creditedIds) {
  const credited = new Set(creditedIds || []);
  let waiting = 0;
  let stock = 0;
  let startedToday = false;
  for (const set of sets) {
    if (set.startedAt === today) startedToday = true;
    if (credited.has(set.id)) continue;
    const kind = deckStatus(set, today).kind;
    if (kind === 'waiting' && set.lastCompleted !== today) waiting++;
    else if (kind === 'stock') stock++;
  }
  return waiting + (startedToday ? 0 : Math.min(1, stock));
}

/**
 * Hôm nay đã học hết deck chưa (mục 3.3): deck có ít nhất 1 thẻ, và MỌI thẻ có ít nhất một chiều
 * được trả lời đúng hôm nay (`last === today` và `streak >= 1`). Học theo mẻ nhỏ cộng dồn được.
 * @param {any} set
 * @param {string} today
 * @returns {boolean}
 */
export function learnedToday(set, today) {
  const cards = set.cards || [];
  if (!cards.length) return false;
  return cards.every((c) => {
    const st = (c && c.st) || {};
    return ['prod', 'recog'].some((k) => st[k] && st[k].last === today && st[k].streak >= 1);
  });
}

/**
 * Áp kết quả một phiên học lên deck: luật lên mốc phương án (c), mục 3.3.
 * Deck mới xong Ngày 1 qua Học/Viết đủ thẻ (hoặc Kiểm tra đạt KPI); deck ôn chỉ lên mốc qua
 * Kiểm tra đủ bài đạt KPI. Mỗi deck tối đa 1 mốc và 1 lượt mỗi ngày. Flashcard không tính gì.
 * Hàm thuần: trả về bản sao đã sửa, không sửa `set`.
 * @param {any} set
 * @param {{mode: 'flash' | 'learn' | 'write' | 'test', pct: number, full: boolean}} result
 *   `full = true`: bài Kiểm tra đủ thẻ × 2 chiều
 * @param {string} today
 * @param {number} kpi % đạt
 * @returns {{set: any, advanced: boolean, dropped: boolean, credit: boolean, stageFrom: number, stageTo: number}}
 *   `credit`: phiên này được tính là một LƯỢT cho streak
 */
export function applySessionResult(set, { mode, pct, full }, today, kpi) {
  const status = deckStatus(set, today); // tính TRƯỚC mọi thay đổi
  const stageFrom = set.stageIdx || 0;
  const out = { ...set, history: [...(set.history || [])] };
  const res = { set: out, advanced: false, dropped: false, credit: false, stageFrom, stageTo: stageFrom };
  const fullTest = mode === 'test' && full === true;

  if (fullTest) out.history.push({ date: today, pct: Math.round(pct), mode: 'test', stage: stageFrom });
  if (mode === 'flash') return res;
  if (set.lastCompleted === today) return res; // mỗi deck tối đa 1 mốc và 1 lượt mỗi ngày

  const isNew = status.kind === 'stock' || (status.kind === 'waiting' && stageFrom === 0);
  if (isNew) {
    const complete = (fullTest && pct >= kpi) || ((mode === 'learn' || mode === 'write') && learnedToday(set, today));
    res.credit = complete || fullTest;
    if (complete) {
      out.anchor = today;
      out.stageIdx = 1;
      out.lastCompleted = today;
      out.startedAt = today;
      out.rescheduled = false;
      out.recovering = false;
      res.advanced = true;
    }
  } else if (status.kind === 'waiting' && fullTest) {
    res.credit = true; // làm xong bài là tính lượt, không cần đạt KPI
    if (pct >= kpi) {
      out.anchor = addDays(set.anchor, status.late);
      out.stageIdx = stageFrom + 1;
      out.lastCompleted = today;
      out.rescheduled = false;
      out.recovering = false;
      res.advanced = true;
    } else if (status.recovery) {
      out.stageIdx = Math.max(1, stageFrom - 1);
      out.anchor = addDays(today, 1 - OFFSETS[out.stageIdx]); // đến hạn ngày mai
      out.lastCompleted = today;
      out.recovering = false;
      res.dropped = out.stageIdx !== stageFrom;
    }
  }
  // deck 'scheduled' / 'graduated': học thêm vô hại, không đổi mốc, không tính lượt
  res.stageTo = out.stageIdx || 0;
  return res;
}
