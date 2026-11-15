/** Thanh tiến độ của phiên: `value` trong [0, 1], kèm nhãn ngắn kiểu "3/15". */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Tiến độ ${label}`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="progress-label">{label}</span>
    </div>
  );
}
