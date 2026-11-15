-- Tự kiểm RLS và save_state. Chạy trong SQL Editor SAU khi đã chạy schema.sql và đã tạo user.
-- An toàn với dữ liệu thật: mọi thay đổi thử nằm trong một khối được HUỶ ở cuối (không lưu gì).
-- Kết quả là một bảng: mỗi dòng một bước, cột ket_qua phải là 'đạt' ở MỌI dòng.

create or replace function pg_temp.recall_check()
returns table (buoc text, ket_qua text) language plpgsql as $$
declare
  u uuid;
  stranger uuid := gen_random_uuid();
  steps text[] := '{}';
  results text[] := '{}';
  r integer;
  m jsonb;
  n integer;
  del timestamptz;
  x jsonb;
  step text := 'chuẩn bị';
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then
    return query select 'chuẩn bị'::text, 'LỖI: chưa có user nào (tạo ở Authentication → Users trước)'::text;
    return;
  end if;

  begin
    -- đóng vai user thật đã đăng nhập
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u::text, true);
    set local role authenticated;

    step := '1. user đọc được meta của mình, save_state ghi được (deck mới rev 0)';
    select meta.rev, meta.data into r, m from public.meta;
    if not found then r := 0; m := '{}'::jsonb; end if;
    perform public.save_state(m, r, '[{"id":"__check__","rev":0,"data":{"n":1}}]'::jsonb);
    r := case when r = 0 then 1 else r + 1 end;
    select decks.rev into n from public.decks where id = '__check__';
    if n is distinct from 1 then raise exception 'deck mới phải có rev 1, đang là %', n; end if;
    select meta.rev into n from public.meta;
    if n is distinct from r then raise exception 'meta phải lên rev %, đang là %', r, n; end if;
    steps := steps || step; results := results || 'đạt'::text;

    step := '2. sửa deck với rev đúng: rev tăng, xoá mềm ghi deleted_at';
    perform public.save_state(m, r, '[{"id":"__check__","rev":1,"data":{"n":2},"deleted":true}]'::jsonb);
    r := r + 1;
    select decks.rev, decks.deleted_at, decks.data into n, del, x from public.decks where id = '__check__';
    if n <> 2 or del is null or x->>'n' <> '2' then raise exception 'sai: rev %, deleted_at %, data %', n, del, x; end if;
    steps := steps || step; results := results || 'đạt'::text;

    step := '3. meta sai rev → REV_CONFLICT, không ghi gì';
    begin
      perform public.save_state(m, r - 1, '[]'::jsonb);
      raise exception 'không báo xung đột';
    exception when others then
      if sqlerrm not like 'REV_CONFLICT meta%' then raise; end if;
    end;
    steps := steps || step; results := results || 'đạt'::text;

    step := '4. deck sai rev → REV_CONFLICT, và meta KHÔNG bị ghi theo (cả lệnh bị huỷ)';
    begin
      perform public.save_state(m, r, '[{"id":"__check__","rev":1,"data":{"n":3}}]'::jsonb);
      raise exception 'không báo xung đột';
    exception when others then
      if sqlerrm not like 'REV_CONFLICT deck __check__%' then raise; end if;
    end;
    select meta.rev into n from public.meta;
    if n <> r then raise exception 'meta đã bị ghi dù deck xung đột (rev % thay vì %)', n, r; end if;
    steps := steps || step; results := results || 'đạt'::text;

    step := '5. tạo deck (rev 0) trùng id đã có → REV_CONFLICT';
    begin
      perform public.save_state(m, r, '[{"id":"__check__","rev":0,"data":{"n":9}}]'::jsonb);
      raise exception 'không báo xung đột';
    exception when others then
      if sqlerrm not like 'REV_CONFLICT deck __check__%' then raise; end if;
    end;
    steps := steps || step; results := results || 'đạt'::text;

    step := '6. người đã đăng nhập KHÁC không thấy và không sửa được dòng của user này';
    perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', stranger::text, true);
    select count(*) into n from public.decks;
    if n <> 0 then raise exception 'người khác thấy % deck', n; end if;
    select count(*) into n from public.meta;
    if n <> 0 then raise exception 'người khác thấy % dòng meta', n; end if;
    update public.decks set data = '{"hack":true}'::jsonb where id = '__check__';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'người khác sửa được % deck', n; end if;
    delete from public.meta;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'người khác xoá được % dòng meta', n; end if;
    steps := steps || step; results := results || 'đạt'::text;

    step := '7. chưa đăng nhập (anon): đọc ra 0 dòng, không ghi được, không gọi được save_state';
    set local role anon;
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    -- (bị từ chối hẳn quyền đọc cũng tính là đạt: còn chặt hơn "0 dòng")
    begin
      select count(*) into n from public.decks;
      if n <> 0 then raise exception 'anon thấy % deck', n; end if;
      select count(*) into n from public.meta;
      if n <> 0 then raise exception 'anon thấy % dòng meta', n; end if;
      select count(*) into n from public.snapshots;
      if n <> 0 then raise exception 'anon thấy % bản sao', n; end if;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.decks (user_id, id, data) values (u, '__anon__', '{}'::jsonb);
      raise exception 'anon ghi được vào decks';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.save_state('{}'::jsonb, 0, '[]'::jsonb);
      raise exception 'anon gọi được save_state';
    exception when insufficient_privilege then null;
    end;
    steps := steps || step; results := results || 'đạt'::text;

    -- huỷ mọi thay đổi thử ở trên (kể cả việc đổi vai)
    raise exception 'RECALL_CHECK_ROLLBACK';
  exception when others then
    if sqlerrm <> 'RECALL_CHECK_ROLLBACK' then
      steps := steps || step; results := results || ('LỖI: ' || sqlerrm);
    end if;
  end;

  step := '8. sau khi kiểm: không còn dòng thử nào sót lại';
  select count(*) into n from public.decks where id in ('__check__', '__anon__');
  steps := steps || step;
  results := results || case when n = 0 then 'đạt' else 'LỖI: còn ' || n || ' dòng thử' end;

  return query select s, t from unnest(steps, results) as q(s, t);
end $$;

select * from pg_temp.recall_check();
