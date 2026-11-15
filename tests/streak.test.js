import { describe, it, expect } from 'vitest';
import { addDays, computeStreak, creditSession, dayUnits, recordAnswer, streakEvents, useFreeze } from '../logic/index.js';

const START = '2026-01-01';
/** Một ngày kiểu mới có `k` lượt (k deck đã tính lượt, mỗi deck 5 câu), không còn gì khác để làm. */
const U = (k = 1) => {
  const d = Array.from({ length: k }, (_, i) => 'deck' + i);
  return { n: 5 * k, by: Object.fromEntries(d.map((id) => [id, 5])), d, a: k };
};
/** Ngày kiểu mới chỉ có câu trả lời lẻ: `n` câu ở deck 'x' không tính lượt, `a` lượt có thể làm. */
const Q = (n, a = 0) => ({ n, by: { x: n }, d: [], a });
const MISS = null;
/** Ghép các bản ghi thành activity của những ngày liên tiếp bắt đầu từ START. */
function build(recs) {
  const activity = {};
  recs.forEach((r, i) => {
    if (r !== MISS) activity[addDays(START, i)] = r;
  });
  return { activity, last: addDays(START, recs.length - 1), day: (i) => addDays(START, i) };
}
const run = (n, rec = U()) => Array.from({ length: n }, () => rec);

describe('dayUnits (mục 3.4)', () => {
  it('không có bản ghi → 0', () => {
    expect(dayUnits(undefined, 1)).toBe(0);
    expect(dayUnits(null, 2)).toBe(0);
  });
  it('1 deck tính lượt → met1', () => {
    expect(dayUnits(U(1), 1)).toBe(1);
    expect(dayUnits(U(1), 2)).toBe(1);
  });
  it('2 deck tính lượt → met2', () => {
    expect(dayUnits(U(2), 2)).toBe(2);
  });
  it('a = 0, n = 20 → met1; n = 19 → không', () => {
    expect(dayUnits(Q(20, 0), 1)).toBe(1);
    expect(dayUnits(Q(19, 0), 1)).toBe(0);
  });
  it('a = 1 mà chỉ làm câu lẻ (không xong deck nào) → không tính, kể cả 100 câu', () => {
    expect(dayUnits(Q(100, 1), 1)).toBe(0);
  });
  it('a = 1, 1 lượt, 20 câu ngoài deck đó → met2', () => {
    expect(dayUnits({ n: 25, by: { A: 5, x: 20 }, d: ['A'], a: 1 }, 2)).toBe(2);
  });
  it('a = 1, 1 lượt, 50 câu đều trong deck đó → không met2', () => {
    expect(dayUnits({ n: 50, by: { A: 50 }, d: ['A'], a: 1 }, 2)).toBe(1);
  });
  it('a = 2, 1 lượt, 100 câu ngoài → không met2 (phải làm deck thứ hai)', () => {
    expect(dayUnits({ n: 105, by: { A: 5, x: 100 }, d: ['A'], a: 2 }, 2)).toBe(1);
  });
  it('a = 0, n = 40 → met2; n = 39 → chỉ 1', () => {
    expect(dayUnits(Q(40, 0), 2)).toBe(2);
    expect(dayUnits(Q(39, 0), 2)).toBe(1);
  });
  it('câu lẻ không cộng quá số lượt cần', () => {
    expect(dayUnits(Q(200, 0), 1)).toBe(1);
    expect(dayUnits(Q(200, 0), 2)).toBe(2);
  });
  it('thiếu a thì coi như a = số lượt đã làm; a nhỏ hơn số lượt đã làm cũng vậy', () => {
    expect(dayUnits({ n: 25, by: { A: 5, x: 20 }, d: ['A'] }, 2)).toBe(2);
    expect(dayUnits({ n: 25, by: { A: 5, x: 20 }, d: ['A'], a: 0 }, 2)).toBe(2);
  });
  it('ngày kiểu cũ: true và { n: 40 } tính met1, không bao giờ met2', () => {
    expect(dayUnits(true, 1)).toBe(1);
    expect(dayUnits(true, 2)).toBe(1);
    expect(dayUnits({ n: 40 }, 1)).toBe(1);
    expect(dayUnits({ n: 40 }, 2)).toBe(1);
    expect(dayUnits({ n: 1 }, 1)).toBe(1); // luật v1: có câu nào là tính ngày
    expect(dayUnits({ n: 0 }, 1)).toBe(0);
  });
});

