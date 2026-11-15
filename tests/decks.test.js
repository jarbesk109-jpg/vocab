import { describe, it, expect } from 'vitest';
import { applySessionResult, day1Name, renameOnDay1 } from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck, mkStudiedDeck } from './fixtures/small.js';

const T = '2026-11-14';
const KPI = 90;

describe('day1Name: tên deck theo ngày xong Ngày 1, dạng DDMM (mục 3.10)', () => {
  it('14/11 → 1411; giữ số 0 đứng đầu', () => {
    expect(day1Name('2026-11-14', [])).toBe('1411');
    expect(day1Name('2026-09-02', [])).toBe('0209');
    expect(day1Name('2027-01-05', [])).toBe('0501');
  });
  it('trùng ngày: deck thứ hai thêm b, thứ ba thêm c', () => {
    expect(day1Name(T, ['1411'])).toBe('1411b');
    expect(day1Name(T, ['1411', '1411b'])).toBe('1411c');
    expect(day1Name(T, ['1411b', '1411'])).toBe('1411c');
  });
  it('lấy hậu tố trống đầu tiên (tên b đã bị đổi tay thì dùng lại b)', () => {
    expect(day1Name(T, ['1411', '1411c'])).toBe('1411b');
    expect(day1Name(T, ['1411b'])).toBe('1411');
  });
  it('so tên: bỏ khoảng trắng hai đầu, không phân biệt hoa thường', () => {
    expect(day1Name(T, [' 1411 ', '1411B'])).toBe('1411c');
  });
  it('tên khác ngày không tính là trùng (kể cả cùng DDMM của ngày khác)', () => {
    expect(day1Name(T, ['1311', '1410', '14110', 'x1411'])).toBe('1411');
  });
  it('trùng với deck cũ mang tên cùng DDMM (năm trước) vẫn thêm hậu tố', () => {
    expect(day1Name('2027-08-16', ['1608', '1708'])).toBe('1608b');
  });
  it('hết z thì đánh số: -27, -28…', () => {
    const letters = 'bcdefghijklmnopqrstuvwxyz'.split('').map((c) => '1411' + c);
    expect(day1Name(T, ['1411', ...letters.slice(0, 24)])).toBe('1411z');
    expect(day1Name(T, ['1411', ...letters])).toBe('1411-27');
    expect(day1Name(T, ['1411', ...letters, '1411-27'])).toBe('1411-28');
  });
  it('không sửa mảng tên truyền vào; phần tử không phải chuỗi không làm sập', () => {
    const taken = ['1411', null, undefined, 5];
    const before = [...taken];
    expect(day1Name(T, taken)).toBe('1411b');
    expect(taken).toEqual(before);
  });
});

describe('renameOnDay1: chỉ đổi tên khi deck vừa xong Ngày 1 (mục 3.10)', () => {
  /** Deck kho mà hôm nay mọi thẻ đã đúng ít nhất 1 lần (vừa Học xong). */
  const stockLearned = (name, over = {}) =>
    mkStudiedDeck(name, T, { lastCompleted: null, history: [], anchor: '2026-11-20', ...over });
  const stockHalf = (name) =>
    mkDeck(name, { cards: [mkCard('a', { prod: { r: 1, streak: 1, last: T } }), mkCard('b')] });
  const run = (set, res) => applySessionResult(set, res, T, KPI);
  const LEARN = { mode: 'learn', pct: 100, full: false };
  const TEST = (pct) => ({ mode: 'test', pct, full: true });

  it('deck kho + Học xong đủ thẻ → tên thành DDMM của hôm nay; các trường khác y nguyên', () => {
    const res = run(stockLearned('Unit 5'), LEARN);
    expect(res.advanced).toBe(true);
    const out = renameOnDay1(res, [], T);
    expect(out.name).toBe('1411');
    expect(out).toEqual({ ...res.set, name: '1411' });
  });
  it('mọi deck đều đổi: tên tự do, tên dạng ngày khác, tên rỗng', () => {
    for (const name of ['IELTS reading 3', '2208', '']) {
      expect(renameOnDay1(run(stockLearned(name), LEARN), [], T).name).toBe('1411');
    }
  });
  it('deck mới xong Ngày 1 bằng Kiểm tra đạt KPI cũng đổi tên', () => {
    const res = run(mkDeck('k'), TEST(95));
    expect(res.advanced).toBe(true);
    expect(renameOnDay1(res, [], T).name).toBe('1411');
  });
  it('deck mới học dở (đã có câu trả lời từ hôm trước) xong Ngày 1 hôm nay → tên theo HÔM NAY', () => {
    const d = stockLearned('2208', { anchor: '2026-11-11' });
    expect(renameOnDay1(run(d, LEARN), [], T).name).toBe('1411');
  });
  it('Học mới được nửa deck → chưa xong Ngày 1 → không đổi tên', () => {
    const res = run(stockHalf('Unit 5'), LEARN);
    expect(res.advanced).toBe(false);
    expect(renameOnDay1(res, [], T)).toBe(res.set);
  });
  it('deck kho + Kiểm tra trượt → không đổi tên', () => {
    const res = run(mkDeck('Unit 5'), TEST(50));
    expect(renameOnDay1(res, [], T).name).toBe('Unit 5');
  });
  it('ôn KHÔNG đổi tên: đạt (lên mốc), trượt, lùi mốc phục hồi', () => {
    const pass = run(mkReviewDeck('Unit 5', 2, T), TEST(95));
    expect(pass.advanced).toBe(true);
    expect(renameOnDay1(pass, [], T)).toBe(pass.set);
    const fail = run(mkReviewDeck('Unit 5', 2, T), TEST(50));
    expect(renameOnDay1(fail, [], T).name).toBe('Unit 5');
    const drop = run(mkReviewDeck('Unit 5', 3, '2026-11-09'), TEST(50));
    expect(drop.dropped).toBe(true);
    expect(renameOnDay1(drop, [], T).name).toBe('Unit 5');
  });
  it('ôn mốc +1 đạt (mốc 1 → 2) không đổi tên', () => {
    const res = run(mkReviewDeck('Unit 5', 1, T), TEST(100));
    expect(res.stageTo).toBe(2);
    expect(renameOnDay1(res, [], T).name).toBe('Unit 5');
  });
  it('trùng ngày: deck thứ hai xong Ngày 1 cùng hôm → 1411b, thứ ba → 1411c', () => {
    expect(renameOnDay1(run(stockLearned('x'), LEARN), ['1411', '1608'], T).name).toBe('1411b');
    expect(renameOnDay1(run(stockLearned('y'), LEARN), ['1411', '1411b'], T).name).toBe('1411c');
  });
  it('tên của CHÍNH deck không tính là trùng: deck tên sẵn 1411 vẫn là 1411', () => {
    // otherNames chỉ gồm tên các deck KHÁC
    expect(renameOnDay1(run(stockLearned('1411'), LEARN), ['1608'], T).name).toBe('1411');
  });
  it('không sửa đầu vào', () => {
    const res = run(stockLearned('Unit 5'), LEARN);
    const before = structuredClone(res);
    renameOnDay1(res, ['1411'], T);
    expect(res).toEqual(before);
  });
});
