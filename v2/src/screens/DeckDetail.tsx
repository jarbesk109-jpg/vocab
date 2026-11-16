import { knownDir } from '../../../logic/index.js';
import type { StoreState } from '../data/useStore';
import { hrefOf, studyHref } from '../router';
import { DeckProgress } from './Decks';

type Dir = 'prod' | 'recog';

/** Trạng thái một chiều của một thẻ: chưa học / đang học (kèm số lần đúng, sai) / thuộc (2 lần đúng liên tiếp). */
function dirState(card: any, dir: Dir): { kind: 'none' | 'learning' | 'known'; text: string } {
  const st = card.st;
  const s = st && typeof st.r !== 'number' ? st[dir] : null; // st kiểu cũ một chiều: coi như chưa có hồ sơ
  if (!s || (!s.r && !s.w)) return { kind: 'none', text: 'chưa học' };
  if (knownDir(card, dir)) return { kind: 'known', text: 'thuộc' };
  return { kind: 'learning', text: `đang học · ${s.r || 0} đúng, ${s.w || 0} sai` };
}

function DirChip({ card, dir }: { card: any; dir: Dir }) {
  const s = dirState(card, dir);
  return (
    <span className="dir-chip" data-kind={s.kind}>
      <span className="dir-chip-dir">{dir === 'prod' ? 'Việt → Anh' : 'Anh → Việt'}</span>
      {s.kind === 'known' && <span aria-hidden="true">✓ </span>}
      {s.text}
    </span>
  );
}

/** Màn chi tiết một học phần (task 2.12b): tiến độ + danh sách thẻ kèm trạng thái từng chiều và sao. */
export function DeckDetail({ deckId, state, today }: { deckId: string; state: StoreState; today: string }) {
  const deck: any = state.decks.find((d: any) => d.id === deckId);
  if (!deck) {
    return (
      <div className="card empty">
        <strong>Không tìm thấy học phần này</strong>
        <span>
          Có thể học phần đã bị xoá. <a href={hrefOf('decks')}>Về Học phần</a>
        </span>
      </div>
    );
  }
  const cards: any[] = deck.cards || [];
  const kpi: number = state.meta.settings?.kpi ?? 90;
  const starred = cards.filter((c) => c.starred).length;

  return (
    <div className="deck-detail">
      <a className="study-exit" href={hrefOf('decks')}>
        ← Học phần
      </a>
      <section className="card deck-card" aria-label="Tiến độ">
        <DeckProgress deck={deck} today={today} kpi={kpi} dates />
        <div className="deck-card-actions">
          <a className="btn btn-primary" href={studyHref(deck.id)}>
            Học
          </a>
        </div>
      </section>

      <section className="card deck-cards" aria-label="Danh sách thẻ">
        <h2 className="section-title">
          {cards.length} thẻ{starred ? ` · ${starred} thẻ có sao` : ''}
        </h2>
        {cards.length === 0 ? (
          <p className="muted">Học phần chưa có thẻ nào.</p>
        ) : (
          <ul>
            {cards.map((c) => (
              <li key={c.id}>
                <div className="card-pair">
                  <strong lang="en">
                    {c.starred && (
                      <span className="card-star" role="img" aria-label="Có sao">
                        ★{' '}
                      </span>
                    )}
                    {c.term}
                  </strong>
                  <span className="muted">{c.def}</span>
                </div>
                <div className="card-dirs">
                  <DirChip card={c} dir="prod" />
                  <DirChip card={c} dir="recog" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
