import { describe, it, expect } from 'vitest';
import { accepts, acceptsVi, bumpCard, isRight, keyboardMismatch, norm, normVi, overrideRight } from '../logic/index.js';
import { mkCard } from './fixtures/small.js';

const T = '2026-11-15';
const card = (term, def, over = {}) => mkCard('x', { term, def, ...over });

describe('norm (mục 3.6, chuyển nguyên văn từ v1)', () => {
  it('chữ thường, cắt hai đầu, gộp khoảng trắng', () => {
    expect(norm('  Lead   TO  ')).toBe('lead to');
  });
  it('bỏ dấu câu cuối . , ; ! ?', () => {
    expect(norm('reduce.')).toBe('reduce');
    expect(norm('reduce?!')).toBe('reduce');
    expect(norm('reduce;')).toBe('reduce');
    expect(norm('e.g. this')).toBe('e.g. this'); // dấu ở giữa giữ nguyên
  });
  it('bỏ to / a / an / the đứng đầu (một lần)', () => {
    expect(norm('To Reduce.')).toBe('reduce');
    expect(norm('a government')).toBe('government');
    expect(norm('an apple')).toBe('apple');
    expect(norm('The Law')).toBe('law');
    expect(norm('together')).toBe('together'); // không phải từ "to" đứng riêng
    expect(norm('lead to')).toBe('lead to'); // "to" ở cuối giữ nguyên
  });
  it('rỗng, null, undefined → chuỗi rỗng', () => {
    expect(norm('')).toBe('');
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
  });
  it('normVi: bỏ dấu tiếng Việt, đ → d', () => {
    expect(normVi('Chính phủ')).toBe('chinh phu');
    expect(normVi('dẫn đến')).toBe('dan den');
    expect(normVi('Đường')).toBe('duong');
  });
});

describe('isRight chiều Việt→Anh (prod)', () => {
  it('To Reduce. = reduce', () => {
    expect(isRight(card('reduce', 'giảm'), 'prod', 'To Reduce.')).toBe(true);
    expect(isRight(card('to reduce', 'giảm'), 'prod', 'reduce')).toBe(true);
  });
  it('lead to / result in: gõ đúng một trong hai là đúng', () => {
    const c = card('lead to / result in', 'dẫn đến');
    expect(accepts(c)).toEqual(['lead to', 'result in']);
    expect(isRight(c, 'prod', 'lead to')).toBe(true);
    expect(isRight(c, 'prod', 'Result in')).toBe(true);
    expect(isRight(c, 'prod', 'lead')).toBe(false);
    expect(isRight(c, 'prod', 'lead to / result in')).toBe(false); // v1: chiều này không nhận cả chuỗi
  });
  it('tách cả bằng dấu phẩy', () => {
    const c = card('big, large', 'to');
    expect(isRight(c, 'prod', 'large')).toBe(true);
  });
  it('sai chính tả là sai; không bỏ dấu ở chiều tiếng Anh; ô trống là sai', () => {
    const c = card('reduce', 'giảm');
    expect(isRight(c, 'prod', 'reduse')).toBe(false);
    expect(isRight(c, 'prod', '')).toBe(false);
    expect(isRight(card('café', 'quán'), 'prod', 'cafe')).toBe(false);
  });
});

describe('isRight chiều Anh→Việt (recog)', () => {
  it('chinh phu = chính phủ; dan den = dẫn đến', () => {
    expect(isRight(card('government', 'chính phủ'), 'recog', 'chinh phu')).toBe(true);
    expect(isRight(card('lead to', 'dẫn đến'), 'recog', 'dan den')).toBe(true);
    expect(isRight(card('lead to', 'dẫn đến'), 'recog', 'Dẫn Đến.')).toBe(true);
  });
  it('thậm chí, ngay cả: gõ một trong hai nghĩa, hoặc cả chuỗi, đều đúng', () => {
    const c = card('even', 'thậm chí, ngay cả');
    expect(acceptsVi(c)).toEqual(['tham chi', 'ngay ca', 'tham chi, ngay ca']);
    expect(isRight(c, 'recog', 'thậm chí')).toBe(true);
    expect(isRight(c, 'recog', 'ngay ca')).toBe(true);
    expect(isRight(c, 'recog', 'thậm chí, ngay cả')).toBe(true);
    expect(isRight(c, 'recog', 'thậm')).toBe(false);
  });
  it('tách bằng /', () => {
    expect(isRight(card('big', 'to / lớn'), 'recog', 'lon')).toBe(true);
  });
  it('sai nghĩa là sai; ô trống là sai', () => {
    const c = card('government', 'chính phủ');
    expect(isRight(c, 'recog', 'chính quyền')).toBe(false);
    expect(isRight(c, 'recog', '   ')).toBe(false);
  });
});

