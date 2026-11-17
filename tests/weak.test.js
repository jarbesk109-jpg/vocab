import { describe, it, expect } from 'vitest';
import { WEAK_NAME, applyCommand, deckStatus, isWeakCard, planToday, splitWeak, toV1, toV2 } from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck, mkState } from './fixtures/small.js';

const T = '2026-11-20';
const T1 = '2026-11-21';
const ok = (day) => ({ r: 3, streak: 3, last: day });
const bad = (day) => ({ r: 2, w: 1, streak: 0, last: day });

/** Deck ôn ở mốc +16 (stageIdx 4), đến hạn hôm nay; thẻ `w1`, `w2` vừa sai hôm nay, `g1`, `g2` đúng. */
function dueDeck(name = 'a', over = {}) {
  return mkReviewDeck(name, 4, T, {
    cards: [
      mkCard(name + '-g1', { prod: ok(T), recog: ok(T) }),
      mkCard(name + '-w1', { prod: bad(T), recog: ok(T) }),
      mkCard(name + '-g2', { prod: ok(T), recog: ok(T) }),
      mkCard(name + '-w2', { prod: ok(T), recog: bad(T), starred: true }),
    ],
    ...over,
  });
}
const stateOf = (sets) => ({ ...toV2(mkState(sets)), deleted: [] });
const deckOf = (s, id) => s.decks.find((d) => d.id === id);
const weakOf = (s) => s.decks.find((d) => d.kind === 'weak');
const ids = (d) => d.cards.map((c) => c.id);
const done = (deckId, pct, over = {}) => ({ id: 'cmd1', day: T, type: 'sessionDone', deckId, mode: 'test', pct, full: true, ...over });
/** Đặt deck về trạng thái "vừa qua mốc +16 hôm nay" như `applySessionResult` làm, rồi gọi `splitWeak`. */
const graduate = (s, id) => ({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, stageIdx: 5, lastCompleted: T } : d)) });

describe('isWeakCard', () => {
  it('sai hôm nay ở một chiều (streak 0, last = hôm nay) → yếu', () => {
    expect(isWeakCard(mkCard('x', { prod: bad(T), recog: ok(T) }), T)).toBe(true);
    expect(isWeakCard(mkCard('x', { prod: ok(T), recog: bad(T) }), T)).toBe(true);
  });
  it('đúng cả hai chiều hôm nay → không yếu', () => {
    expect(isWeakCard(mkCard('x', { prod: ok(T), recog: ok(T) }), T)).toBe(false);
  });
  it('sai rồi được "Tôi đã gõ đúng" hoàn lại (streak ≥ 1) → không yếu', () => {
    expect(isWeakCard(mkCard('x', { prod: { r: 3, w: 0, streak: 3, last: T }, recog: ok(T) }), T)).toBe(false);
  });
  it('sai từ hôm trước, hôm nay không sai → không yếu', () => {
    expect(isWeakCard(mkCard('x', { prod: bad('2026-11-01'), recog: ok(T) }), T)).toBe(false);
  });
  it('thẻ thiếu st, st kiểu cũ → không sập, không yếu', () => {
    expect(isWeakCard({ id: 'x' }, T)).toBe(false);
    expect(isWeakCard({ id: 'x', st: { r: 1, w: 2 } }, T)).toBe(false);
  });
});

