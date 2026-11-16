import { useMemo, type ReactNode } from 'react';
import { FREEZE_EVERY, FREEZE_MAX, computeStreak, paceInfo, planToday } from '../../../logic/index.js';
import { Flame } from '../components/Flame';
import type { StoreState } from '../data/useStore';
import { hrefOf, studyHref } from '../router';

/** Phiên học dang dở, lưu theo máy (màn Học ở task 2.10 ghi vào đây): `{ deckId, mode, state }`. */
export const SESSION_KEY = 'recall.session.v1';

type Item = { set: any; status: any; wasNew?: boolean };

function readResume(): { deckId: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return v && typeof v.deckId === 'string' ? v : null;
  } catch {
    return null;
  }
}

/** Nhãn ngắn của một deck trong danh sách: HỌC MỚI / HỌC TIẾP / ÔN +N, kèm "trễ Nd". */
function tagOf(status: any): { text: string; kind: 'new' | 'rev' | 'late' } {
  if (status.kind === 'stock') return { text: 'HỌC MỚI', kind: 'new' };
  const late = status.late ? ` · trễ ${status.late}d` : '';
  if (status.stage === 0) return { text: 'HỌC TIẾP' + late, kind: status.late ? 'late' : 'new' };
  return { text: `ÔN +${status.stage}${late}`, kind: status.late ? 'late' : 'rev' };
}

/** Deck mới (kể cả học dở) đi qua Học; deck ôn đi qua Kiểm tra đủ thẻ × 2 chiều (mục 3.3). */
function isNew(item: Item): boolean {
  return item.status.kind === 'stock' || item.status.stage === 0;
}

/** Số thẻ chưa đúng lần nào hôm nay (deck mới học dở: phần còn lại để xong Ngày 1). */
export function leftToday(set: any, today: string): number {
  return (set.cards || []).filter(
    (c: any) => !['prod', 'recog'].some((k) => c.st?.[k]?.last === today && c.st[k].streak >= 1),
  ).length;
}

/** "Kiểm tra · 50 câu" hoặc "Học · 25 thẻ" / "Học · còn 18/25 thẻ". */
function workText(item: Item, today: string): string {
  const n = (item.set.cards || []).length;
  if (!isNew(item)) return `Kiểm tra · ${n * 2} câu`;
  const left = item.status.kind === 'stock' ? n : leftToday(item.set, today);
  return left < n ? `Học · còn ${left}/${n} thẻ` : `Học · ${n} thẻ`;
}

function gateText(gate: { reason: string; lateCount: number }): string | null {
  switch (gate.reason) {
    case 'late':
      return `Deck mới tạm dừng: còn ${gate.lateCount} deck trễ.`;
    case 'valve':
      return `Deck mới tạm dừng: đang có ${gate.lateCount} deck trễ (hơn 4).`;
    case 'ceiling':
      return 'Đã quá 3 ngày chưa có deck mới nên mở 1 deck mới dù còn bài ôn.';
    case 'doneNew':
      return 'Hôm nay đã học 1 deck mới.';
    case 'emptyStock':
      return 'Kho deck mới đã hết, tạo deck mới để mai có từ học.';
    default:
      return null; // 'full', 'onTrack': không cần giải thích
  }
}

const vn = (n: number) => String(n).replace('.', ',');

function paceText(p: { pace: number | null; everyDays: number | null; everyDaysPlus1: number | null }): string {
  if (p.pace === null) return 'Chưa đủ dữ liệu để tính nhịp (cần 3 ngày).';
  const now = p.everyDays ? `từ mới cứ ${p.everyDays} ngày một lần` : 'chưa có lượt nào trong 7 ngày qua';
  return `Nhịp hiện tại ${vn(p.pace)} lượt/ngày → ${now}. Làm thêm 1 lượt/ngày → ${p.everyDaysPlus1} ngày một lần.`;
}

function Tag({ status }: { status: any }) {
  const t = tagOf(status);
  return (
    <span className="tag" data-kind={t.kind}>
      {t.text}
    </span>
  );
}

/** Một dòng deck còn phải làm (hoặc "học thêm"). Cả dòng là một đường dẫn vào màn học. */
function DeckRow({ item, today, action }: { item: Item; today: string; action: string }) {
  return (
    <li>
      <a className="today-row" href={studyHref(item.set.id)}>
        <span className="today-row-main">
          <span className="today-row-title">
            <span className="deck-name">{item.set.name}</span>
            <Tag status={item.status} />
          </span>
          <span className="muted">{workText(item, today)}</span>
        </span>
        <span className="today-row-go">{action}</span>
      </a>
    </li>
  );
}

function Fold({ title, items, today }: { title: string; items: Item[]; today: string }) {
  if (!items.length) return null;
  return (
    <details className="card fold">
      <summary>
        {title} ({items.length})
      </summary>
      <ul className="today-list">
        {items.map((x) => (
          <DeckRow key={x.set.id} item={x} today={today} action="Học thêm" />
        ))}
      </ul>
    </details>
  );
}

/** Màn Hôm nay (task 2.9): streak, MỘT nút chính, các deck còn lại của hôm nay, cổng deck mới, nhịp học. */
type TodayProps = { state: StoreState; today: string; send: (cmd: Record<string, unknown>) => unknown };

