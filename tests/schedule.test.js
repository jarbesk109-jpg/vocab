import { describe, it, expect } from 'vitest';
import {
  LATE_VALVE,
  NEW_MAX_GAP_DAYS,
  NEW_PER_DAY,
  OFFSETS,
  RECOVERY_LATE,
  REV_PER_DAY,
  addDays,
  availableUnits,
  deckStatus,
  planToday,
  startedDay,
} from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck, mkStudiedDeck } from './fixtures/small.js';

const T = '2026-11-13'; // "hôm nay" của mọi test trong file này
const day = (n) => addDays(T, n);

/** Deck ôn ở mốc `stageIdx`, trễ `late` ngày so với hôm nay (âm = chưa đến hạn). */
const rev = (name, stageIdx, late = 0, over = {}) => mkReviewDeck(name, stageIdx, day(-late), over);
/** Deck mới trong kho. */
const stockDeck = (name, over = {}) => mkDeck(name, over);
/** Deck mới học dở: stageIdx 0 nhưng đã có câu trả lời. */
const halfDeck = (name, over = {}) =>
  mkDeck(name, { cards: [mkCard(name + '-1', { prod: { r: 1, streak: 1, last: day(-1) } }), mkCard(name + '-2')], ...over });
/** Deck ôn đã xong hôm nay (đã lên mốc, hẹn ngày sau). */
const doneReview = (name) => rev(name, 3, -7, { lastCompleted: T, started: '2026-01-01' });
/** Deck mới đã xong Ngày 1 hôm nay. */
const doneNew = (name) => mkStudiedDeck(name, T, { stageIdx: 1, anchor: T, startedAt: T });

const names = (items) => items.map((x) => x.set.name);

describe('hằng số (mục 3.2)', () => {
  it('đúng giá trị đã chốt', () => {
    expect(OFFSETS).toEqual([0, 1, 3, 7, 16]);
    expect([REV_PER_DAY, NEW_PER_DAY, NEW_MAX_GAP_DAYS, LATE_VALVE, RECOVERY_LATE]).toEqual([3, 1, 3, 4, 2]);
  });
});

describe('deckStatus', () => {
  it('stageIdx 5 (hoặc hơn) là graduated', () => {
    expect(deckStatus(rev('a', 4, 0, { stageIdx: 5 }), T)).toEqual({ kind: 'graduated' });
    expect(deckStatus(rev('a', 4, 0, { stageIdx: 6 }), T).kind).toBe('graduated');
  });

  it('stageIdx 0 chưa học là stock, KHÔNG phụ thuộc anchor', () => {
    expect(deckStatus(stockDeck('a', { anchor: day(-30) }), T)).toEqual({ kind: 'stock' });
    expect(deckStatus(stockDeck('a', { anchor: T }), T)).toEqual({ kind: 'stock' });
    expect(deckStatus(stockDeck('a', { anchor: day(9) }), T)).toEqual({ kind: 'stock' });
  });

  it('stageIdx 0 đã có câu trả lời là waiting (học dở), không phải stock', () => {
    const st = deckStatus(halfDeck('a', { anchor: day(-2) }), T);
    expect(st).toMatchObject({ kind: 'waiting', stage: 0, late: 2, gap: 1 });
    expect(deckStatus(halfDeck('a', { anchor: T }), T)).toMatchObject({ kind: 'waiting', stage: 0, late: 0, gap: 1 });
    // anchor ở tương lai: không trễ, không âm
    expect(deckStatus(halfDeck('a', { anchor: day(3) }), T)).toMatchObject({ kind: 'waiting', stage: 0, late: 0 });
  });

  it('chưa đến hạn là scheduled, kèm due và số ngày còn lại', () => {
    expect(deckStatus(rev('a', 2, -1), T)).toEqual({ kind: 'scheduled', due: day(1), days: 1 });
    expect(deckStatus(rev('a', 4, -9), T)).toEqual({ kind: 'scheduled', due: day(9), days: 9 });
  });

  it('đến hạn đúng hôm nay là waiting, không trễ', () => {
    expect(deckStatus(rev('a', 3, 0), T)).toEqual({
      kind: 'waiting', due: T, stage: 7, late: 0, gap: 4, ratio: 0, recovery: false,
    });
  });

  it('stage và gap theo từng mốc: +1 → 1, +3 → 2, +7 → 4, +16 → 9', () => {
    const got = [1, 2, 3, 4].map((i) => {
      const st = deckStatus(rev('a', i, 0), T);
      return [st.stage, st.gap];
    });
    expect(got).toEqual([[1, 1], [3, 2], [7, 4], [16, 9]]);
  });

  it('trễ: late = số ngày quá hạn, ratio = late / gap', () => {
    expect(deckStatus(rev('a', 3, 2), T)).toMatchObject({ kind: 'waiting', due: day(-2), late: 2, ratio: 0.5 });
    expect(deckStatus(rev('a', 1, 3), T)).toMatchObject({ late: 3, ratio: 3 });
    expect(deckStatus(rev('a', 4, 3), T).ratio).toBeCloseTo(3 / 9);
  });

  it('recovery: trễ hơn 2 ngày, hoặc deck mang cờ recovering', () => {
    expect(deckStatus(rev('a', 2, 2), T).recovery).toBe(false);
    expect(deckStatus(rev('a', 2, 3), T).recovery).toBe(true);
    expect(deckStatus(rev('a', 2, 0, { recovering: true }), T).recovery).toBe(true);
    expect(deckStatus(rev('a', 2, 0, { recovering: false }), T).recovery).toBe(false);
  });

  it('không sửa đầu vào', () => {
    const d = rev('a', 2, 3);
    const before = structuredClone(d);
    deckStatus(d, T);
    expect(d).toEqual(before);
  });
});

