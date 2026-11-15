import { describe, it, expect } from 'vitest';
import { DAY1_RENAME_FROM, applySessionResult, day1Name, dropDupTerms, findDupTerms, parseCards, renameDay1OnImport, renameOnDay1 } from '../logic/index.js';
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

describe('renameDay1OnImport: đổi tên deck xong Ngày 1 trên v1 từ 15/11 (mục 3.10)', () => {
  /** Deck đã xong Ngày 1 trên v1 đã vá: có `startedAt`. */
  const started = (name, day, over = {}) => mkStudiedDeck(name, day, { stageIdx: 1, anchor: day, startedAt: day, ...over });
  const names = (r) => r.sets.map((s) => s.name);

  it('DAY1_RENAME_FROM là 15/11/2026', () => {
    expect(DAY1_RENAME_FROM).toBe('2026-11-15');
  });
  it('deck xong Ngày 1 ngày 15/11 và sau đó → tên theo ngày xong Ngày 1 THẬT (startedAt), không theo ngày nhập', () => {
    const r = renameDay1OnImport([started('2208', '2026-11-15'), started('3108', '2026-11-18')]);
    expect(names(r)).toEqual(['1511', '1811']);
    expect(r.renamed).toEqual([
      { id: 'id-2208', from: '2208', to: '1511' },
      { id: 'id-3108', from: '3108', to: '1811' },
    ]);
  });
  it('deck xong Ngày 1 trước 15/11 (kể cả 14/11) giữ tên', () => {
    const r = renameDay1OnImport([started('2208', '2026-11-14'), started('x', '2026-11-13')]);
    expect(names(r)).toEqual(['2208', 'x']);
    expect(r.renamed).toEqual([]);
  });
  it('deck cũ không có startedAt, deck kho, deck học dở: giữ tên', () => {
    const old = mkReviewDeck('1608', 4, '2026-11-20');
    const half = mkDeck('dở', { cards: [mkCard('a', { prod: { r: 1, streak: 1, last: '2026-11-16' } }), mkCard('b')] });
    const r = renameDay1OnImport([old, mkDeck('kho'), half]);
    expect(names(r)).toEqual(['1608', 'kho', 'dở']);
  });
  it('deck đã lên các mốc ôn sau đó vẫn đổi theo ngày xong Ngày 1', () => {
    const r = renameDay1OnImport([started('2208', '2026-11-15', { stageIdx: 3, lastCompleted: '2026-11-19' })]);
    expect(names(r)).toEqual(['1511']);
  });
  it('hai deck xong Ngày 1 cùng ngày: deck đứng trước trong danh sách giữ tên gốc, deck sau thêm b', () => {
    const r = renameDay1OnImport([started('x', '2026-11-16'), started('y', '2026-11-16'), started('z', '2026-11-16')]);
    expect(names(r)).toEqual(['1611', '1611b', '1611c']);
  });
  it('xử lý theo thứ tự ngày xong Ngày 1, không theo vị trí; thứ tự deck trong mảng giữ nguyên', () => {
    const r = renameDay1OnImport([started('muộn', '2026-11-17'), started('sớm', '2026-11-15')]);
    expect(names(r)).toEqual(['1711', '1511']);
    expect(r.renamed.map((x) => x.to)).toEqual(['1511', '1711']);
  });
  it('trùng với tên deck khác đang có → thêm hậu tố; tên của chính deck không tính', () => {
    const r = renameDay1OnImport([mkDeck('1511'), started('x', '2026-11-15'), started('1611', '2026-11-16')]);
    expect(names(r)).toEqual(['1511', '1511b', '1611']);
    expect(r.renamed).toEqual([{ id: 'id-x', from: 'x', to: '1511b' }]);
  });
  it('chạy lại lần hai cho cùng kết quả, không đổi thêm gì', () => {
    const first = renameDay1OnImport([started('x', '2026-11-16'), started('y', '2026-11-16'), mkDeck('1611c')]);
    expect(names(first)).toEqual(['1611', '1611b', '1611c']);
    const second = renameDay1OnImport(first.sets);
    expect(second.sets).toEqual(first.sets);
    expect(second.renamed).toEqual([]);
  });
  it('chỉ đổi trường name; không sửa đầu vào; deck không đổi là chính đối tượng cũ', () => {
    const sets = [started('x', '2026-11-15'), mkDeck('kho')];
    const before = structuredClone(sets);
    const r = renameDay1OnImport(sets);
    expect(sets).toEqual(before);
    expect(r.sets[0]).toEqual({ ...before[0], name: '1511' });
    expect(r.sets[1]).toBe(sets[1]);
  });
  it('mốc ngày truyền vào được; startedAt hỏng thì bỏ qua', () => {
    expect(names(renameDay1OnImport([started('x', '2026-11-14')], '2026-11-14'))).toEqual(['1411']);
    expect(names(renameDay1OnImport([mkDeck('x', { startedAt: 'abc' }), mkDeck('y', { startedAt: null })]))).toEqual(['x', 'y']);
  });
});