describe('recordAnswer / creditSession / useFreeze', () => {
  const D = '2026-11-13';
  it('recordAnswer: ngày chưa có bản ghi', () => {
    expect(recordAnswer({}, D, 'A', 3)).toEqual({ [D]: { n: 1, by: { A: 1 }, d: [], a: 3 } });
  });
  it('recordAnswer: cộng dồn theo deck, a = số lượt đã tính + số còn làm được', () => {
    let act = recordAnswer({}, D, 'A', 3);
    act = recordAnswer(act, D, 'A', 3);
    act = recordAnswer(act, D, 'B', 3);
    expect(act[D]).toEqual({ n: 3, by: { A: 2, B: 1 }, d: [], a: 3 });
    act = creditSession(act, D, 'A', 2);
    act = recordAnswer(act, D, 'B', 2);
    expect(act[D]).toEqual({ n: 4, by: { A: 2, B: 2 }, d: ['A'], a: 3 });
  });
  it('recordAnswer: bản ghi cũ true coi là { n: 20 }; bản ghi cũ { n } giữ n', () => {
    expect(recordAnswer({ [D]: true }, D, 'A', 1)[D]).toEqual({ n: 21, by: { A: 1 }, d: [], a: 1 });
    expect(recordAnswer({ [D]: { n: 7 } }, D, 'A', 0)[D]).toEqual({ n: 8, by: { A: 1 }, d: [], a: 0 });
  });
  it('creditSession: thêm deck vào d, không trùng; tạo bản ghi nếu chưa có', () => {
    let act = creditSession({}, D, 'A', 1);
    expect(act[D]).toEqual({ n: 0, by: {}, d: ['A'], a: 2 });
    act = creditSession(act, D, 'A', 1);
    expect(act[D].d).toEqual(['A']);
    act = creditSession(act, D, 'B', 0);
    expect(act[D]).toEqual({ n: 0, by: {}, d: ['A', 'B'], a: 2 });
  });
  it('không sửa đầu vào, không đụng ngày khác', () => {
    const src = { '2026-11-12': true, [D]: { n: 1, by: { A: 1 }, d: ['A'], a: 1 } };
    const before = structuredClone(src);
    const a1 = recordAnswer(src, D, 'B', 0);
    const a2 = creditSession(src, D, 'B', 0);
    expect(src).toEqual(before);
    expect(a1['2026-11-12']).toBe(true);
    expect(a2['2026-11-12']).toBe(true);
    expect(a1).not.toBe(src);
  });
  it('useFreeze: thêm ngày, không trùng, không sửa đầu vào', () => {
    const src = ['2026-11-01'];
    expect(useFreeze(src, D)).toEqual(['2026-11-01', D]);
    expect(useFreeze(useFreeze(src, D), D)).toEqual(['2026-11-01', D]);
    expect(src).toEqual(['2026-11-01']);
    expect(useFreeze(undefined, D)).toEqual([D]);
  });
});

