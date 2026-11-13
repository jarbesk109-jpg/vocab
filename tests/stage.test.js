import { describe, it, expect } from 'vitest';
import { addDays, applySessionResult, deckStatus, learnedToday } from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck, mkStudiedDeck } from './fixtures/small.js';

const T = '2026-11-13';
const KPI = 90;
const day = (n) => addDays(T, n);

/** Deck ôn ở mốc `stageIdx`, trễ `late` ngày. */
const rev = (stageIdx, late = 0, over = {}) => mkReviewDeck('r', stageIdx, day(-late), over);
/** Deck kho mà hôm nay MỌI thẻ đã đúng ít nhất 1 lần (vừa Học xong). */
const stockLearned = (over = {}) => mkStudiedDeck('k', T, { lastCompleted: null, history: [], anchor: day(5), ...over });
/** Deck kho hôm nay mới đúng 1 trong 2 thẻ. */
const stockHalf = () =>
  mkDeck('k', { anchor: day(5), cards: [mkCard('a', { prod: { r: 1, streak: 1, last: T } }), mkCard('b')] });

const TEST = (pct) => ({ mode: 'test', pct, full: true });
const run = (set, res) => applySessionResult(set, res, T, KPI);
/** Kết quả "không đổi gì": deck y nguyên, không lên, không lùi. */
const untouched = (out, set) => {
  expect(out.set).toEqual(set);
  expect(out).toMatchObject({ advanced: false, dropped: false, stageFrom: set.stageIdx, stageTo: set.stageIdx });
};

describe('learnedToday (mục 3.3)', () => {
  it('mọi thẻ có ít nhất một chiều đúng hôm nay → true', () => {
    const d = mkDeck('a', {
      cards: [
        mkCard('1', { prod: { r: 1, streak: 1, last: T } }),
        mkCard('2', { recog: { r: 3, streak: 2, last: T } }),
      ],
    });
    expect(learnedToday(d, T)).toBe(true);
  });
  it('còn thẻ chưa đúng lần nào hôm nay → false', () => {
    expect(learnedToday(stockHalf(), T)).toBe(false);
  });
  it('đúng hôm qua không tính; hôm nay trả lời nhưng sai (streak 0) không tính', () => {
    expect(learnedToday(mkStudiedDeck('a', day(-1)), T)).toBe(false);
    const d = mkDeck('a', { cards: [mkCard('1', { prod: { w: 1, streak: 0, last: T } })] });
    expect(learnedToday(d, T)).toBe(false);
  });
  it('deck không có thẻ → false; thẻ thiếu st không làm sập', () => {
    expect(learnedToday(mkDeck('a', { cards: [] }), T)).toBe(false);
    expect(learnedToday(mkDeck('a', { cards: [{ id: 'x', term: 't', def: 'd' }] }), T)).toBe(false);
  });
});

describe('applySessionResult: deck mới (mục 3.3 bước 4)', () => {
  it('deck kho + Học xong đủ thẻ → mốc 1, anchor = startedAt = hôm nay', () => {
    const set = stockLearned({ rescheduled: true, recovering: true });
    const out = run(set, { mode: 'learn', pct: 100, full: false });
    expect(out).toMatchObject({ advanced: true, dropped: false, credit: true, stageFrom: 0, stageTo: 1 });
    expect(out.set).toMatchObject({
      stageIdx: 1, anchor: T, startedAt: T, lastCompleted: T, rescheduled: false, recovering: false,
    });
    expect(out.set.history).toEqual([]); // Học không ghi lịch sử Kiểm tra
    expect(deckStatus(out.set, T)).toEqual({ kind: 'scheduled', due: day(1), days: 1 });
  });

  it('deck kho + Viết xong đủ thẻ → cũng xong Ngày 1', () => {
    const out = run(stockLearned(), { mode: 'write', pct: 40, full: false });
    expect(out).toMatchObject({ advanced: true, credit: true, stageTo: 1 });
    expect(out.set.startedAt).toBe(T);
  });

  it('Học mới được nửa deck → không đổi, không credit', () => {
    const set = stockHalf();
    const out = run(set, { mode: 'learn', pct: 100, full: false });
    untouched(out, set);
    expect(out.credit).toBe(false);
  });

  it('deck mới học dở (stageIdx 0, đã có câu trả lời từ hôm trước) + Học xong hôm nay → mốc 1', () => {
    const set = stockLearned({ anchor: day(-3) });
    set.cards[0].st.prod = { r: 2, w: 1, streak: 1, typo: 0, last: T };
    expect(deckStatus(set, T).kind).toBe('waiting');
    const out = run(set, { mode: 'learn', pct: 100, full: false });
    expect(out).toMatchObject({ advanced: true, credit: true, stageFrom: 0, stageTo: 1 });
    expect(out.set.anchor).toBe(T);
  });

  it('deck kho + Kiểm tra đạt KPI → xong Ngày 1 (không cần qua Học)', () => {
    const out = run(mkDeck('k', { anchor: day(2) }), TEST(95));
    expect(out).toMatchObject({ advanced: true, credit: true, stageFrom: 0, stageTo: 1 });
    expect(out.set).toMatchObject({ stageIdx: 1, anchor: T, startedAt: T, lastCompleted: T });
    expect(out.set.history).toEqual([{ date: T, pct: 95, mode: 'test', stage: 0 }]);
  });

  it('deck kho + Kiểm tra trượt → không đổi mốc nhưng credit', () => {
    const set = mkDeck('k', { anchor: day(2) });
    const out = run(set, TEST(60));
    expect(out).toMatchObject({ advanced: false, dropped: false, credit: true, stageFrom: 0, stageTo: 0 });
    expect(out.set).toEqual({ ...set, history: [{ date: T, pct: 60, mode: 'test', stage: 0 }] });
    expect(out.set.startedAt).toBeUndefined();
  });
});

