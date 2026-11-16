import { deckProgress } from '../../../logic/index.js';
import type { StoreState } from '../data/useStore';
import { deckHref, hrefOf, studyHref } from '../router';

const STAGE_LABELS = ['Mới', '+1', '+3', '+7', '+16'];

/** '2026-11-15' → '15/11'. */
export function shortDay(day: string): string {
  const [, m, d] = String(day).split('-');
  return `${Number(d)}/${Number(m)}`;
}

/** Nhãn trạng thái ngắn của deck trên màn Học phần. */
function statusTag(status: any): { text: string; kind: 'new' | 'rev' | 'late' | 'ok' | undefined } {
  if (status.kind === 'stock') return { text: 'CHƯA HỌC', kind: undefined };
  if (status.kind === 'graduated') return { text: 'XONG VÒNG', kind: 'ok' };
  if (status.kind === 'scheduled') return { text: `HẸN ${shortDay(status.due)}`, kind: 'rev' };
  const late = status.late ? ` · trễ ${status.late}d` : '';
  if (status.stage === 0) return { text: 'HỌC TIẾP' + late, kind: status.late ? 'late' : 'new' };
  return { text: `ÔN +${status.stage}${late}`, kind: status.late ? 'late' : 'rev' };
}

/** "Lần ôn kế: …" bằng chữ. */
function nextText(status: any): string {
  if (status.kind === 'stock') return 'Chưa bắt đầu học.';
  if (status.kind === 'graduated') return 'Đã xong cả vòng ôn, không còn lần ôn kế.';
  if (status.kind === 'scheduled') return `Lần ôn kế: ${shortDay(status.due)} (còn ${status.days} ngày).`;
  if (status.stage === 0) return 'Chưa xong Ngày 1: học hết các thẻ để bắt đầu lịch ôn.';
  return status.late ? `Lần ôn kế: đã đến hạn, trễ ${status.late} ngày.` : 'Lần ôn kế: hôm nay.';
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="dp-bar">
      <span className="dp-bar-label">{label}</span>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Thuộc chiều ${label}`}>
        <div className="progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="dp-bar-pct">{pct}%</span>
    </div>
  );
}

/** Khối tiến độ của một deck: hai thanh theo chiều, Viết, Kiểm tra, dải 5 mốc, lần ôn kế. `dates`: ghi ngày qua từng mốc. */
export function DeckProgress({ deck, today, kpi, dates = false }: { deck: any; today: string; kpi: number; dates?: boolean }) {
  const p = deckProgress(deck, today, kpi);
  const passedCount = p.stagesPassed.filter((s) => s.passed).length;
  return (
    <div className="dp">
      <div className="dp-bars">
        <Bar label="Việt → Anh" pct={p.prodPct} />
        <Bar label="Anh → Việt" pct={p.recogPct} />
      </div>
      <dl className="dp-facts">
        <div>
          <dt>Viết</dt>
          <dd>{p.lastWrite ? `${p.lastWrite.pct}% (${shortDay(p.lastWrite.date)})` : 'chưa làm'}</dd>
        </div>
        <div>
          <dt>Kiểm tra</dt>
          <dd>
            {p.lastTest && p.bestTest
              ? `gần nhất ${p.lastTest.pct}% (${shortDay(p.lastTest.date)}) · cao nhất ${p.bestTest.pct}%`
              : 'chưa làm'}
          </dd>
        </div>
      </dl>
      <ol className="dp-stages" aria-label={`Đã qua ${passedCount}/5 mốc`}>
        {p.stagesPassed.map((s, i) => (
          <li key={i} data-passed={s.passed ? '' : undefined} data-current={!s.passed && i === p.stageIdx ? '' : undefined}>
            <span className="dp-stage-name">
              {s.passed && <span aria-hidden="true">✓ </span>}
              {STAGE_LABELS[i]}
            </span>
            {dates && <span className="dp-stage-date">{s.passed ? (s.date ? shortDay(s.date) : 'đã qua') : '—'}</span>}
          </li>
        ))}
      </ol>
      <p className="muted dp-next">{nextText(p.status)}</p>
    </div>
  );
}

/** Màn Học phần (task 2.12b): mỗi deck một thẻ tiến độ, có nút Học và đường vào màn chi tiết. */
export function Decks({ state, today }: { state: StoreState; today: string }) {
  const kpi: number = state.meta.settings?.kpi ?? 90;
  if (!state.decks.length) {
    return (
      <div className="card empty">
        <strong>Chưa có học phần nào</strong>
        <span>
          <a href={hrefOf('deckNew')}>Tạo học phần đầu tiên</a> để bắt đầu.
        </span>
      </div>
    );
  }
  return (
    <>
    <div className="decks-top">
      <a className="btn" href={hrefOf('deckNew')}>
        Tạo học phần
      </a>
    </div>
    <ul className="decks">
      {state.decks.map((d: any) => {
        const tag = statusTag(deckProgress(d, today, kpi).status);
        return (
          <li key={d.id} className="card deck-card">
            <div className="deck-card-head">
              <a className="deck-card-title" href={deckHref(d.id)}>
                <span className="deck-name">{d.name}</span>
                <span className="tag" data-kind={tag.kind}>
                  {tag.text}
                </span>
              </a>
              <span className="muted">{(d.cards || []).length} thẻ</span>
            </div>
            <DeckProgress deck={d} today={today} kpi={kpi} />
            <div className="deck-card-actions">
              <a className="btn btn-primary" href={studyHref(d.id)}>
                Học
              </a>
              <a className="btn" href={deckHref(d.id)}>
                Chi tiết
              </a>
            </div>
          </li>
        );
      })}
    </ul>
    </>
  );
}