describe('parseCards: dán danh sách "từ: nghĩa" (task 2.13a)', () => {
  it('mỗi dòng một thẻ, cắt khoảng trắng hai đầu', () => {
    expect(parseCards('reduce: giảm\n  government :  chính phủ  ')).toEqual({
      cards: [
        { term: 'reduce', def: 'giảm' },
        { term: 'government', def: 'chính phủ' },
      ],
      bad: 0,
      badLines: [],
    });
  });
  it('tách ở dấu : ĐẦU TIÊN (nghĩa có thể chứa dấu :)', () => {
    expect(parseCards('ratio: tỉ lệ (vd 3:1): xem thêm').cards).toEqual([{ term: 'ratio', def: 'tỉ lệ (vd 3:1): xem thêm' }]);
  });
  it('bỏ dòng trống và dòng chỉ có khoảng trắng; nhận cả xuống dòng kiểu Windows', () => {
    const r = parseCards('\r\na: 1\r\n\r\n   \r\nb: 2\r\n');
    expect(r.cards).toEqual([{ term: 'a', def: '1' }, { term: 'b', def: '2' }]);
    expect(r.bad).toBe(0);
  });
  it('đếm dòng lỗi: không có dấu :, thiếu từ, thiếu nghĩa; dòng tốt vẫn được nhận', () => {
    const r = parseCards('không có dấu hai chấm\n: thiếu từ\nthiếu nghĩa:\nok: được\n :  ');
    expect(r.cards).toEqual([{ term: 'ok', def: 'được' }]);
    expect(r.bad).toBe(4);
    expect(r.badLines).toEqual(['không có dấu hai chấm', ': thiếu từ', 'thiếu nghĩa:', ':']);
  });
  it('giữ nguyên chữ hoa thường, dấu / và dấu phẩy trong từ và nghĩa; giữ thứ tự dòng; không tự bỏ dòng trùng', () => {
    const r = parseCards('Lead to / result in: dẫn đến\neven: thậm chí, ngay cả\neven: thậm chí');
    expect(r.cards).toEqual([
      { term: 'Lead to / result in', def: 'dẫn đến' },
      { term: 'even', def: 'thậm chí, ngay cả' },
      { term: 'even', def: 'thậm chí' },
    ]);
  });
  it('rỗng, null, undefined → không có thẻ, không sập', () => {
    for (const t of ['', '   \n  ', null, undefined]) expect(parseCards(t)).toEqual({ cards: [], bad: 0, badLines: [] });
  });
});

