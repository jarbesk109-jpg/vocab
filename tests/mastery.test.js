import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cardKnown, deckMastery, deckProgress, isMastered, knownDir } from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck } from './fixtures/small.js';

const T = '2026-11-15';
const FIXTURE_NAME = 'kingston-vocab-backup-2026-11-11.json';
const FIXTURE = fileURLToPath(new URL('./fixtures/' + FIXTURE_NAME, import.meta.url));
const hasFixture = existsSync(FIXTURE);
if (!hasFixture && !process.env.CI) {
  throw new Error(`Thiếu file dữ liệu thật. Chép "${FIXTURE_NAME}" vào tests/fixtures/ rồi chạy lại "npm test".`);
}

/** Thẻ với streak từng chiều. */
const c = (id, prod, recog) => mkCard(id, { prod: { streak: prod }, recog: { streak: recog } });

describe('thuộc (mục 3.7, chuyển nguyên văn từ v1)', () => {
  it('knownDir: thuộc một chiều = 2 lần đúng liên tiếp', () => {
    expect(knownDir(c('a', 2, 0), 'prod')).toBe(true);
    expect(knownDir(c('a', 1, 5), 'prod')).toBe(false);
    expect(knownDir(c('a', 1, 5), 'recog')).toBe(true);
  });
  it('cardKnown: phải vững CẢ HAI chiều', () => {
    expect(cardKnown(c('a', 2, 2))).toBe(true);
    expect(cardKnown(c('a', 9, 1))).toBe(false);
    expect(cardKnown(c('a', 0, 3))).toBe(false);
  });
  it('thẻ thiếu st, thiếu chiều, hoặc st kiểu cũ một chiều: chưa thuộc, không sập, không sửa thẻ', () => {
    const bare = { id: 'x', term: 't', def: 'd' };
    expect(knownDir(bare, 'prod')).toBe(false);
    expect(bare).toEqual({ id: 'x', term: 't', def: 'd' });
    expect(cardKnown({ id: 'x', st: { prod: { streak: 3 } } })).toBe(false);
    expect(cardKnown({ id: 'x', st: { r: 9, streak: 9 } })).toBe(false);
  });
  it('deckMastery: số thẻ thuộc, % cả hai chiều, % từng chiều (làm tròn)', () => {
    const d = mkDeck('a', { cards: [c('1', 2, 2), c('2', 2, 0), c('3', 0, 0)] });
    expect(deckMastery(d)).toEqual({ done: 1, total: 3, pct: 33, prod: 67, recog: 33 });
    expect(deckMastery(mkDeck('b', { cards: [] }))).toEqual({ done: 0, total: 0, pct: 0, prod: 0, recog: 0 });
  });
  it('isMastered: mọi thẻ vững cả 2 chiều; deck rỗng không tính là thuộc', () => {
    expect(isMastered(mkDeck('a', { cards: [c('1', 2, 2), c('2', 3, 2)] }))).toBe(true);
    expect(isMastered(mkDeck('a', { cards: [c('1', 2, 2), c('2', 3, 1)] }))).toBe(false);
    expect(isMastered(mkDeck('a', { cards: [] }))).toBe(false);
  });
});

