import { describe, it, expect } from 'vitest';
import { addDays, paceInfo } from '../logic/index.js';

const T = '2026-11-13';
/** Ngày kiểu mới có `k` lượt. */
const U = (k) => ({ n: 5 * k, by: {}, d: Array.from({ length: k }, (_, i) => 'deck' + i), a: k });
/** activity từ danh sách [số ngày trước hôm nay, số lượt]. */
const act = (pairs) => Object.fromEntries(pairs.map(([back, k]) => [addDays(T, -back), U(k)]));

describe('paceInfo (mục 3.5)', () => {
  it('pace 1.2 → từ mới cứ 4 ngày; thêm 1 lượt/ngày → 2 ngày', () => {
    // 5 ngày tính (từ T-5 tới T-1), tổng 6 lượt → 1,2
    expect(paceInfo(act([[5, 2], [4, 1], [3, 1], [2, 1], [1, 1]]), T)).toEqual({ pace: 1.2, everyDays: 4, everyDaysPlus1: 2 });
  });

  it('pace 5 → 1 và 1', () => {
    expect(paceInfo(act([[3, 5], [2, 5], [1, 5]]), T)).toEqual({ pace: 5, everyDays: 1, everyDaysPlus1: 1 });
  });

  it('dưới 3 ngày tính → null', () => {
    const none = { pace: null, everyDays: null, everyDaysPlus1: null };
    expect(paceInfo({}, T)).toEqual(none);
    expect(paceInfo(act([[2, 3], [1, 3]]), T)).toEqual(none);
    expect(paceInfo(act([[0, 3]]), T)).toEqual(none); // hôm nay không tính
  });

  it('ngày trống tính 0', () => {
    // bản ghi kiểu mới đầu tiên ở T-4 → 4 ngày tính, chỉ 2 ngày có lượt: (2 + 1) / 4 = 0,75 → 0,8
    expect(paceInfo(act([[4, 2], [1, 1]]), T)).toEqual({ pace: 0.8, everyDays: 6, everyDaysPlus1: 3 });
  });

  it('cửa sổ là 7 ngày ngay trước hôm nay, không gồm hôm nay', () => {
    // T-9 và T-8 nằm ngoài cửa sổ; hôm nay không tính → 7 ngày, 7 lượt
    const a = act([[9, 4], [8, 4], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 4]]);
    expect(paceInfo(a, T)).toEqual({ pace: 1, everyDays: 5, everyDaysPlus1: 3 });
  });

  it('chỉ tính từ ngày đầu tiên có bản ghi kiểu mới; ngày kiểu cũ không tính', () => {
    const a = { [addDays(T, -6)]: true, [addDays(T, -5)]: { n: 30 }, ...act([[2, 1], [1, 1]]) };
    expect(paceInfo(a, T).pace).toBe(null); // mới có 2 ngày kiểu mới
    const b = { [addDays(T, -6)]: true, ...act([[3, 2], [2, 2], [1, 2]]) };
    expect(paceInfo(b, T)).toEqual({ pace: 2, everyDays: 3, everyDaysPlus1: 2 });
  });

  it('đủ ngày nhưng không có lượt nào: pace 0, chưa biết bao lâu một deck mới', () => {
    const a = { [addDays(T, -5)]: { n: 3, by: { x: 3 }, d: [], a: 1 } };
    expect(paceInfo(a, T)).toEqual({ pace: 0, everyDays: null, everyDaysPlus1: 5 });
  });

  it('không sửa đầu vào', () => {
    const a = act([[3, 1], [2, 1], [1, 1]]);
    const before = structuredClone(a);
    paceInfo(a, T);
    expect(a).toEqual(before);
  });
});