describe('findDupTerms: từ đã có ở deck khác (task 2.13a, chuyển từ v1)', () => {
  const deck = (name, terms, over = {}) => mkDeck(name, { cards: terms.map((t, i) => mkCard(name + i, { term: t })), ...over });
  const decks = () => [deck('1608', ['reduce', 'The Government', 'lead to / result in']), deck('1708', ['apple', 'reduce'])];
  const cardsOfTerms = (...terms) => terms.map((term, i) => ({ id: 'n' + i, term, def: 'x' }));

  it('so theo norm: hoa thường, khoảng trắng, dấu câu cuối, to/a/an/the đứng đầu', () => {
    const dups = findDupTerms(cardsOfTerms('To Reduce.', 'government', 'banana', '  APPLE '), decks(), null);
    expect(dups).toEqual([
      { term: 'To Reduce.', deck: '1608', deckId: 'id-1608' },
      { term: 'government', deck: '1608', deckId: 'id-1608' },
      { term: '  APPLE ', deck: '1708', deckId: 'id-1708' },
    ]);
  });
  it('từ có ở nhiều deck: báo deck đứng trước; một từ lặp trong danh sách đang soạn chỉ báo một lần', () => {
    const dups = findDupTerms(cardsOfTerms('reduce', 'Reduce', 'reduce!'), decks(), null);
    expect(dups).toEqual([{ term: 'reduce', deck: '1608', deckId: 'id-1608' }]);
  });
  it('bỏ qua chính deck đang sửa', () => {
    const all = decks();
    const own = all[0].cards.map((c) => ({ ...c }));
    expect(findDupTerms(own, all, 'id-1608')).toEqual([{ term: 'reduce', deck: '1708', deckId: 'id-1708' }]);
    expect(findDupTerms(own, all, null).length).toBe(3); // không nói đang sửa deck nào thì tính cả nó
  });
  it('so NGUYÊN chuỗi từ (như v1): "lead to" không trùng với "lead to / result in"', () => {
    expect(findDupTerms(cardsOfTerms('lead to', 'result in'), decks(), null)).toEqual([]);
    expect(findDupTerms(cardsOfTerms('Lead to / Result in'), decks(), null).length).toBe(1);
  });
  it('từ rỗng không bao giờ trùng; không trùng thì trả về mảng rỗng; không sửa đầu vào', () => {
    const all = [...decks(), deck('rỗng', ['', '  '])];
    const before = structuredClone(all);
    const cards = cardsOfTerms('', '  ', 'mới');
    expect(findDupTerms(cards, all, null)).toEqual([]);
    expect(all).toEqual(before);
    expect(findDupTerms([], all, null)).toEqual([]);
    expect(findDupTerms(null, all, null)).toEqual([]);
  });
  it('dropDupTerms: bỏ các thẻ trùng ra khỏi danh sách đang soạn (nút "bỏ từ trùng"), giữ thứ tự thẻ còn lại', () => {
    const cards = cardsOfTerms('To Reduce.', 'banana', 'reduce', 'cherry', 'APPLE');
    const dups = findDupTerms(cards, decks(), null);
    expect(dropDupTerms(cards, dups).map((c) => c.term)).toEqual(['banana', 'cherry']);
    expect(dropDupTerms(cards, [])).toEqual(cards);
    expect(cards.length).toBe(5);
  });
});

describe('parseCards: nhận cả Tab (Quizlet xuất ra dùng Tab) — Khang 15/11', () => {
  const TAB = '\t';
  it('dòng "từ<Tab>nghĩa" là một thẻ', () => {
    expect(parseCards(`reduce${TAB}giảm\ngovernment${TAB}chính phủ`)).toEqual({
      cards: [
        { term: 'reduce', def: 'giảm' },
        { term: 'government', def: 'chính phủ' },
      ],
      bad: 0,
      badLines: [],
    });
  });
  it('dòng có Tab thì tách ở Tab ĐẦU TIÊN, dấu : trong từ hoặc nghĩa được giữ nguyên', () => {
    expect(parseCards(`ratio 3:1${TAB}tỉ lệ: ba trên một`).cards).toEqual([{ term: 'ratio 3:1', def: 'tỉ lệ: ba trên một' }]);
    expect(parseCards(`a${TAB}b${TAB}c`).cards).toEqual([{ term: 'a', def: `b${TAB}c` }]);
  });
  it('trộn hai kiểu trong cùng một lần dán: mỗi dòng tự xét', () => {
    const r = parseCards(`reduce: giảm\r\napple${TAB}quả táo\r\n\r\n  even :  thậm chí, ngay cả  \r\n  lead to ${TAB}  dẫn đến  `);
    expect(r.cards).toEqual([
      { term: 'reduce', def: 'giảm' },
      { term: 'apple', def: 'quả táo' },
      { term: 'even', def: 'thậm chí, ngay cả' },
      { term: 'lead to', def: 'dẫn đến' },
    ]);
    expect(r.bad).toBe(0);
  });
  it('dòng lỗi kiểu Tab: thiếu từ hoặc thiếu nghĩa', () => {
    const r = parseCards(`${TAB}thiếu từ\nok${TAB}được\nx${TAB}   `);
    expect(r.cards).toEqual([{ term: 'ok', def: 'được' }]);
    expect(r.bad).toBe(1 + 1);
    // "x<Tab>   " cắt hai đầu xong chỉ còn "x": không có dấu tách
    expect(r.badLines).toEqual(['thiếu từ', 'x']);
  });
  it('Tab chỉ nằm ở đầu hoặc cuối dòng (thụt lề) thì không tính là dấu tách: vẫn tách ở dấu :', () => {
    expect(parseCards(`${TAB}reduce: giảm${TAB}`).cards).toEqual([{ term: 'reduce', def: 'giảm' }]);
  });
});