describe('applySessionResult: deck ôn (mục 3.3 bước 5)', () => {
  it('deck ôn + Học / Viết → không đổi, không credit', () => {
    for (const mode of ['learn', 'write']) {
      const set = mkReviewDeck('r', 2, T);
      set.cards.forEach((c) => (c.st.prod.last = T)); // hôm nay đã đúng hết thẻ
      expect(learnedToday(set, T)).toBe(true);
      const out = run(set, { mode, pct: 100, full: false });
      untouched(out, set);
      expect(out.credit).toBe(false);
    }
  });

  it('ôn đúng hạn + Kiểm tra đạt → mốc +1, anchor giữ', () => {
    const set = rev(2, 0, { rescheduled: true });
    const out = run(set, TEST(90)); // đúng bằng KPI là đạt
    expect(out).toMatchObject({ advanced: true, dropped: false, credit: true, stageFrom: 2, stageTo: 3 });
    expect(out.set).toMatchObject({ stageIdx: 3, anchor: set.anchor, lastCompleted: T, rescheduled: false, recovering: false });
    expect(out.set.startedAt).toBeUndefined();
    expect(out.set.history.at(-1)).toEqual({ date: T, pct: 90, mode: 'test', stage: 2 });
    expect(deckStatus(out.set, T)).toEqual({ kind: 'scheduled', due: day(4), days: 4 });
  });

  it('ôn trễ 2 ngày + đạt → anchor dời 2 ngày', () => {
    const set = rev(3, 2);
    const out = run(set, TEST(100));
    expect(out).toMatchObject({ advanced: true, stageFrom: 3, stageTo: 4 });
    expect(out.set.anchor).toBe(addDays(set.anchor, 2));
    expect(deckStatus(out.set, T)).toEqual({ kind: 'scheduled', due: day(9), days: 9 }); // +16 tính từ hôm thật sự ôn +7
  });

  it('ôn trễ 5 ngày (lượt phục hồi) + đạt → lên mốc, anchor dời 5 ngày, hết cờ recovering', () => {
    const set = rev(2, 5, { recovering: true });
    const out = run(set, TEST(92));
    expect(out).toMatchObject({ advanced: true, stageTo: 3 });
    expect(out.set).toMatchObject({ anchor: addDays(set.anchor, 5), recovering: false });
  });

  it('ôn trễ 5 ngày + trượt → lùi 1 mốc, đến hạn ngày mai', () => {
    const set = rev(3, 5);
    const out = run(set, TEST(70));
    expect(out).toMatchObject({ advanced: false, dropped: true, credit: true, stageFrom: 3, stageTo: 2 });
    expect(out.set).toMatchObject({ stageIdx: 2, lastCompleted: T, recovering: false });
    expect(deckStatus(out.set, T)).toEqual({ kind: 'scheduled', due: day(1), days: 1 });
    expect(out.set.history.at(-1)).toEqual({ date: T, pct: 70, mode: 'test', stage: 3 });
  });

  it('lượt phục hồi trượt ở mốc 1 → không lùi dưới mốc 1, vẫn hẹn ngày mai', () => {
    const set = rev(1, 5);
    const out = run(set, TEST(10));
    expect(out).toMatchObject({ advanced: false, dropped: false, credit: true, stageFrom: 1, stageTo: 1 });
    expect(out.set).toMatchObject({ stageIdx: 1, anchor: T, lastCompleted: T });
    expect(deckStatus(out.set, T)).toEqual({ kind: 'scheduled', due: day(1), days: 1 });
  });

  it('deck mang cờ recovering, đúng hạn + trượt → cũng lùi 1 mốc', () => {
    const out = run(rev(4, 0, { recovering: true }), TEST(50));
    expect(out).toMatchObject({ dropped: true, credit: true, stageFrom: 4, stageTo: 3 });
    expect(out.set.recovering).toBe(false);
    expect(deckStatus(out.set, day(1)).kind).toBe('waiting');
  });

  it('ôn thường (trễ không quá 2 ngày) + trượt → đứng yên, credit', () => {
    const set = rev(3, 2);
    const out = run(set, TEST(89.4));
    expect(out).toMatchObject({ advanced: false, dropped: false, credit: true, stageFrom: 3, stageTo: 3 });
    expect(out.set).toEqual({ ...set, history: [...set.history, { date: T, pct: 89, mode: 'test', stage: 3 }] });
    expect(out.set.lastCompleted).not.toBe(T); // vẫn nằm trong hàng chờ, thi lại được
  });

  it('đã lastCompleted hôm nay → không đổi dù đạt, không credit, vẫn ghi lịch sử', () => {
    const set = rev(2, 0, { lastCompleted: T });
    const out = run(set, TEST(100));
    expect(out).toMatchObject({ advanced: false, dropped: false, credit: false, stageFrom: 2, stageTo: 2 });
    expect(out.set).toEqual({ ...set, history: [...set.history, { date: T, pct: 100, mode: 'test', stage: 2 }] });
  });

  it('mốc 4 đạt → stageIdx 5 (xong chu kỳ)', () => {
    const out = run(rev(4, 0), TEST(95));
    expect(out).toMatchObject({ advanced: true, stageFrom: 4, stageTo: 5 });
    expect(deckStatus(out.set, T)).toEqual({ kind: 'graduated' });
  });

  it('Kiểm tra rút gọn (không đủ bài) → không gì cả, không ghi lịch sử', () => {
    const set = rev(2, 0);
    const out = run(set, { mode: 'test', pct: 100, full: false });
    untouched(out, set);
    expect(out.credit).toBe(false);
  });
});