describe('startedDay', () => {
  it('startedAt được ưu tiên', () => {
    expect(startedDay(mkStudiedDeck('a', '2026-10-01', { startedAt: '2026-11-10' }))).toBe('2026-11-10');
  });
  it('không có startedAt: ngày sớm nhất trong history (history không cần sắp sẵn)', () => {
    const d = mkDeck('a', {
      lastCompleted: '2026-10-09',
      history: [{ date: '2026-10-08', pct: 90 }, { date: '2026-09-02', pct: 80 }, { date: '2026-10-09', pct: 95 }],
    });
    expect(startedDay(d)).toBe('2026-09-02');
  });
  it('không có history: lastCompleted', () => {
    expect(startedDay(mkDeck('a', { lastCompleted: '2026-10-09' }))).toBe('2026-10-09');
  });
  it('không có gì: null', () => {
    expect(startedDay(mkDeck('a'))).toBe(null);
    expect(startedDay(halfDeck('a'))).toBe(null);
  });
});

describe('planToday: thứ tự ưu tiên của deck đang chờ', () => {
  const order = (sets) => {
    const p = planToday(sets, T);
    return names([...p.reviews, ...p.more]);
  };

  it('mốc +1 đúng hạn đứng trước deck +7 trễ 5 ngày (không bao giờ bỏ mẻ hôm qua)', () => {
    expect(order([rev('b7-tre5', 3, 5), rev('a1-dunghan', 1, 0)])).toEqual(['a1-dunghan', 'b7-tre5']);
  });

  it('deck mới học dở (stageIdx 0) cũng thuộc nhóm đứng đầu', () => {
    expect(order([rev('b16-tre9', 4, 9), halfDeck('a-hocdo', { anchor: T })])).toEqual(['a-hocdo', 'b16-tre9']);
  });

  it('cùng nhóm: ratio lớn hơn lên trước (trễ nhiều so với khoảng cách ôn của chính nó)', () => {
    const sets = [
      rev('s4', 4, 3), // 3/9 = 0.33
      rev('s3', 3, 3), // 3/4 = 0.75
      rev('s2', 2, 2), // 2/2 = 1
    ];
    expect(order(sets)).toEqual(['s2', 's3', 's4']);
  });

  it('nhóm đầu cũng sắp theo ratio: +1 trễ 2 ngày trước +1 đúng hạn', () => {
    expect(order([rev('dunghan', 1, 0), rev('tre2', 1, 2)])).toEqual(['tre2', 'dunghan']);
  });

  it('hoà ratio thì mốc thấp trước', () => {
    expect(order([rev('s3', 3, 2), rev('s2', 2, 1)])).toEqual(['s2', 's3']); // đều 0.5
    expect(order([rev('s4', 4, 0), rev('s3', 3, 0), rev('s2', 2, 0)])).toEqual(['s2', 's3', 's4']); // đều 0
  });

  it('hoà cả mốc: anchor sớm hơn trước, rồi tới tên', () => {
    expect(order([halfDeck('x', { anchor: day(2) }), halfDeck('y', { anchor: day(1) })])).toEqual(['y', 'x']);
    expect(order([rev('b', 3, 1), rev('c', 3, 1), rev('a', 3, 1)])).toEqual(['a', 'b', 'c']);
  });
});