describe('bumpCard (thuần: trả về thẻ mới)', () => {
  it('đúng: r++, streak++, last = hôm nay; không gắn sao', () => {
    const c = card('a', 'b', { prod: { r: 2, w: 1, streak: 1, last: '2026-11-01' } });
    const out = bumpCard(c, true, 'prod', false, T);
    expect(out.st.prod).toEqual({ r: 3, w: 1, streak: 2, typo: 0, last: T });
    expect(out.st.recog).toEqual(c.st.recog); // chiều kia không đổi
    expect(out.starred).toBe(false);
  });
  it('đúng nhưng có typo: typo++', () => {
    const out = bumpCard(card('a', 'b'), true, 'recog', true, T);
    expect(out.st.recog).toEqual({ r: 1, w: 0, streak: 1, typo: 1, last: T });
  });
  it('sai: _prevStreak = streak cũ, w++, streak = 0, gắn sao; typo không cộng', () => {
    const c = card('a', 'b', { prod: { r: 5, streak: 3, last: '2026-11-01' } });
    const out = bumpCard(c, false, 'prod', true, T);
    expect(out.st.prod).toEqual({ r: 5, w: 1, streak: 0, typo: 0, last: T, _prevStreak: 3 });
    expect(out.starred).toBe(true);
  });
  it('thẻ thiếu st hoặc thiếu chiều: tự tạo hồ sơ', () => {
    const out = bumpCard({ id: 'x', term: 'a', def: 'b' }, true, 'prod', false, T);
    expect(out.st).toEqual({ prod: { r: 1, w: 0, streak: 1, typo: 0, last: T } });
  });
  it('st kiểu cũ một chiều (st.r là số): bỏ, tạo lại như v1', () => {
    const out = bumpCard({ id: 'x', term: 'a', def: 'b', st: { r: 4, w: 1 } }, false, 'recog', false, T);
    expect(out.st).toEqual({ recog: { r: 0, w: 1, streak: 0, typo: 0, last: T, _prevStreak: 0 } });
  });
  it('không sửa đầu vào; giữ trường lạ', () => {
    const c = card('a', 'b', { la: [1], prod: { r: 1, streak: 1, la2: 'x' } });
    const before = structuredClone(c);
    const out = bumpCard(c, false, 'prod', false, T);
    expect(c).toEqual(before);
    expect(out.la).toEqual([1]);
    expect(out.st.prod.la2).toBe('x');
  });
});

describe('overrideRight ("Tôi đã gõ đúng")', () => {
  it('hoàn lại cú chấm sai: w--, r++, streak = _prevStreak + 1, xoá _prevStreak, gỡ sao', () => {
    const c = card('a', 'b', { prod: { r: 5, streak: 3, last: '2026-11-01' } });
    const wrong = bumpCard(c, false, 'prod', false, T);
    const out = overrideRight(wrong, 'prod', T);
    expect(out.st.prod).toEqual({ r: 6, w: 0, streak: 4, typo: 0, last: T });
    expect('_prevStreak' in out.st.prod).toBe(false);
    expect(out.starred).toBe(false);
    // bằng đúng kết quả nếu ngay từ đầu được chấm đúng
    expect(out).toEqual(bumpCard(c, true, 'prod', false, T));
  });
  it('w không bao giờ âm; không có _prevStreak thì streak = 1', () => {
    const out = overrideRight(card('a', 'b'), 'recog', T);
    expect(out.st.recog).toEqual({ r: 1, w: 0, streak: 1, typo: 0, last: T });
  });
  it('không sửa đầu vào', () => {
    const wrong = bumpCard(card('a', 'b'), false, 'prod', false, T);
    const before = structuredClone(wrong);
    overrideRight(wrong, 'prod', T);
    expect(wrong).toEqual(before);
  });
});

describe('keyboardMismatch (MỚI): bàn phím tiếng Việt ở ô tiếng Anh', () => {
  const c = card('reduce', 'giảm');
  it('chiều prod, đáp án toàn ASCII, gõ ra ký tự ngoài ASCII → true', () => {
    expect(keyboardMismatch('prod', 'rêduce', c)).toBe(true);
    expect(keyboardMismatch('prod', 'đ', c)).toBe(true);
  });
  it('gõ toàn ASCII (dù sai) → false; ô trống → false', () => {
    expect(keyboardMismatch('prod', 'reduse', c)).toBe(false);
    expect(keyboardMismatch('prod', '', c)).toBe(false);
  });
  it('chiều recog không bao giờ nhắc', () => {
    expect(keyboardMismatch('recog', 'giảm', c)).toBe(false);
  });
  it('đáp án đúng vốn có ký tự ngoài ASCII (café) → false', () => {
    expect(keyboardMismatch('prod', 'cafê', card('café', 'quán'))).toBe(false);
  });
});
