import { useEffect, useRef } from 'react';
import { Flame } from './Flame';

type Props = { count: number; freezeEarned: boolean; onClose: () => void };

/** Màn chúc mừng lớn giữa màn hình ở các mốc streak 10, 50, 100, 200, 300… Đóng bằng nút, Enter, Esc hoặc bấm ra ngoài. */
export function Celebration({ count, freezeEarned, onClose }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Chỗ sẽ nhận lại focus khi đóng: nơi đang focus lúc mở, hoặc nơi vừa đòi focus trong lúc đang mở
    // (màn kết quả hiện ra bên dưới cùng lúc và muốn focus nút "Về Hôm nay").
    let back = document.activeElement as HTMLElement | null;
    btn.current?.focus();
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (card.current && !card.current.contains(t)) {
        back = t;
        btn.current?.focus(); // giữ focus trong màn chúc mừng
      }
    };
    document.addEventListener('focusin', onFocus);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key !== 'Enter' && e.key !== 'Tab') {
        e.stopPropagation(); // phím tắt của màn học bên dưới không chạy khi màn chúc mừng đang mở
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      // trả focus về chỗ cũ (ô đáp án đang gõ dở); chỗ cũ không còn thì về nút chính của màn bên dưới
      (back && back.isConnected ? back : document.querySelector<HTMLElement>('[data-autofocus]'))?.focus();
    };
  }, [onClose]);

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" onClick={onClose}>
      <div ref={card} className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-flame">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} aria-hidden="true" />
          ))}
          <Flame lit burst />
        </div>
        <p className="celebrate-count">{count}</p>
        <h2 id="celebrate-title" className="celebrate-title">
          ngày liên tiếp
        </h2>
        <p className="muted">
          Bạn đã học {count} ngày liền, không bỏ ngày nào.
          {freezeEarned && ' Nhận thêm 1 băng giữ lửa.'}
        </p>
        <button ref={btn} className="btn btn-primary btn-lg" type="button" onClick={onClose}>
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