describe('computeStreak (mục 3.4)', () => {
  it('activity rỗng', () => {
    expect(computeStreak({}, [], '2026-11-13')).toEqual({ count: 0, best: 0, freezes: 0, status: 'pending', needUnits: 1 });
  });

  it('3 ngày liền → 3, hôm nay đã tính', () => {
    const { activity, last } = build(run(3));
    expect(computeStreak(activity, [], last)).toEqual({ count: 3, best: 3, freezes: 0, status: 'safe', needUnits: 0 });
  });

  it('hôm nay chưa học → pending, count giữ, cần 1 lượt', () => {
    const { activity, last } = build(run(3));
    expect(computeStreak(activity, [], addDays(last, 1))).toEqual({ count: 3, best: 3, freezes: 0, status: 'pending', needUnits: 1 });
  });

  it('hôm nay mới làm câu lẻ chưa đủ → vẫn pending', () => {
    const { activity, last } = build([...run(3), Q(10, 1)]);
    expect(computeStreak(activity, [], last)).toMatchObject({ count: 3, status: 'pending', needUnits: 1 });
  });

  it('hôm nào không có deck đến hạn: 20 câu là đủ một ngày', () => {
    const { activity, last } = build([...run(2), Q(20, 0)]);
    expect(computeStreak(activity, [], last)).toMatchObject({ count: 3, status: 'safe' });
  });

  it('lỡ 1 ngày rồi 2 lượt → chuỗi tiếp +1, ngày lỡ +0', () => {
    const { activity, last } = build([...run(3), MISS, U(2)]);
    expect(computeStreak(activity, [], last)).toMatchObject({ count: 4, best: 4, status: 'safe', needUnits: 0 });
  });

  it('học bù gấp đôi khi thiếu deck: 1 lượt + 20 câu ngoài, hoặc 40 câu', () => {
    const a = build([...run(3), MISS, { n: 25, by: { A: 5, x: 20 }, d: ['A'], a: 1 }]);
    expect(computeStreak(a.activity, [], a.last).count).toBe(4);
    const b = build([...run(3), MISS, Q(40, 0)]);
    expect(computeStreak(b.activity, [], b.last).count).toBe(4);
  });

  it('lỡ 1 ngày, 1 lượt, đã bấm băng và có băng → tiếp +1, hết băng', () => {
    const { activity, last } = build([...run(21), MISS, U(1)]);
    expect(computeStreak(activity, [], addDays(last, -2))).toMatchObject({ count: 21, freezes: 1 });
    expect(computeStreak(activity, [last], last)).toEqual({ count: 22, best: 22, freezes: 0, status: 'safe', needUnits: 0 });
  });

  it('lỡ 1 ngày, 1 lượt, không băng, ngày đã qua → chuỗi cũ mất, hôm đó là ngày 1 của chuỗi mới', () => {
    const { activity, last } = build([...run(5), MISS, U(1), U(1)]);
    expect(computeStreak(activity, [], last)).toMatchObject({ count: 2, best: 5, status: 'safe' });
    expect(computeStreak(activity, [], addDays(last, 1))).toMatchObject({ count: 2, best: 5, status: 'pending' });
    const one = build([...run(5), MISS, U(1)]);
    expect(computeStreak(one.activity, [], addDays(one.last, 1))).toMatchObject({ count: 1, best: 5, status: 'pending' });
  });

  it('cùng tình huống nhưng là hôm nay → atRisk, count giữ, còn thiếu 1 lượt', () => {
    const { activity, last } = build([...run(5), MISS, U(1)]);
    expect(computeStreak(activity, [], last)).toEqual({ count: 5, best: 5, freezes: 0, status: 'atRisk', needUnits: 1 });
  });

  it('hôm qua lỡ, hôm nay chưa học gì → atRisk, cần 2 lượt', () => {
    const { activity, last } = build([...run(5), MISS]);
    const t = addDays(last, 1);
    expect(computeStreak(activity, [], t)).toEqual({ count: 5, best: 5, freezes: 0, status: 'atRisk', needUnits: 2 });
  });

  it('atRisk, có băng: chưa bấm thì cần 2 lượt, bấm rồi thì cần 1; app không tự dùng băng', () => {
    const { activity, last } = build([...run(21), MISS]);
    const t = addDays(last, 1);
    expect(computeStreak(activity, [], t)).toMatchObject({ count: 21, freezes: 1, status: 'atRisk', needUnits: 2 });
    expect(computeStreak(activity, [t], t)).toMatchObject({ count: 21, freezes: 1, status: 'atRisk', needUnits: 1 });
    // có băng, học 1 lượt nhưng KHÔNG bấm: vẫn atRisk
    const oneUnit = { ...activity, [t]: U(1) };
    expect(computeStreak(oneUnit, [], t)).toMatchObject({ count: 21, freezes: 1, status: 'atRisk', needUnits: 1 });
    // ...và hết ngày thì chuỗi cũ mất, băng còn nguyên
    expect(computeStreak(oneUnit, [], addDays(t, 1))).toMatchObject({ count: 1, best: 21, freezes: 1, status: 'pending' });
  });

  it('lỡ 2 ngày liên tiếp → 0, băng không cứu', () => {
    const a = build([...run(5), MISS, MISS, U(1)]);
    expect(computeStreak(a.activity, [], a.last)).toMatchObject({ count: 1, best: 5, status: 'safe' });
    expect(computeStreak(a.activity, [], addDays(a.last, -1))).toMatchObject({ count: 5, best: 5, status: 'atRisk', needUnits: 2 });
    // hết ngày lỡ thứ hai: về 0
    const b = build([...run(21), MISS, MISS]);
    const t = addDays(b.last, 1);
    expect(computeStreak(b.activity, [b.last, t], t)).toMatchObject({ count: 0, best: 21, status: 'pending', needUnits: 1 });
    // sau khi đã về 0, bấm băng + học 2 lượt cũng chỉ là ngày 1 của chuỗi mới
    const c = build([...run(21), MISS, MISS, U(2)]);
    expect(computeStreak(c.activity, [c.last], c.last)).toMatchObject({ count: 1, best: 21, status: 'safe' });
  });

  it('băng ở ngày 21, tới ngày 42 vẫn chỉ 1 băng', () => {
    const { activity, day } = build(run(42));
    expect(computeStreak(activity, [], day(19)).freezes).toBe(0);
    expect(computeStreak(activity, [], day(20))).toMatchObject({ count: 21, freezes: 1 });
    expect(computeStreak(activity, [], day(41))).toMatchObject({ count: 42, best: 42, freezes: 1 });
  });

  it('dùng băng rồi thì nhận lại băng ở mốc 21 kế tiếp', () => {
    const { activity, day, last } = build([...run(21), MISS, ...run(20)]);
    expect(computeStreak(activity, [day(22)], day(22))).toMatchObject({ count: 22, freezes: 0 });
    expect(computeStreak(activity, [day(22)], last)).toMatchObject({ count: 41, freezes: 0 });
    const more = build([...run(21), MISS, ...run(21)]);
    expect(computeStreak(more.activity, [more.day(22)], more.last)).toMatchObject({ count: 42, freezes: 1 });
  });

  it('bấm băng khi không có băng → vô hiệu', () => {
    const { activity, last } = build([...run(5), MISS, U(1)]);
    expect(computeStreak(activity, [last], last)).toMatchObject({ count: 5, freezes: 0, status: 'atRisk', needUnits: 1 });
    expect(computeStreak(activity, [last], addDays(last, 1))).toMatchObject({ count: 1, best: 5 });
  });

  it('đã bấm băng nhưng làm đủ 2 lượt → băng còn nguyên', () => {
    const { activity, last } = build([...run(21), MISS, U(2)]);
    expect(computeStreak(activity, [last], last)).toMatchObject({ count: 22, freezes: 1, status: 'safe' });
  });

  it('bấm băng vào ngày không nguy thì không mất băng', () => {
    const { activity, last, day } = build(run(23));
    expect(computeStreak(activity, [day(21), day(22)], last)).toMatchObject({ count: 23, freezes: 1 });
  });

  it('ngày kiểu cũ: true và { n } tính ngày thường, nhưng không cứu được ngày lỡ', () => {
    const a = build([true, { n: 40 }, { n: 3 }]);
    expect(computeStreak(a.activity, [], a.last)).toMatchObject({ count: 3, best: 3, status: 'safe' });
    const b = build([true, true, MISS, { n: 40 }]);
    expect(computeStreak(b.activity, [], addDays(b.last, 1))).toMatchObject({ count: 1, best: 2 });
  });

  it('bỏ qua khoá không phải ngày và ngày sau hôm nay; không sửa đầu vào', () => {
    const { activity, last } = build(run(3));
    const src = { ...activity, rác: true, [addDays(last, 5)]: U(1) };
    const before = structuredClone(src);
    const used = [last];
    expect(computeStreak(src, used, last)).toMatchObject({ count: 3, best: 3, status: 'safe' });
    expect(src).toEqual(before);
    expect(used).toEqual([last]);
  });

  it('thiếu freezeUsedDays (dữ liệu cũ) vẫn chạy', () => {
    const { activity, last } = build(run(2));
    expect(computeStreak(activity, undefined, last).count).toBe(2);
  });
});

