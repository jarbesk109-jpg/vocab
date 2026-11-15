-- Recall (v2): bảng, RLS và hàm save_state. PLAN.md mục 3.9.
-- Chạy MỘT lần trong Supabase Dashboard → SQL Editor. Chạy lại cũng an toàn: không xoá bảng, không xoá dữ liệu.
-- Không đụng tới bảng vocab_sync của v1 (khoá ở task 2.17).

-- ---------------------------------------------------------------------------
-- 1. Bảng
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,                 -- nguyên đối tượng deck
  rev integer not null default 1,
  deleted_at timestamptz,              -- xoá mềm
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.meta (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,                 -- settings, activity, streak, deckOrder, applied…
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.snapshots (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id bigint generated always as identity,
  reason text not null,                -- 'weekly' | 'before-import' | 'before-reset'
  data jsonb not null,                 -- toàn bộ dữ liệu ở dạng v1 (toV1)
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- 2. RLS: mỗi người chỉ đọc/ghi dòng của chính mình; chưa đăng nhập thì không thấy gì
-- ---------------------------------------------------------------------------
alter table public.decks     enable row level security;
alter table public.meta      enable row level security;
alter table public.snapshots enable row level security;

drop policy if exists decks_own     on public.decks;
drop policy if exists meta_own      on public.meta;
drop policy if exists snapshots_own on public.snapshots;

create policy decks_own on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy meta_own on public.meta for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy snapshots_own on public.snapshots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Quyền trên bảng cho người đã đăng nhập (RLS ở trên mới là lớp chặn theo từng dòng).
grant select, insert, update, delete on public.decks, public.meta, public.snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- 3. save_state: ghi meta + nhiều deck một lúc, chỉ thành công khi không ai ghi chen (so rev)
-- ---------------------------------------------------------------------------
-- p_meta_rev: rev của meta mà máy đang biết (0 = chưa có dòng meta).
-- p_decks: mảng [{ "id": "...", "rev": <rev đang biết, 0 = deck mới>, "data": {...}, "deleted": true|false }]
-- Thân hàm là một transaction: có REV_CONFLICT thì KHÔNG dòng nào được ghi.
-- Khác bản nháp trong PLAN.md ở một điểm: dòng mới (rev 0) mà đã tồn tại thì cũng báo REV_CONFLICT
-- (thay vì lỗi trùng khoá), để máy biết phải tải lại rồi áp lại.
create or replace function public.save_state(p_meta jsonb, p_meta_rev integer, p_decks jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  d jsonb;
  n integer;
begin
  if p_meta_rev = 0 then
    insert into public.meta (user_id, data, rev) values (auth.uid(), p_meta, 1)
      on conflict (user_id) do nothing;
  else
    update public.meta set data = p_meta, rev = rev + 1, updated_at = now()
      where user_id = auth.uid() and rev = p_meta_rev;
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'REV_CONFLICT meta'; end if;

  for d in select value from jsonb_array_elements(coalesce(p_decks, '[]'::jsonb)) loop
    if (d->>'rev')::integer = 0 then
      insert into public.decks (user_id, id, data, rev) values (auth.uid(), d->>'id', d->'data', 1)
        on conflict (user_id, id) do nothing;
    else
      update public.decks
        set data = d->'data', rev = rev + 1, updated_at = now(),
            deleted_at = case when coalesce((d->>'deleted')::boolean, false) then now() else null end
        where user_id = auth.uid() and id = d->>'id' and rev = (d->>'rev')::integer;
    end if;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'REV_CONFLICT deck %', d->>'id'; end if;
  end loop;
end $$;

revoke execute on function public.save_state(jsonb, integer, jsonb) from public, anon;
grant  execute on function public.save_state(jsonb, integer, jsonb) to authenticated;