describe('splitWeak: deck thường vừa qua mốc +16', () => {
  it('thẻ còn sai tách sang deck "Thẻ yếu" tự tạo; deck gốc chỉ còn thẻ đúng', () => {
    const s0 = stateOf([dueDeck('a'), mkDeck('k')]);
    const s = splitWeak(graduate(s0, 'id-a'), 'id-a', T, 'cmd1');
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-g1', 'a-g2']);
    const w = weakOf(s);
    expect(w).toBeTruthy();
    expect(w.name).toBe(WEAK_NAME);
    expect(w.name).toBe('Thẻ yếu');
    expect(w.id).toBe('weak-cmd1');
    expect(ids(w)).toEqual(['a-w1', 'a-w2']);
    expect(s.meta.deckOrder.at(-1)).toBe(w.id);
    expect(s.decks.at(-1)).toBe(w);
  });
  it('thẻ chuyển sang giữ nguyên điểm, sao, và ghi deck gốc (weakFrom)', () => {
    const s0 = stateOf([dueDeck('a')]);
    const src = deckOf(s0, 'id-a').cards[3];
    const w = weakOf(splitWeak(graduate(s0, 'id-a'), 'id-a', T, 'cmd1'));
    expect(w.cards[1]).toEqual({ ...src, weakFrom: 'id-a' });
  });
  it('deck "Thẻ yếu" chạy lịch riêng: bắt đầu ở mốc +1, hẹn ôn ngày mai, rồi tới hạn', () => {
    const s = splitWeak(graduate(stateOf([dueDeck('a')]), 'id-a'), 'id-a', T, 'cmd1');
    const w = weakOf(s);
    expect(w.stageIdx).toBe(1);
    expect(w.anchor).toBe(T);
    expect(deckStatus(w, T)).toMatchObject({ kind: 'scheduled', due: T1, days: 1 });
    expect(deckStatus(w, T1)).toMatchObject({ kind: 'waiting', stage: 1, late: 0 });
  });
  it('không thẻ nào sai → không tạo deck "Thẻ yếu", state giữ nguyên đối tượng', () => {
    const d = dueDeck('a');
    d.cards.forEach((c) => (c.st = { prod: ok(T), recog: ok(T) }));
    const s0 = graduate(stateOf([d]), 'id-a');
    expect(splitWeak(s0, 'id-a', T, 'cmd1')).toBe(s0);
  });
  it('không sửa state truyền vào', () => {
    const s0 = graduate(stateOf([dueDeck('a')]), 'id-a');
    const snap = structuredClone(s0);
    splitWeak(s0, 'id-a', T, 'cmd1');
    expect(s0).toEqual(snap);
  });
  it('đã có deck "Thẻ yếu" đang ở mốc +7: thẻ mới nối vào cuối, cả deck quay về mốc +1 từ hôm nay', () => {
    const weak = mkReviewDeck('y', 3, '2026-11-25', { id: 'weak-old', name: 'Thẻ yếu', kind: 'weak', cards: [mkCard('old-1', { weakFrom: 'id-z' })] });
    const s = splitWeak(graduate(stateOf([dueDeck('a'), weak]), 'id-a'), 'id-a', T, 'cmd9');
    const w = weakOf(s);
    expect(s.decks.filter((d) => d.kind === 'weak')).toHaveLength(1);
    expect(w.id).toBe('weak-old');
    expect(ids(w)).toEqual(['old-1', 'a-w1', 'a-w2']);
    expect(w.stageIdx).toBe(1);
    expect(w.anchor).toBe(T);
    expect(deckStatus(w, T).kind).toBe('scheduled');
  });
  it('deck "Thẻ yếu" đã xoá mềm thì không dùng lại: tạo deck mới', () => {
    const s0 = stateOf([dueDeck('a')]);
    s0.deleted = [mkDeck('y', { id: 'weak-old', kind: 'weak' })];
    const s = splitWeak(graduate(s0, 'id-a'), 'id-a', T, 'cmd2');
    expect(weakOf(s).id).toBe('weak-cmd2');
    expect(s.deleted).toHaveLength(1);
  });
  it('deck không tồn tại → state giữ nguyên', () => {
    const s0 = stateOf([dueDeck('a')]);
    expect(splitWeak(s0, 'khong-co', T, 'c')).toBe(s0);
  });
});

describe('splitWeak: chính deck "Thẻ yếu" vừa qua mốc +16', () => {
  const weakDue = (cards) => mkReviewDeck('y', 4, T, { id: 'weak-1', name: 'Thẻ yếu', kind: 'weak', cards });
  it('thẻ đã đúng trở về deck gốc (bỏ weakFrom); thẻ còn sai ở lại và deck chạy lại từ mốc +1', () => {
    const home = mkReviewDeck('a', 4, '2026-10-01', { stageIdx: 5, cards: [mkCard('a-g1')] });
    const w0 = weakDue([
      mkCard('a-w1', { prod: ok(T), recog: ok(T), weakFrom: 'id-a' }),
      mkCard('a-w2', { prod: bad(T), recog: ok(T), weakFrom: 'id-a' }),
    ]);
    const s = splitWeak(graduate(stateOf([home, w0]), 'weak-1'), 'weak-1', T, 'c');
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-g1', 'a-w1']);
    expect(deckOf(s, 'id-a').cards[1]).not.toHaveProperty('weakFrom');
    expect(deckOf(s, 'id-a').stageIdx).toBe(5);
    const w = weakOf(s);
    expect(ids(w)).toEqual(['a-w2']);
    expect(w.stageIdx).toBe(1);
    expect(w.anchor).toBe(T);
    expect(deckStatus(w, T1).kind).toBe('waiting');
  });
  it('mọi thẻ đều đúng → trả hết về deck gốc, deck "Thẻ yếu" rỗng và ở trạng thái xong vòng', () => {
    const home = mkReviewDeck('a', 4, '2026-10-01', { stageIdx: 5, cards: [mkCard('a-g1')] });
    const w0 = weakDue([mkCard('a-w1', { prod: ok(T), recog: ok(T), weakFrom: 'id-a' })]);
    const s = splitWeak(graduate(stateOf([home, w0]), 'weak-1'), 'weak-1', T, 'c');
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-g1', 'a-w1']);
    expect(weakOf(s).cards).toEqual([]);
    expect(weakOf(s).stageIdx).toBe(5);
    expect(deckStatus(weakOf(s), T1).kind).toBe('graduated');
  });
  it('deck gốc không còn (đã xoá) → thẻ đúng ở lại deck "Thẻ yếu", không mất', () => {
    const w0 = weakDue([mkCard('z-1', { prod: ok(T), recog: ok(T), weakFrom: 'id-gone' })]);
    const s0 = graduate(stateOf([w0]), 'weak-1');
    const s = splitWeak(s0, 'weak-1', T, 'c');
    expect(ids(weakOf(s))).toEqual(['z-1']);
    expect(weakOf(s).stageIdx).toBe(5);
  });
  it('thẻ từ nhiều deck gốc trở về đúng deck của mình', () => {
    const a = mkReviewDeck('a', 4, '2026-10-01', { stageIdx: 5, n: 1 });
    const b = mkReviewDeck('b', 4, '2026-10-01', { stageIdx: 5, n: 1 });
    const w0 = weakDue([
      mkCard('wa', { prod: ok(T), recog: ok(T), weakFrom: 'id-a' }),
      mkCard('wb', { prod: ok(T), recog: ok(T), weakFrom: 'id-b' }),
    ]);
    const s = splitWeak(graduate(stateOf([a, b, w0]), 'weak-1'), 'weak-1', T, 'c');
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-1', 'wa']);
    expect(ids(deckOf(s, 'id-b'))).toEqual(['b-1', 'wb']);
  });
});

