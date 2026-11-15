import { describe, it, expect } from 'vitest';
import { buildTest, minGap, mulberry32, shuffled } from '../logic/index.js';
import { mkCard } from './fixtures/small.js';

const cardsOf = (n) => Array.from({ length: n }, (_, i) => mkCard('c' + (i + 1)));

/** Số câu KHÁC nằm giữa hai câu của cùng một thẻ (nhỏ nhất trên cả bài). */
function smallestGap(qs) {
  const pos = {};
  let min = Infinity;
  qs.forEach((q, i) => {
    if (q.cardId in pos) min = Math.min(min, i - pos[q.cardId] - 1);
    pos[q.cardId] = i;
  });
  return min;
}

describe('mulberry32', () => {
  it('cùng seed cho cùng dãy số; khác seed cho dãy khác; mọi số trong [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 200 }, () => c())).not.toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(190);
  });
  it('shuffled: hoán vị đủ phần tử, không sửa đầu vào, cùng seed cùng kết quả', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(src, mulberry32(7));
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
    expect(shuffled(src, mulberry32(7))).toEqual(out);
  });
});

describe('minGap', () => {
  it('min(8, floor(n / 2))', () => {
    expect([1, 2, 3, 9, 15, 16, 17, 30].map(minGap)).toEqual([0, 1, 1, 4, 7, 8, 8, 8]);
  });
});

describe('buildTest bài đủ (mục 3.8)', () => {
  it('n từ 1 tới 30, 50 seed mỗi n: đúng 2n câu, mỗi thẻ một prod một recog, khoảng cách ≥ minGap(n)', () => {
    for (let n = 1; n <= 30; n++) {
      const cards = cardsOf(n);
      for (let seed = 1; seed <= 50; seed++) {
        const qs = buildTest(cards, { full: true }, mulberry32(seed * 1000 + n));
        expect(qs.length).toBe(2 * n);
        const seen = new Set(qs.map((q) => q.cardId + '|' + q.dir));
        expect(seen.size).toBe(2 * n);
        for (const c of cards) {
          expect(seen.has(c.id + '|prod')).toBe(true);
          expect(seen.has(c.id + '|recog')).toBe(true);
        }
        if (n > 1) expect(smallestGap(qs)).toBeGreaterThanOrEqual(minGap(n));
      }
    }
  });

  it('cùng seed cho cùng kết quả; khác seed cho bài khác', () => {
    const cards = cardsOf(20);
    const a = buildTest(cards, { full: true }, mulberry32(5));
    expect(buildTest(cards, { full: true }, mulberry32(5))).toEqual(a);
    expect(buildTest(cards, { full: true }, mulberry32(6))).not.toEqual(a);
  });

  it('nửa đầu gồm đủ mọi thẻ; chiều hỏi trước là ngẫu nhiên (có cả prod lẫn recog)', () => {
    const qs = buildTest(cardsOf(20), { full: true }, mulberry32(1));
    const first = qs.slice(0, 20);
    expect(new Set(first.map((q) => q.cardId)).size).toBe(20);
    expect(new Set(first.map((q) => q.dir)).size).toBe(2);
  });

  it('nửa sau có được đổi chỗ (không phải lúc nào cũng y thứ tự nửa đầu)', () => {
    let differs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildTest(cardsOf(20), { full: true }, mulberry32(seed));
      const a = qs.slice(0, 20).map((q) => q.cardId).join();
      const b = qs.slice(20).map((q) => q.cardId).join();
      if (a !== b) differs++;
    }
    expect(differs).toBeGreaterThan(15);
  });

  it('loại câu mặc định: prod = write, recog = mcq', () => {
    const qs = buildTest(cardsOf(10), { full: true }, mulberry32(1));
    expect(qs.every((q) => q.type === (q.dir === 'prod' ? 'write' : 'mcq'))).toBe(true);
  });

  it('người học chọn loại câu cho từng chiều', () => {
    const qs = buildTest(cardsOf(10), { full: true, typeProd: 'mcq', typeRecog: 'tf' }, mulberry32(1));
    expect(qs.every((q) => q.type === (q.dir === 'prod' ? 'mcq' : 'tf'))).toBe(true);
  });

  it('mix: xoay vòng write, mcq, tf theo chỉ số câu (như v1)', () => {
    const qs = buildTest(cardsOf(6), { full: true, typeProd: 'mix', typeRecog: 'mix' }, mulberry32(1));
    expect(qs.map((q) => q.type)).toEqual(Array.from({ length: 12 }, (_, i) => ['write', 'mcq', 'tf'][i % 3]));
    const half = buildTest(cardsOf(6), { full: true, typeProd: 'mix', typeRecog: 'mcq' }, mulberry32(1));
    half.forEach((q, i) => expect(q.type).toBe(q.dir === 'recog' ? 'mcq' : ['write', 'mcq', 'tf'][i % 3]));
  });

  it('mỗi câu chỉ có cardId, dir, type; không sửa danh sách thẻ; deck rỗng → bài rỗng', () => {
    const cards = cardsOf(5);
    const before = structuredClone(cards);
    const qs = buildTest(cards, { full: true }, mulberry32(1));
    expect(Object.keys(qs[0]).sort()).toEqual(['cardId', 'dir', 'type']);
    expect(cards).toEqual(before);
    expect(buildTest([], { full: true }, mulberry32(1))).toEqual([]);
  });
});