describe('planToday: cổng deck mới và số ô ôn', () => {
  it('đang theo kịp: 3 deck ôn đúng hạn + 1 deck mới', () => {
    const sets = [
      rev('r1', 2, 0), rev('r2', 3, 0), rev('r3', 4, 0),
      stockDeck('k2', { anchor: day(1) }), stockDeck('k1', { anchor: day(0) }),
      rev('sau', 4, -5),
    ];
    const p = planToday(sets, T);
    expect(p.today).toBe(T);
    expect(p.gate).toMatchObject({ open: true, reason: 'onTrack', lateCount: 0 });
    expect(names(p.reviews)).toEqual(['r1', 'r2', 'r3']);
    expect(p.fresh.set.name).toBe('k1');
    expect(p.fresh.status).toEqual({ kind: 'stock' });
    expect(p.more).toEqual([]);
    expect(names(p.stock)).toEqual(['k2']);
    expect(names(p.upcoming)).toEqual(['sau']);
    expect(p.done).toEqual([]);
  });

  it('mỗi phần tử kèm chính deck (cùng tham chiếu) và status của nó', () => {
    const r = rev('r', 3, 2);
    const p = planToday([r, stockDeck('k')], T);
    expect(p.reviews[0].set).toBe(r);
    expect(p.reviews[0].status).toEqual(deckStatus(r, T));
  });

  it('chưa học deck nào, kho có deck: mời deck mới (onTrack), daysSinceNew null', () => {
    const p = planToday([stockDeck('k1'), stockDeck('k2')], T);
    expect(p.gate).toEqual({ open: true, reason: 'onTrack', lateCount: 0, daysSinceNew: null });
    expect(p.fresh.set.name).toBe('k1');
    expect(names(p.stock)).toEqual(['k2']);
  });

  it('5 deck trễ → valve: không deck mới, reviews có 4', () => {
    const sets = [rev('a', 2, 1), rev('b', 2, 2), rev('c', 3, 1), rev('d', 3, 2), rev('e', 4, 1), stockDeck('k')];
    const p = planToday(sets, T);
    expect(p.gate.daysSinceNew).toBeGreaterThan(NEW_MAX_GAP_DAYS); // trần 3 ngày lẽ ra đã mở
    expect(p.gate).toMatchObject({ open: false, reason: 'valve', lateCount: 5 });
    expect(p.fresh).toBe(null);
    expect(p.reviews.length).toBe(4);
    expect(p.more.length).toBe(1);
    expect(names(p.stock)).toEqual(['k']);
  });

  it('đúng 4 deck trễ thì van chưa đóng: trần 3 ngày vẫn mở deck mới', () => {
    const sets = [rev('a', 2, 1), rev('b', 2, 2), rev('c', 3, 1), rev('d', 3, 2), stockDeck('k')];
    const p = planToday(sets, T);
    expect(p.gate).toMatchObject({ open: true, reason: 'ceiling', lateCount: 4 });
    expect(p.fresh.set.name).toBe('k');
    expect(p.reviews.length).toBe(3);
    expect(p.more.length).toBe(1);
  });

  it('2 deck trễ và daysSinceNew = 4 → ceiling mở', () => {
    const sets = [rev('a', 2, 1, { started: day(-4) }), rev('b', 3, 2), stockDeck('k')];
    const p = planToday(sets, T);
    expect(p.gate).toEqual({ open: true, reason: 'ceiling', lateCount: 2, daysSinceNew: 4 });
    expect(p.fresh.set.name).toBe('k');
    expect(names(p.reviews)).toEqual(['a', 'b']);
  });

  it('2 deck trễ và daysSinceNew = 3 → đóng, reason late', () => {
    const sets = [rev('a', 2, 1, { started: day(-3) }), rev('b', 3, 2), stockDeck('k')];
    const p = planToday(sets, T);
    expect(p.gate).toEqual({ open: false, reason: 'late', lateCount: 2, daysSinceNew: 3 });
    expect(p.fresh).toBe(null);
    expect(names(p.stock)).toEqual(['k']);
  });

  it('daysSinceNew lấy ngày bắt đầu MỚI NHẤT trong các deck đã học, ưu tiên startedAt', () => {
    const sets = [
      rev('cu', 3, 1, { started: day(-40) }),
      rev('moi', 2, 1, { started: day(-20), startedAt: day(-2) }),
      stockDeck('k'),
    ];
    expect(planToday(sets, T).gate.daysSinceNew).toBe(2);
  });

  it('chỉ có deck học dở đang trễ (chưa từng xong deck nào): daysSinceNew null → ceiling mở', () => {
    const p = planToday([halfDeck('h', { anchor: day(-1) }), stockDeck('k')], T);
    expect(p.gate).toEqual({ open: true, reason: 'ceiling', lateCount: 1, daysSinceNew: null });
    expect(names(p.reviews)).toEqual(['h']);
    expect(p.fresh.set.name).toBe('k');
  });

  it('không trễ nhưng quá 3 deck ôn, vừa có deck mới gần đây → đóng, reason full, reviews có 4', () => {
    const sets = [
      rev('a', 1, 0, { started: day(-1) }), rev('b', 2, 0), rev('c', 3, 0), rev('d', 4, 0), rev('e', 4, 0),
      stockDeck('k'),
    ];
    const p = planToday(sets, T);
    expect(p.gate).toEqual({ open: false, reason: 'full', lateCount: 0, daysSinceNew: 1 });
    expect(p.fresh).toBe(null);
    expect(names(p.reviews)).toEqual(['a', 'b', 'c', 'd']);
    expect(names(p.more)).toEqual(['e']);
  });

  it('đã xong 1 deck mới hôm nay → doneNew; số ô ôn vẫn là 3', () => {
    const sets = [doneNew('n'), rev('a', 2, 0), rev('b', 3, 0), rev('c', 3, 0), rev('d', 4, 0), stockDeck('k')];
    const p = planToday(sets, T);
    expect(p.gate).toMatchObject({ open: false, reason: 'doneNew', daysSinceNew: 0 });
    expect(p.fresh).toBe(null);
    expect(p.done.map((x) => [x.set.name, x.wasNew])).toEqual([['n', true]]);
    expect(p.done[0].status.kind).toBe('scheduled');
    expect(names(p.reviews)).toEqual(['a', 'b', 'c']);
    expect(names(p.more)).toEqual(['d']);
    expect(names(p.stock)).toEqual(['k']);
  });

  it('doneNew được xét trước emptyStock', () => {
    const p = planToday([doneNew('n'), rev('a', 2, 0)], T);
    expect(p.gate.reason).toBe('doneNew');
  });

  it('đã xong 2 deck ôn hôm nay, có deck mới → còn 1 ô ôn', () => {
    const sets = [
      doneReview('x1'), doneReview('x2'),
      rev('a', 2, 3), rev('b', 3, 3), rev('c', 4, 3),
      stockDeck('k'),
    ];
    const p = planToday(sets, T);
    expect(p.done.map((x) => [x.set.name, x.wasNew])).toEqual([['x1', false], ['x2', false]]);
    expect(p.gate).toMatchObject({ open: true, reason: 'ceiling', lateCount: 3 });
    expect(p.fresh.set.name).toBe('k');
    expect(names(p.reviews)).toEqual(['a']);
    expect(names(p.more)).toEqual(['b', 'c']);
  });

  it('đã xong 2 deck ôn hôm nay, còn đúng 1 deck ôn đúng hạn → vẫn theo kịp, mời deck mới', () => {
    const p = planToday([doneReview('x1'), doneReview('x2'), rev('a', 2, 0), stockDeck('k')], T);
    expect(p.gate).toMatchObject({ open: true, reason: 'onTrack' });
    expect(names(p.reviews)).toEqual(['a']);
  });

  it('đã xong 2 deck ôn hôm nay, còn 3 deck ôn đúng hạn, không có deck mới → 2 ô ôn (trần 4)', () => {
    const sets = [
      doneReview('x1'), doneReview('x2'),
      rev('a', 1, 0, { started: day(-1) }), rev('b', 3, 0), rev('c', 4, 0),
      stockDeck('k'),
    ];
    const p = planToday(sets, T);
    expect(p.gate).toMatchObject({ open: false, reason: 'full' });
    expect(names(p.reviews)).toEqual(['a', 'b']);
    expect(names(p.more)).toEqual(['c']);
  });

  it('đã xong đủ ô ôn thì reviews rỗng, không âm', () => {
    const sets = [doneReview('x1'), doneReview('x2'), doneReview('x3'), doneReview('x4'), doneReview('x5'), rev('a', 2, 1)];
    const p = planToday(sets, T);
    expect(p.reviews).toEqual([]);
    expect(names(p.more)).toEqual(['a']);
  });

  it('kho rỗng → emptyStock, ô thứ 4 là deck ôn kế tiếp (revCap = 4)', () => {
    const sets = [rev('a', 2, 0), rev('b', 3, 0), rev('c', 3, 0), rev('d', 4, 0), rev('e', 4, 0)];
    const p = planToday(sets, T);
    expect(p.gate).toMatchObject({ open: false, reason: 'emptyStock' });
    expect(p.fresh).toBe(null);
    expect(p.reviews.length).toBe(4);
    expect(p.more.length).toBe(1);
    expect(p.stock).toEqual([]);
  });

  it('deck đã xong hôm nay không nằm trong hàng chờ', () => {
    // deck ôn trượt ở lượt phục hồi: lastCompleted hôm nay; dù còn "đến hạn" cũng không hiện lại
    const failed = rev('truot', 2, 0, { lastCompleted: T });
    const p = planToday([failed, rev('a', 3, 0)], T);
    expect(names(p.done)).toEqual(['truot']);
    expect(names([...p.reviews, ...p.more])).toEqual(['a']);
  });

  it('kho sắp theo anchor, rồi createdAt, rồi tên', () => {
    const sets = [
      stockDeck('d', { anchor: day(2), createdAt: '2026-01-01' }),
      stockDeck('c', { anchor: day(1), createdAt: '2026-02-01' }),
      stockDeck('b', { anchor: day(1), createdAt: '2026-01-01' }),
      stockDeck('a', { anchor: day(1), createdAt: '2026-02-01' }),
    ];
    const p = planToday(sets, T);
    expect(p.fresh.set.name).toBe('b');
    expect(names(p.stock)).toEqual(['a', 'c', 'd']);
  });

  it('upcoming sắp theo ngày đến hạn; deck graduated không nằm ở đâu cả', () => {
    const sets = [rev('xa', 4, -9), rev('gan', 2, -1), rev('xong', 4, 0, { stageIdx: 5 })];
    const p = planToday(sets, T);
    expect(names(p.upcoming)).toEqual(['gan', 'xa']);
    expect(p.upcoming[0].status).toEqual({ kind: 'scheduled', due: day(1), days: 1 });
    const all = [...p.done, ...p.reviews, ...p.more, ...p.stock, ...p.upcoming];
    expect(names(all)).not.toContain('xong');
  });

  it('không có deck nào', () => {
    expect(planToday([], T)).toEqual({
      today: T, done: [], reviews: [], fresh: null, more: [], stock: [], upcoming: [],
      gate: { open: false, reason: 'emptyStock', lateCount: 0, daysSinceNew: null },
    });
  });

  it('không sửa đầu vào, không đổi thứ tự mảng sets', () => {
    const sets = [rev('b', 3, 5), rev('a', 1, 0), stockDeck('k2', { anchor: day(1) }), stockDeck('k1'), doneNew('n')];
    const before = structuredClone(sets);
    planToday(sets, T);
    expect(sets).toEqual(before);
  });
});

