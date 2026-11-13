// Chuẩn hoá và tóm tắt dữ liệu (PLAN.md mục 3.9).
// `normalize` và `summarize` chuyển NGUYÊN VĂN từ v1 (bản vá 11/11); khác biệt duy nhất:
// "hôm nay" truyền vào qua tham số thay vì đọc giờ máy.

import { isDateStr } from './dates.js';

/** Id ngẫu nhiên 7 ký tự, giống `uid()` của v1. */
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * App trống thật: không nhúng deck nào ("Xoá sạch" phải ra SẠCH).
 * KPI mặc định 90 (PLAN.md mục 1). Mỗi lần gọi trả về một đối tượng mới.
 */
export function emptyState() {
  return {
    projects: [{ id: 'trl80kl', name: 'IELTS Vocab' }],
    sets: [],
    activity: {},
    settings: { kpi: 90, testN: 20 },
    currentProj: 'trl80kl',
    paragraphs: [],
  };
}

/**
 * Chuẩn hoá dữ liệu từ MỌI nguồn (localStorage, file backup, đám mây).
 * Chỉ ĐẮP phần còn thiếu, không đụng phần đã có → chạy lại bao nhiêu lần cũng ra cùng kết quả.
 * Giống v1: sửa thẳng vào `o` và trả lại chính nó trong `data`.
 * @param {any} o dữ liệu dạng v1
 * @param {string} today ngày học hiện tại 'YYYY-MM-DD' (dùng khi deck thiếu `anchor`)
 * @returns {{ data: any, fixes: string[] } | null} null khi không phải dữ liệu của app
 */
export function normalize(o, today) {
  const fixes = [];
  const d = emptyState();
  if (!o || typeof o !== 'object' || !Array.isArray(o.sets)) return null;
  if (!Array.isArray(o.projects) || !o.projects.length) {
    o.projects = d.projects;
    fixes.push('thiếu danh sách dự án');
  }
  if (!o.projects.some((p) => p && p.id === o.currentProj)) o.currentProj = o.projects[0].id;
  if (!o.settings || typeof o.settings !== 'object') {
    o.settings = {};
    fixes.push('thiếu cài đặt');
  }
  o.settings = { ...d.settings, ...o.settings };
  if (!o.activity || typeof o.activity !== 'object' || Array.isArray(o.activity)) o.activity = {};
  if (!Array.isArray(o.paragraphs)) o.paragraphs = [];
  const projIds = new Set(o.projects.map((p) => p.id));
  const setIds = new Set();
  let badSets = 0;
  o.sets = o.sets.filter((s) => {
    if (s && typeof s === 'object' && Array.isArray(s.cards)) return true;
    badSets++;
    return false;
  });
  if (badSets) fixes.push('bỏ ' + badSets + ' học phần hỏng (không có thẻ)');
  o.sets.forEach((s) => {
    if (!s.id || setIds.has(s.id)) {
      s.id = uid();
      fixes.push('đổi id trùng/thiếu của "' + (s.name || '?') + '"');
    }
    setIds.add(s.id);
    if (typeof s.name !== 'string' || !s.name) s.name = '(không tên)';
    if (!isDateStr(s.anchor)) {
      s.anchor = today;
      fixes.push('"' + s.name + '" thiếu ngày bắt đầu → đặt hôm nay');
    }
    if (typeof s.stageIdx !== 'number' || s.stageIdx < 0) s.stageIdx = 0;
    if (!Array.isArray(s.history)) s.history = [];
    if (!projIds.has(s.projectId)) s.projectId = o.currentProj;
    if (!isDateStr(s.createdAt)) s.createdAt = s.anchor;
    if (s.lastCompleted === undefined) s.lastCompleted = null;
    s.cards = s.cards.filter((c) => c && typeof c === 'object');
    s.cards.forEach((c) => {
      if (!c.id) c.id = uid();
      if (typeof c.term !== 'string') c.term = String(c.term ?? '');
      if (typeof c.def !== 'string') c.def = String(c.def ?? '');
      if (typeof c.note !== 'string') c.note = '';
      if (!c.st || typeof c.st !== 'object') c.st = {};
    });
  });
  return { data: o, fixes };
}

/**
 * Tóm tắt một bản dữ liệu để SO SÁNH độ mới: số thẻ, tổng lượt trả lời, ngày học gần nhất.
 * Số thẻ bằng nhau KHÔNG có nghĩa là cùng tiến độ: phải nhìn lượt trả lời + ngày học.
 * @param {any} o dữ liệu dạng v1
 * @returns {{ sets: number, cards: number, answers: number, last: string }} `last` rỗng khi chưa học
 */
export function summarize(o) {
  let cards = 0;
  let answers = 0;
  let last = '';
  const bump = (x) => {
    if (isDateStr(x) && x > last) last = x;
  };
  (o.sets || []).forEach((s) => {
    (s.history || []).forEach((h) => bump(h && h.date));
    bump(s.lastCompleted);
    (s.cards || []).forEach((c) => {
      cards++;
      ['prod', 'recog'].forEach((k) => {
        const x = c && c.st && c.st[k];
        if (x) {
          answers += (x.r || 0) + (x.w || 0);
          bump(x.last);
        }
      });
    });
  });
  Object.keys(o.activity || {}).forEach(bump);
  return { sets: (o.sets || []).length, cards, answers, last };
}
