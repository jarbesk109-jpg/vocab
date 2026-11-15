import { supabase } from '../supabase';

/** Một dòng deck theo hình dạng mà `logic/store.js` dùng. */
export type DeckRow = { id: string; data: any; rev: number; deleted: boolean };
/** Bản server: `metaRev 0` = tài khoản chưa có dữ liệu. */
export type ServerState = { meta: any; metaRev: number; decks: DeckRow[] };

/** PostgREST trả tối đa bấy nhiêu dòng mỗi lần đọc; đọc theo trang để không bao giờ thiếu deck. */
const PAGE = 500;

/** Lỗi mà store hiểu là "rev lệch, tải lại rồi áp lại". Mọi lỗi khác store coi là lỗi mạng. */
function revConflict(message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code: 'REV_CONFLICT' });
}

/**
 * Id của người đang đăng nhập. KHÔNG có phiên thì ném lỗi: nếu cứ đọc tiếp, RLS trả về 0 dòng
 * và app sẽ tưởng tài khoản trống (rồi mời chuyển dữ liệu lại).
 */
async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const id = data.session?.user.id;
  if (!id) throw new Error('NO_SESSION');
  return id;
}

/** Backend Supabase cho `createStore` (PLAN.md mục 3.9, ghi chú task 2.5). */
export const supabaseBackend = {
  /** Đọc hai bảng. Trả CẢ deck đã xoá mềm (`deleted: true`). */
  async load(): Promise<ServerState> {
    const uid = await userId();
    const meta = await supabase.from('meta').select('data, rev').eq('user_id', uid).maybeSingle();
    if (meta.error) throw meta.error;

    const decks: DeckRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = await supabase
        .from('decks')
        .select('id, data, rev, deleted_at')
        .eq('user_id', uid)
        .order('id')
        .range(from, from + PAGE - 1);
      if (page.error) throw page.error;
      for (const r of page.data) decks.push({ id: r.id, data: r.data, rev: r.rev, deleted: r.deleted_at !== null });
      if (page.data.length < PAGE) break;
    }

    return meta.data ? { meta: meta.data.data, metaRev: meta.data.rev, decks } : { meta: null, metaRev: 0, decks };
  },

  /** Ghi meta + các deck đổi trong MỘT transaction; rev lệch thì không dòng nào được ghi. */
  async save(meta: any, metaRev: number, rows: DeckRow[]): Promise<void> {
    await userId();
    const { error } = await supabase.rpc('save_state', {
      p_meta: meta,
      p_meta_rev: metaRev,
      p_decks: rows.map((r) => ({ id: r.id, rev: r.rev, data: r.data, deleted: !!r.deleted })),
    });
    if (!error) return;
    if ((error.message || '').includes('REV_CONFLICT')) throw revConflict(error.message);
    throw error;
  },

  /** Ghi một bản sao toàn bộ dữ liệu (dạng v1) trước thao tác thay thế. */
  async snapshot(reason: string, data: any): Promise<void> {
    await userId();
    const { error } = await supabase.from('snapshots').insert({ reason, data });
    if (error) throw error;
  },
};