export function Today({ state, today, send }: TodayProps) {
  const plan = useMemo(() => planToday(state.decks, today), [state.decks, today]);
  const streak = useMemo(
    () => computeStreak(state.meta.activity || {}, state.meta.streak?.freezeUsedDays ?? [], today),
    [state.meta, today],
  );
  const pace = useMemo(() => paceInfo(state.meta.activity || {}, today), [state.meta, today]);

  // Hôm nay: tối đa 3 ôn + 1 mới (hoặc 4 ôn). Deck đáng làm nhất đứng đầu và có nút chính.
  const todo: Item[] = [...plan.reviews, ...(plan.fresh ? [plan.fresh] : [])];
  const [primary, ...rest] = todo;
  const done: Item[] = plan.done;

  const resume = readResume();
  const resumeDeck = resume ? state.decks.find((d: any) => d.id === resume.deckId) : null;

  const freezeUsedToday = (state.meta.streak?.freezeUsedDays ?? []).includes(today);
  let statusLine: ReactNode;
  if (streak.status === 'safe') statusLine = 'Hôm nay đã tính.';
  else if (streak.status === 'pending') statusLine = `Còn thiếu ${streak.needUnits} lượt để tính hôm nay.`;
  else if (freezeUsedToday && streak.freezes > 0) statusLine = `Đã dùng băng: cần ${streak.needUnits} lượt hôm nay.`;
  else statusLine = `Streak đang nguy: hôm qua lỡ. Hôm nay còn thiếu ${streak.needUnits} lượt (thiếu deck thì 20 câu thay 1 lượt).`;

  const gate = gateText(plan.gate);
  const canFreeze = streak.status === 'atRisk' && streak.freezes > 0 && !freezeUsedToday;
  const toNext = FREEZE_EVERY - (streak.count % FREEZE_EVERY);
  const freezeLine =
    streak.freezes >= FREEZE_MAX
      ? `Đang giữ ${streak.freezes} băng giữ lửa (tối đa ${FREEZE_MAX}).`
      : `Chưa có băng giữ lửa · còn ${toNext} ngày liên tiếp nữa thì nhận băng.`;

  return (
    <div className="today">
      <section className="card streak" data-status={streak.status} aria-label="Streak">
        <Flame lit={streak.status === 'safe'} />
        <div className="streak-body">
          <p className="streak-count">
            <strong>{streak.count}</strong> ngày liên tiếp
          </p>
          <p className="streak-status">{statusLine}</p>
          <p className="streak-freeze">{freezeLine}</p>
          {canFreeze && (
            <button className="btn streak-use" type="button" onClick={() => send({ type: 'useFreeze' })}>
              Dùng băng
            </button>
          )}
        </div>
      </section>

      {resumeDeck && (
        <a className="card resume" href={studyHref(resumeDeck.id)}>
          <span>
            <strong>Học tiếp</strong>
            <span className="muted">Phiên đang dở: {resumeDeck.name}</span>
          </span>
          <span className="today-row-go">Tiếp tục</span>
        </a>
      )}

      {state.decks.length === 0 ? (
        <div className="card empty">
          <strong>Chưa có học phần nào</strong>
          <span>
            <a href={hrefOf('deckNew')}>Tạo học phần đầu tiên</a> để bắt đầu.
          </span>
        </div>
      ) : primary ? (
        <section className="card primary" aria-label="Việc đầu tiên hôm nay">
          <div className="primary-head">
            <Tag status={primary.status} />
            <h2 className="primary-name">{primary.set.name}</h2>
            <p className="muted">{workText(primary, today)}</p>
          </div>
          <a className="btn btn-primary btn-lg" href={studyHref(primary.set.id)}>
            Bắt đầu
          </a>
        </section>
      ) : (
        <div className="card empty">
          <strong>{done.length ? 'Hôm nay xong rồi' : 'Hôm nay không có deck đến hạn'}</strong>
          <span>
            {done.length
              ? 'Mọi deck của hôm nay đã xong. Muốn học thêm thì mở các mục bên dưới.'
              : 'Không có deck nào đến hạn. Làm 20 câu bất kỳ để giữ streak, hoặc học thêm ở các mục bên dưới.'}
          </span>
        </div>
      )}

      {(rest.length > 0 || done.length > 0) && (
        <section className="card today-card" aria-label="Các deck còn lại của hôm nay">
          <ul className="today-list">
            {rest.map((x) => (
              <DeckRow key={x.set.id} item={x} today={today} action="Bắt đầu" />
            ))}
            {done.map((x) => (
              <li key={x.set.id}>
                <div className="today-row" data-done="">
                  <span className="today-row-main">
                    <span className="today-row-title">
                      <span className="deck-name">{x.set.name}</span>
                      <span className="tag" data-kind="ok">
                        ✓ xong hôm nay
                      </span>
                    </span>
                    <span className="muted">{x.wasNew ? 'Xong Ngày 1' : 'Đã ôn'}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.decks.length > 0 && (
        <div className="today-notes">
          {gate && <p>{gate}</p>}
          <p>{paceText(pace)}</p>
        </div>
      )}

      <Fold title="Đang chờ thêm" items={plan.more} today={today} />
      <Fold title="Kho deck mới" items={plan.stock} today={today} />
    </div>
  );
}