describe('availableUnits (số lượt còn có thể làm hôm nay, dùng cho streak)', () => {
  it('số deck đang chờ + tối đa 1 deck mới trong kho', () => {
    const sets = [rev('a', 2, 0), rev('b', 3, 4), stockDeck('k1'), stockDeck('k2'), rev('sau', 4, -3)];
    expect(availableUnits(sets, T, [])).toBe(3);
  });

  it('không có gì để làm → 0', () => {
    expect(availableUnits([], T, [])).toBe(0);
    expect(availableUnits([rev('sau', 4, -3), rev('xong', 4, 0, { stageIdx: 5 })], T, [])).toBe(0);
  });

  it('bỏ deck đã tính lượt hôm nay (creditedIds) và deck đã xong hôm nay', () => {
    const a = rev('a', 2, 0);
    const b = rev('b', 3, 1);
    const c = rev('c', 3, 0, { lastCompleted: T });
    expect(availableUnits([a, b, c], T, [])).toBe(2);
    expect(availableUnits([a, b, c], T, [a.id])).toBe(1);
    expect(availableUnits([a, b, c], T, [a.id, b.id])).toBe(0);
    expect(availableUnits([a, b, c], T, new Set([a.id]))).toBe(1); // nhận cả Set
  });

  it('deck học dở (stageIdx 0 đã có câu trả lời) tính là một deck đang chờ', () => {
    expect(availableUnits([halfDeck('h')], T, [])).toBe(1);
  });

  it('đã bắt đầu một deck mới hôm nay thì kho không còn tính', () => {
    expect(availableUnits([doneNew('n'), stockDeck('k1'), stockDeck('k2')], T, [])).toBe(0);
    expect(availableUnits([doneNew('n'), stockDeck('k1'), rev('a', 2, 0)], T, [])).toBe(1);
  });

  it('deck trong kho đã tính lượt thì không tính nữa', () => {
    const k = stockDeck('k');
    expect(availableUnits([k], T, [])).toBe(1);
    expect(availableUnits([k], T, [k.id])).toBe(0);
    expect(availableUnits([k, stockDeck('k2')], T, [k.id])).toBe(1);
  });
});
