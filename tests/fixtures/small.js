// Dữ liệu GIẢ nhỏ cho test (file này có commit; dữ liệu thật thì không).
// Mọi hàm trả về đối tượng mới, cùng hình dạng với dữ liệu v1 (localStorage `vocabvip.v1`).

/** Thống kê một chiều của thẻ. */
export function mkDir(over = {}) {
  return { r: 0, w: 0, streak: 0, typo: 0, last: null, ...over };
}

/**
 * Một thẻ. `over.prod` / `over.recog` ghi đè thống kê từng chiều.
 * @param {string} id
 */
export function mkCard(id, over = {}) {
  const { prod, recog, ...rest } = over;
  return {
    id,
    term: 'term-' + id,
    def: 'nghĩa-' + id,
    note: '',
    starred: false,
    st: { prod: mkDir(prod), recog: mkDir(recog) },
    ...rest,
  };
}

/**
 * Một deck. `over.n` = số thẻ chưa học tự sinh (mặc định 3); `over.cards` thì dùng luôn.
 * @param {string} name
 */
export function mkDeck(name, over = {}) {
  const { n = 3, cards, ...rest } = over;
  return {
    id: 'id-' + name,
    name,
    projectId: 'p1',
    createdAt: '2026-01-01',
    anchor: '2026-01-01',
    stageIdx: 0,
    lastCompleted: null,
    history: [],
    cards: cards ?? Array.from({ length: n }, (_, i) => mkCard(name + '-' + (i + 1))),
    ...rest,
  };
}

/** Deck đã từng học: mọi thẻ đúng 1 lần mỗi chiều vào ngày `day`. */
export function mkStudiedDeck(name, day, over = {}) {
  const { n = 3, ...rest } = over;
  const cards = Array.from({ length: n }, (_, i) =>
    mkCard(name + '-' + (i + 1), {
      prod: { r: 1, streak: 1, last: day },
      recog: { r: 1, streak: 1, last: day },
    }),
  );
  return mkDeck(name, { cards, lastCompleted: day, history: [{ date: day, pct: 100 }], ...rest });
}

/** Cả một bản dữ liệu v1. */
export function mkState(sets = [], over = {}) {
  return {
    projects: [{ id: 'p1', name: 'Test' }],
    currentProj: 'p1',
    settings: { kpi: 90, testN: 20 },
    activity: {},
    paragraphs: [],
    sets,
    ...over,
  };
}