describe('deckProgress (mục 3.7, MỚI)', () => {
  it('deck kho chưa học: 0%, chưa có bài nào, chưa qua mốc nào', () => {
    const p = deckProgress(mkDeck('a', { n: 4 }), T);
    expect(p).toEqual({
      total: 4, known: 0, prodPct: 0, recogPct: 0,
      lastTest: null, bestTest: null, lastWrite: null,
      stagesPassed: Array(5).fill({ passed: false, date: null }),
      stageIdx: 0,
      status: { kind: 'stock' },
    });
  });
  it('% thuộc từng chiều và số thẻ thuộc cả hai chiều', () => {
    const d = mkDeck('a', { cards: [c('1', 2, 2), c('2', 2, 0), c('3', 2, 1), c('4', 0, 0)] });
    expect(deckProgress(d, T)).toMatchObject({ total: 4, known: 1, prodPct: 75, recogPct: 25 });
  });
  it('lastTest / bestTest: chỉ tính bài Kiểm tra (history không có mode là bài Kiểm tra cũ); lastWrite: bài Viết cuối', () => {
    const d = mkDeck('a', {
      history: [
        { date: '2026-11-01', pct: 95 }, // dữ liệu cũ, không có mode
        { date: '2026-11-02', pct: 100, mode: 'write' },
        { date: '2026-11-03', pct: 80, mode: 'test', stage: 1 },
        { date: '2026-11-04', pct: 60, mode: 'write' },
      ],
    });
    const p = deckProgress(d, T);
    expect(p.lastTest).toEqual({ date: '2026-11-03', pct: 80 });
    expect(p.bestTest).toEqual({ date: '2026-11-01', pct: 95 });
    expect(p.lastWrite).toEqual({ date: '2026-11-04', pct: 60 });
  });
  it('bestTest hoà điểm thì lấy lần gần nhất; chưa Viết lần nào thì lastWrite null', () => {
    const d = mkDeck('a', { history: [{ date: '2026-11-01', pct: 90 }, { date: '2026-11-05', pct: 90, mode: 'test' }] });
    expect(deckProgress(d, T)).toMatchObject({ bestTest: { date: '2026-11-05', pct: 90 }, lastWrite: null });
  });
  it('stagesPassed: mốc i đã qua khi stageIdx > i; ngày lấy từ startedAt (mốc Mới) và history có stage + đạt KPI', () => {
    const d = mkReviewDeck('a', 3, T, {
      startedAt: '2026-11-01',
      history: [
        { date: '2026-11-02', pct: 70, mode: 'test', stage: 1 }, // trượt: không phải ngày qua mốc
        { date: '2026-11-03', pct: 92, mode: 'test', stage: 1 },
        { date: '2026-11-06', pct: 100, mode: 'test', stage: 2 },
        { date: '2026-11-06', pct: 100, mode: 'write' },
      ],
    });
    const p = deckProgress(d, T);
    expect(p.stageIdx).toBe(3);
    expect(p.stagesPassed).toEqual([
      { passed: true, date: '2026-11-01' },
      { passed: true, date: '2026-11-03' },
      { passed: true, date: '2026-11-06' },
      { passed: false, date: null },
      { passed: false, date: null },
    ]);
    expect(p.status).toMatchObject({ kind: 'waiting', stage: 7, late: 0 });
  });
  it('KPI truyền vào quyết định bài nào là "đạt"; mặc định 90', () => {
    const d = mkReviewDeck('a', 2, T, { history: [{ date: '2026-11-03', pct: 85, mode: 'test', stage: 1 }] });
    expect(deckProgress(d, T).stagesPassed[1]).toEqual({ passed: true, date: null });
    expect(deckProgress(d, T, 80).stagesPassed[1]).toEqual({ passed: true, date: '2026-11-03' });
  });
  it('mốc Mới qua bằng Kiểm tra (không có startedAt): lấy ngày từ history stage 0; lùi mốc rồi qua lại thì lấy lần cuối', () => {
    const d = mkReviewDeck('a', 2, T, {
      history: [
        { date: '2026-11-01', pct: 95, mode: 'test', stage: 0 },
        { date: '2026-11-02', pct: 95, mode: 'test', stage: 1 },
        { date: '2026-11-09', pct: 50, mode: 'test', stage: 2 }, // phục hồi trượt → lùi về mốc 1
        { date: '2026-11-10', pct: 95, mode: 'test', stage: 1 },
      ],
    });
    const p = deckProgress(d, T);
    expect(p.stagesPassed[0]).toEqual({ passed: true, date: '2026-11-01' });
    expect(p.stagesPassed[1]).toEqual({ passed: true, date: '2026-11-10' });
  });
  it('dữ liệu cũ không ghi stage: đã qua nhưng ngày null; deck xong chu kỳ: đủ 5 mốc', () => {
    const d = mkReviewDeck('a', 4, T, { stageIdx: 5, history: [{ date: '2026-09-01', pct: 100 }] });
    const p = deckProgress(d, T);
    expect(p.stagesPassed).toEqual(Array(5).fill({ passed: true, date: null }));
    expect(p.status).toEqual({ kind: 'graduated' });
  });
  it('không sửa deck truyền vào', () => {
    const d = mkReviewDeck('a', 2, T, { cards: [{ id: 'x', term: 't', def: 'd' }, c('1', 2, 2)] });
    const before = structuredClone(d);
    deckProgress(d, T);
    expect(d).toEqual(before);
  });
});

describe.skipIf(!hasFixture)('deckProgress với file JSON thật', () => {
  const sets = () => JSON.parse(readFileSync(FIXTURE, 'utf8')).sets;
  const byName = (name) => sets().find((s) => s.name === name);

  it('1608: thuộc cả hai chiều 100%, đã qua Mới, +1, +3, +7 (chưa qua +16)', () => {
    const d = byName('1608');
    const p = deckProgress(d, '2026-11-13');
    expect(p).toMatchObject({ total: 19, known: 19, prodPct: 100, recogPct: 100, stageIdx: 4 });
    expect(isMastered(d)).toBe(true);
    expect(p.stagesPassed.map((s) => s.passed)).toEqual([true, true, true, true, false]);
    expect(p.stagesPassed.every((s) => s.date === null)).toBe(true); // dữ liệu cũ không ghi stage
    expect(p.lastTest).toEqual({ date: '2026-10-10', pct: 100 });
    expect(p.bestTest).toEqual({ date: '2026-10-10', pct: 100 });
    expect(p.lastWrite).toBe(null);
    expect(p.status.kind).toBe('waiting');
  });
  it('2208: 0% và chưa qua mốc nào', () => {
    const p = deckProgress(byName('2208'), '2026-11-13');
    expect(p).toMatchObject({ total: 25, known: 0, prodPct: 0, recogPct: 0, stageIdx: 0, lastTest: null, bestTest: null });
    expect(p.stagesPassed.map((s) => s.passed)).toEqual([false, false, false, false, false]);
    expect(p.status).toEqual({ kind: 'stock' });
  });
});