describe('buildTest bài rút gọn (luyện tập)', () => {
  const cards = cardsOf(10);

  it("answerIn 'en': count câu, toàn chiều prod, không lặp thẻ", () => {
    const qs = buildTest(cards, { full: false, count: 6, answerIn: 'en' }, mulberry32(1));
    expect(qs.length).toBe(6);
    expect(qs.every((q) => q.dir === 'prod')).toBe(true);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(6);
  });
  it("answerIn 'vi': toàn chiều recog", () => {
    const qs = buildTest(cards, { full: false, count: 4, answerIn: 'vi' }, mulberry32(1));
    expect(qs.length).toBe(4);
    expect(qs.every((q) => q.dir === 'recog')).toBe(true);
  });
  it('một chiều: count lớn hơn số thẻ thì dừng ở số thẻ', () => {
    expect(buildTest(cards, { full: false, count: 50, answerIn: 'en' }, mulberry32(1)).length).toBe(10);
  });
  it("answerIn 'both': count ≤ n thì không lặp thẻ; lớn hơn thì hỏi chiều còn lại, vẫn giữ khoảng cách; tối đa 2n", () => {
    const few = buildTest(cards, { full: false, count: 8, answerIn: 'both' }, mulberry32(3));
    expect(few.length).toBe(8);
    expect(new Set(few.map((q) => q.cardId)).size).toBe(8);
    const many = buildTest(cards, { full: false, count: 15, answerIn: 'both' }, mulberry32(3));
    expect(many.length).toBe(15);
    expect(new Set(many.map((q) => q.cardId + q.dir)).size).toBe(15);
    expect(smallestGap(many)).toBeGreaterThanOrEqual(minGap(10));
    expect(buildTest(cards, { full: false, count: 99, answerIn: 'both' }, mulberry32(3)).length).toBe(20);
  });
  it("mặc định answerIn là 'both'; count thiếu hoặc ≤ 0 → bài rỗng", () => {
    const qs = buildTest(cards, { full: false, count: 10 }, mulberry32(9));
    expect(new Set(qs.map((q) => q.dir)).size).toBe(2);
    expect(buildTest(cards, { full: false, count: 0, answerIn: 'en' }, mulberry32(1))).toEqual([]);
    expect(buildTest(cards, { full: false }, mulberry32(1))).toEqual([]);
  });
  it('loại câu theo chiều và mix vẫn áp dụng; cùng seed cùng kết quả', () => {
    const o = { full: false, count: 9, answerIn: 'en', typeProd: 'mix' };
    const qs = buildTest(cards, o, mulberry32(2));
    expect(qs.map((q) => q.type)).toEqual(['write', 'mcq', 'tf', 'write', 'mcq', 'tf', 'write', 'mcq', 'tf']);
    expect(buildTest(cards, o, mulberry32(2))).toEqual(qs);
  });
});