describe('streakEvents (mục 3.4, task 2.14a): hiệu ứng khi số streak đổi', () => {
  const st = (count, freezes = 0) => ({ count, best: count, freezes, status: 'safe', needUnits: 0 });
  const NONE = { increased: false, fire: false, milestone: false, freezeEarned: false };

  it('số tăng 2 → 3: lửa bùng; 1 → 2 và 0 → 1: tăng nhưng chưa có lửa', () => {
    expect(streakEvents(st(2), st(3))).toEqual({ increased: true, fire: true, milestone: false, freezeEarned: false });
    expect(streakEvents(st(1), st(2))).toEqual({ increased: true, fire: false, milestone: false, freezeEarned: false });
    expect(streakEvents(st(0), st(1))).toEqual({ increased: true, fire: false, milestone: false, freezeEarned: false });
  });
  it('mỗi lần lên số từ 3 trở đi đều có lửa', () => {
    for (const n of [3, 4, 9, 20, 77, 365]) expect(streakEvents(st(n - 1), st(n)).fire).toBe(true);
  });
  it('mốc lớn: 10, 50, 100, 200, 300, 400…', () => {
    for (const n of [10, 50, 100, 200, 300, 400, 1000]) {
      expect(streakEvents(st(n - 1), st(n))).toMatchObject({ increased: true, fire: true, milestone: true });
    }
  });
  it('không phải mốc lớn: 20, 30, 40, 60, 99, 101, 150, 250', () => {
    for (const n of [20, 30, 40, 60, 99, 101, 150, 250]) expect(streakEvents(st(n - 1), st(n)).milestone).toBe(false);
  });
  it('số không tăng (học thêm trong ngày đã tính, hoặc chưa đủ lượt): mọi cờ false, kể cả đang đứng ở mốc', () => {
    expect(streakEvents(st(10), st(10))).toEqual(NONE);
    expect(streakEvents(st(3), st(3))).toEqual(NONE);
    expect(streakEvents(st(0), st(0))).toEqual(NONE);
  });
  it('số giảm (chuỗi gãy, bắt đầu lại): mọi cờ false', () => {
    expect(streakEvents(st(50), st(1))).toEqual(NONE);
    expect(streakEvents(st(12), st(10))).toEqual(NONE);
    expect(streakEvents(st(7), st(0))).toEqual(NONE);
  });
  it('freezeEarned khi số băng tăng (chạm 21); đã có băng sẵn thì chạm 42 không báo; dùng băng không báo', () => {
    expect(streakEvents(st(20, 0), st(21, 1))).toEqual({ increased: true, fire: true, milestone: false, freezeEarned: true });
    expect(streakEvents(st(41, 1), st(42, 1)).freezeEarned).toBe(false);
    expect(streakEvents(st(30, 1), st(31, 0)).freezeEarned).toBe(false);
  });
  it('chưa có trạng thái trước (lần đầu mở app): không hiệu ứng gì', () => {
    expect(streakEvents(null, st(10))).toEqual(NONE);
    expect(streakEvents(undefined, st(3))).toEqual(NONE);
  });
  it('đi cùng computeStreak: xong lượt đầu của ngày thứ 3 → lửa; ngày thứ 21 → lửa + nhận băng', () => {
    const days = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(START, i), U(1)]));
    const run = (n) => {
      const today = addDays(START, n - 1);
      const after = days(n);
      const before = { ...after };
      delete before[today];
      return streakEvents(computeStreak(before, [], today), computeStreak(after, [], today));
    };
    expect(run(3)).toEqual({ increased: true, fire: true, milestone: false, freezeEarned: false });
    expect(run(10)).toMatchObject({ fire: true, milestone: true });
    expect(run(21)).toMatchObject({ fire: true, milestone: false, freezeEarned: true });
    // làm thêm lượt thứ hai trong ngày: không báo lại
    const today = addDays(START, 2);
    const one = days(3);
    const two = { ...one, [today]: U(2) };
    expect(streakEvents(computeStreak(one, [], today), computeStreak(two, [], today))).toEqual(NONE);
  });
});
