import { useEffect } from 'react';

/** Ngọn lửa streak. `lit`: hôm nay đã tính (cam); `burst`: bùng lên một lần (khi số streak vừa tăng). */
export function Flame({ lit, burst }: { lit: boolean; burst?: boolean }) {
  return (
    <svg className="flame" data-lit={lit ? '' : undefined} data-burst={burst ? '' : undefined} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.4 2.2c.5 3.2-1 5-2.6 6.7C8 10.8 6 12.8 6 15.8A6.1 6.1 0 0 0 12 22a6.1 6.1 0 0 0 6-6.2c0-2.3-1-4.2-2.3-5.7-.3 1.5-1 2.5-2 3.1.5-3.7-.3-7.8-1.3-11Z" />
    </svg>
  );
}

const TOAST_MS = 2600;

type ToastProps = { count: number; freezeEarned: boolean; onDone: () => void };

/**
 * Lửa bùng khi số streak tăng (từ streak 3): một nhãn nổi giữa đầu màn, tự tắt, không chiếm chỗ
 * và không lấy focus, nên hiện được cả lúc đang làm bài.
 */
export function FlameToast({ count, freezeEarned, onDone }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="flame-toast" role="status">
      <Flame lit burst />
      <span>
        <strong>{count} ngày liên tiếp</strong>
        {freezeEarned && <span className="flame-toast-sub">Nhận 1 băng giữ lửa</span>}
      </span>
    </div>
  );
}