describe('Thẻ yếu qua lệnh sessionDone (applyCommand)', () => {
  it('bài Kiểm tra đủ ở mốc +16 đạt KPI → deck xong vòng, thẻ sai tách ra', () => {
    const s = applyCommand(stateOf([dueDeck('a')]), done('id-a', 92));
    expect(deckOf(s, 'id-a').stageIdx).toBe(5);
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-g1', 'a-g2']);
    expect(ids(weakOf(s))).toEqual(['a-w1', 'a-w2']);
    expect(weakOf(s).id).toBe('weak-cmd1');
  });
  it('bài ở mốc +16 KHÔNG đạt KPI → chưa xong vòng, chưa tách thẻ nào', () => {
    const s = applyCommand(stateOf([dueDeck('a')]), done('id-a', 70));
    expect(deckOf(s, 'id-a').stageIdx).toBe(4);
    expect(deckOf(s, 'id-a').cards).toHaveLength(4);
    expect(weakOf(s)).toBeUndefined();
  });
  it('qua mốc +7 (chưa phải +16) mà có thẻ sai → không tách', () => {
    const d = mkReviewDeck('a', 3, T, { cards: dueDeck('a').cards });
    const s = applyCommand(stateOf([d]), done('id-a', 95));
    expect(deckOf(s, 'id-a').stageIdx).toBe(4);
    expect(deckOf(s, 'id-a').cards).toHaveLength(4);
    expect(weakOf(s)).toBeUndefined();
  });
  it('bài luyện tập / Học / Viết ở mốc +16 không tách', () => {
    for (const over of [{ full: false }, { mode: 'learn', full: false }, { mode: 'write', full: false }]) {
      const s = applyCommand(stateOf([dueDeck('a')]), done('id-a', 100, over));
      expect(weakOf(s)).toBeUndefined();
    }
  });
  it('áp cùng một lệnh hai lần từ cùng state cho cùng kết quả (id deck lấy từ id lệnh)', () => {
    const s0 = stateOf([dueDeck('a')]);
    expect(applyCommand(s0, done('id-a', 95))).toEqual(applyCommand(s0, done('id-a', 95)));
  });
  it('trả lời sai trong bài rồi xong bài: thẻ đó sang "Thẻ yếu"', () => {
    const d = dueDeck('a');
    d.cards.forEach((c) => (c.st = { prod: ok('2026-11-04'), recog: ok('2026-11-04') }));
    let s = stateOf([d]);
    s = applyCommand(s, { id: 'x1', day: T, type: 'answer', deckId: 'id-a', cardId: 'a-g2', dir: 'recog', ok: false });
    s = applyCommand(s, { id: 'x2', day: T, type: 'answer', deckId: 'id-a', cardId: 'a-g1', dir: 'prod', ok: false });
    s = applyCommand(s, { id: 'x3', day: T, type: 'override', deckId: 'id-a', cardId: 'a-g1', dir: 'prod' });
    s = applyCommand(s, done('id-a', 95));
    expect(ids(weakOf(s))).toEqual(['a-g2']);
    expect(ids(deckOf(s, 'id-a'))).toEqual(['a-g1', 'a-w1', 'a-w2']);
  });
});

describe('Thẻ yếu và phần còn lại của hệ thống', () => {
  it('deck "Thẻ yếu" không bị coi là "vừa bắt đầu deck mới" (cổng deck mới không đổi)', () => {
    const sets = [dueDeck('a'), mkDeck('k')];
    const before = planToday(sets, T).gate;
    const s = applyCommand(stateOf(sets), done('id-a', 95));
    const after = planToday(s.decks, T1);
    expect(after.gate.daysSinceNew).toBe(before.daysSinceNew === null ? null : before.daysSinceNew + 1);
    expect(after.reviews.map((x) => x.set.kind)).toContain('weak');
  });
  it('đổi sang dạng v1 rồi về lại: giữ nguyên kind và weakFrom', () => {
    const s = applyCommand(stateOf([dueDeck('a')]), done('id-a', 95));
    const back = toV2(toV1(s.meta, s.decks));
    expect(back.decks).toEqual(s.decks);
  });
});