describe('applySessionResult: các trường hợp không đổi mốc (bước 6, 7)', () => {
  it('deck scheduled + Kiểm tra đạt → chỉ thêm history', () => {
    const set = rev(3, -4);
    const out = run(set, TEST(100));
    expect(out).toMatchObject({ advanced: false, dropped: false, credit: false, stageFrom: 3, stageTo: 3 });
    expect(out.set).toEqual({ ...set, history: [...set.history, { date: T, pct: 100, mode: 'test', stage: 3 }] });
  });

  it('deck graduated + Kiểm tra → chỉ thêm history', () => {
    const set = rev(4, 0, { stageIdx: 5 });
    const out = run(set, TEST(100));
    expect(out).toMatchObject({ advanced: false, credit: false, stageFrom: 5, stageTo: 5 });
    expect(out.set.history.at(-1)).toEqual({ date: T, pct: 100, mode: 'test', stage: 5 });
  });

  it('flash → không gì cả, với mọi loại deck', () => {
    for (const set of [stockLearned(), rev(2, 0), rev(2, 5), rev(3, -4), mkDeck('k')]) {
      const out = run(set, { mode: 'flash', pct: 100, full: false });
      untouched(out, set);
      expect(out.credit).toBe(false);
    }
  });

  it('đầu vào không bị sửa; kết quả là đối tượng mới', () => {
    for (const [set, res] of [
      [stockLearned(), { mode: 'learn', pct: 100, full: false }],
      [rev(2, 1), TEST(100)],
      [rev(3, 5), TEST(10)],
      [rev(3, 0), TEST(10)],
    ]) {
      const before = structuredClone(set);
      const out = run(set, res);
      expect(set).toEqual(before);
      expect(out.set).not.toBe(set);
      expect(out.set.history).not.toBe(set.history);
    }
  });

  it('giữ nguyên trường lạ của deck', () => {
    const out = run(rev(2, 0, { la: { x: 1 } }), TEST(100));
    expect(out.set.la).toEqual({ x: 1 });
  });
});
