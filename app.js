/* ============================ STATE ============================ */
const OFFSETS=[0,1,3,7,16];               // ngày ôn kể từ Ngày 1
const OFFLABEL={0:'Mới',1:'+1',3:'+3',7:'+7',16:'+16'};
const KEY='vocabvip.v1';
/* FIX 11/11 → 13/11: ảnh chụp dữ liệu đã GỠ khỏi code (repo public, dữ liệu thật không nằm trong repo).
   SNAPSHOT = null → trình duyệt CHƯA có dữ liệu thì load() rơi về app trống (seed()).
   Khôi phục dữ liệu bằng Cài đặt → Nhập backup hoặc đồng bộ. Xóa sạch & làm lại vẫn ra trống thật. */
const SNAPSHOT_DATE='2026-11-11';
const SNAPSHOT=null;
let S=load();

/* P1.3: "hôm nay" là NGÀY HỌC (Asia/Bangkok, ngày mới lúc 4h sáng), tính trong logic/dates.js */
function todayStr(){return Logic.studyDay(Date.now());}
function parseDate(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function dayDiff(a,b){return Logic.dayDiff(a,b);} // a-b ngày
function addDays(s,n){return Logic.addDays(s,n);}
function uid(){return Math.random().toString(36).slice(2,9);}

function seed(){
  /* FIX 13/09: bỏ 5 deck nhét cứng. Xoá sạch phải ra SẠCH THẬT, không tự đắp lại deck cũ. */
  return {"projects":[{"id":"trl80kl","name":"IELTS Vocab"}],"sets":[],"activity":{},"settings":{"kpi":80,"testN":20},"currentProj":"trl80kl","paragraphs":[]};
}
/* FIX 11/11: chuẩn hoá dữ liệu từ MỌI nguồn (localStorage, file backup, đám mây).
   Chỉ ĐẮP phần còn thiếu, không đụng phần đã có → chạy lại bao nhiêu lần cũng ra cùng kết quả.
   Trả về danh sách những gì đã vá (để báo cho người dùng biết). */
function isDateStr(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);}
function normalize(o){
  const fixes=[], d=seed();
  if(!o||typeof o!=='object'||!Array.isArray(o.sets)) return null;
  if(!Array.isArray(o.projects)||!o.projects.length){o.projects=d.projects;fixes.push('thiếu danh sách dự án');}
  if(!o.projects.some(p=>p&&p.id===o.currentProj)) o.currentProj=o.projects[0].id;
  if(!o.settings||typeof o.settings!=='object'){o.settings={};fixes.push('thiếu cài đặt');}
  o.settings={...d.settings,...o.settings};
  if(!o.activity||typeof o.activity!=='object'||Array.isArray(o.activity)) o.activity={};
  if(!Array.isArray(o.paragraphs)) o.paragraphs=[];
  const projIds=new Set(o.projects.map(p=>p.id)), setIds=new Set();
  let badSets=0;
  o.sets=o.sets.filter(s=>{ if(s&&typeof s==='object'&&Array.isArray(s.cards))return true; badSets++; return false; });
  if(badSets) fixes.push('bỏ '+badSets+' học phần hỏng (không có thẻ)');
  o.sets.forEach(s=>{
    if(!s.id||setIds.has(s.id)){s.id=uid();fixes.push('đổi id trùng/thiếu của "'+(s.name||'?')+'"');}
    setIds.add(s.id);
    if(typeof s.name!=='string'||!s.name) s.name='(không tên)';
    if(!isDateStr(s.anchor)){s.anchor=todayStr();fixes.push('"'+s.name+'" thiếu ngày bắt đầu → đặt hôm nay');}
    if(typeof s.stageIdx!=='number'||s.stageIdx<0) s.stageIdx=0;
    if(!Array.isArray(s.history)) s.history=[];
    if(!projIds.has(s.projectId)) s.projectId=o.currentProj;
    if(!isDateStr(s.createdAt)) s.createdAt=s.anchor;
    if(s.lastCompleted===undefined) s.lastCompleted=null;
    s.cards=s.cards.filter(c=>c&&typeof c==='object');
    s.cards.forEach(c=>{
      if(!c.id) c.id=uid();
      if(typeof c.term!=='string') c.term=String(c.term??'');
      if(typeof c.def!=='string') c.def=String(c.def??'');
      if(typeof c.note!=='string') c.note='';
      if(!c.st||typeof c.st!=='object') c.st={};
    });
  });
  return {data:o,fixes};
}
/* Tóm tắt 1 bản dữ liệu để SO SÁNH độ mới: số thẻ, tổng lượt trả lời, ngày học gần nhất.
   Số thẻ bằng nhau KHÔNG có nghĩa là cùng tiến độ — phải nhìn lượt trả lời + ngày học. */
function summarize(o){
  let cards=0, answers=0, last='';
  const bump=x=>{ if(isDateStr(x)&&x>last) last=x; };
  (o.sets||[]).forEach(s=>{
    (s.history||[]).forEach(h=>bump(h&&h.date));
    bump(s.lastCompleted);
    (s.cards||[]).forEach(c=>{ cards++;
      ['prod','recog'].forEach(k=>{const x=c&&c.st&&c.st[k]; if(x){answers+=(x.r||0)+(x.w||0); bump(x.last);} });
    });
  });
  Object.keys(o.activity||{}).forEach(bump);
  return {sets:(o.sets||[]).length,cards,answers,last};
}
function summaryLine(m){return m.sets+' deck · '+m.cards+' thẻ · '+m.answers+' lượt trả lời · học gần nhất '+(m.last?fmtFull(m.last):'(chưa học)');}

function load(){
  let raw=null;
  try{raw=localStorage.getItem(KEY);if(raw){const n=normalize(JSON.parse(raw));if(n)return n.data;}}catch(e){}
  // FIX 11/11: dữ liệu cũ hỏng thì CẤT LẠI trước khi thay bằng bản trống, không ghi đè mất luôn
  if(raw){try{localStorage.setItem(KEY+'.corrupt',raw);}catch(e){}}
  // máy mới / chưa có dữ liệu → nạp ảnh chụp có sẵn trong file
  if(!raw){try{const n=normalize(JSON.parse(JSON.stringify(SNAPSHOT)));if(n){localStorage.setItem(KEY,JSON.stringify(n.data));return n.data;}}catch(e){}}
  const s=seed();try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}return s;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Không lưu được (bộ nhớ đầy?)');}
  if(typeof schedulePush==='function')schedulePush();}

/* ============================ SCHEDULE ENGINE ============================ */
// Trả về trạng thái lịch của 1 set cho hôm nay. Tự xếp lại nếu gãy nhịp (>2 ngày trễ).
/* FIX 13/09: deck ĐÃ TỪNG HỌC thì dù gãy nhịp cũng không được gọi là "học mới".
   Căn cứ: có lịch sử test, hoặc đã hoàn thành 1 lượt, hoặc có thẻ nào từng trả lời đúng. */
function daHoc(set){
  if(!set) return false;
  if(set.lastCompleted) return true;
  if((set.history||[]).length) return true;
  return (set.cards||[]).some(c=>{
    const s=c&&c.st; if(!s) return false;
    const p=s.prod||{}, r=s.recog||{};
    return (p.r||0)>0||(p.w||0)>0||(r.r||0)>0||(r.w||0)>0;
  });
}
// FIX 13/09: tìm các thẻ mà term đã tồn tại ở deck khác (bỏ qua chính deck đang sửa)
function findDupTerms(cards, skipSetId){
  const owner={};
  S.sets.forEach(st=>{ if(st.id===skipSetId)return; (st.cards||[]).forEach(c=>{const k=norm(c.term); if(k&&!owner[k])owner[k]=st.name;}); });
  const out=[], seen=new Set();
  (cards||[]).forEach(c=>{const k=norm(c.term); if(k&&owner[k]&&!seen.has(k)){seen.add(k);out.push({term:c.term,deck:owner[k]});}});
  return out;
}
/* P1.3: KHÔNG CÒN DỜI NGÀY ÔN. Mỗi deck giữ ngày đến hạn thật; màn Hôm nay chỉ CHỌN tối đa
   3 deck ôn + 1 deck mới theo thứ tự ưu tiên (Logic.planToday, PLAN.md mục 3.2).
   Đã xoá: dayLoads, firstFree, spreadDecks, applyReschedule, restoreResetDecks. */
/* P1.6: LÊN MỐC theo phương án (c), toàn bộ luật nằm trong Logic.applySessionResult (PLAN.md mục 3.3):
   deck mới xong Ngày 1 khi Học/Viết đúng đủ mọi thẻ trong ngày (hoặc Kiểm tra đạt KPI);
   deck ôn chỉ lên mốc khi Kiểm tra đủ bài đạt KPI; mỗi deck tối đa 1 mốc + 1 lượt mỗi ngày; flashcard không tính.
   Đã xoá: setStatus, advanceStage, completeStudy, recordTest, markActivity, repairEarlyLearn. */
function finishSession(set,mode,pct){
  const t=todayStr();
  const before=Logic.deckStatus(set,t), wasDone=set.lastCompleted===t;
  const res=Logic.applySessionResult(set,{mode,pct,full:mode==='test'},t,S.settings.kpi);
  Object.assign(set,res.set);
  if(res.credit){
    const d=creditedToday(); if(!d.includes(set.id))d.push(set.id);
    S.activity=Logic.creditSession(S.activity,t,set.id,Logic.availableUnits(S.sets,t,d));
  }
  save();
  res.before=before; res.wasDone=wasDone;
  return res;
}
// các deck đã tính lượt hôm nay (bản sao)
function creditedToday(){const r=S.activity[todayStr()];return (r&&Array.isArray(r.d))?r.d.slice():[];}
function stageName(i){return i>=OFFSETS.length?'xong chu kỳ':(i===0?'Mới':'+'+OFFSETS[i]);}
// số thẻ hôm nay chưa đúng lần nào (chiều nào cũng được)
function notLearnedToday(set){
  const t=todayStr();
  return set.cards.filter(c=>!['prod','recog'].some(k=>c.st&&c.st[k]&&c.st[k].last===t&&c.st[k].streak>=1)).length;
}
// chữ ở màn Kết quả: nói đúng chuyện gì đã xảy ra với mốc và streak
function sessionSummary(set,res,mode,pct){
  const t=todayStr(), kpi=S.settings.kpi, b=res.before, now=Logic.deckStatus(set,t);
  const isNew=b.kind==='stock'||(b.kind==='waiting'&&res.stageFrom===0);
  const next=now.kind==='scheduled'?' Lần ôn kế: '+fmt(now.due)+'.':'';
  let m;
  if(mode==='flash') m='Lật thẻ là để làm quen: không tính lượt, không đổi mốc.';
  else if(res.wasDone) m='Deck này đã xong lượt hôm nay rồi, nên lần này không đổi mốc (mỗi deck tối đa 1 mốc mỗi ngày).';
  else if(res.advanced) m=res.stageTo>=OFFSETS.length?'🎓 <b>Lên mốc: xong cả chu kỳ ôn</b> của deck này.'
    :(res.stageFrom===0?'✅ <b>Xong Ngày 1</b> của deck. Mốc kế: +1.'+next
      :'⬆️ <b>Lên mốc</b> '+stageName(res.stageFrom)+' → '+stageName(res.stageTo)+'.'+next);
  else if(res.dropped) m='⬇️ Chưa đạt KPI ở lượt phục hồi: <b>lùi mốc</b> '+stageName(res.stageFrom)+' → '+stageName(res.stageTo)+', ôn lại ngày mai.';
  else if(isNew) m=mode==='test'?'Chưa đạt KPI '+kpi+'% nên chưa xong Ngày 1. Học hết deck (mọi thẻ đúng ít nhất 1 lần trong ngày) hoặc Kiểm tra lại cho đạt.'
    :'Còn <b>'+notLearnedToday(set)+' thẻ</b> chưa đúng lần nào hôm nay, học tiếp để xong Ngày 1.';
  else if(b.kind==='waiting'&&mode==='test') m=set.lastCompleted===t?'Chưa đạt KPI ở lượt phục hồi: giữ mốc '+stageName(res.stageTo)+' (không lùi dưới +1), ôn lại ngày mai.'
    :'<b>Chưa đạt KPI '+kpi+'% nên chưa lên mốc.</b> Deck vẫn nằm trong hàng chờ, thi lại lúc nào cũng được.';
  else if(b.kind==='waiting') m='Deck ôn chỉ lên mốc khi làm <b>Kiểm tra</b> đạt KPI '+kpi+'%. Lần này là luyện thêm, không đổi mốc.';
  else m='Deck chưa đến hạn ôn nên không đổi mốc'+(mode==='test'?' (điểm vẫn ghi vào lịch sử).':'.');
  const st=paintStreak();
  const sl=res.credit?(st.status==='safe'?'🔥 Lượt này được tính: streak hôm nay đã tính ('+st.count+' ngày).'
      :'Lượt này được tính cho streak, còn thiếu '+st.needUnits+' lượt nữa để tính hôm nay.')
    :(st.status==='safe'?'':'Streak hôm nay: còn thiếu '+st.needUnits+' lượt.');
  return m+(sl?'<br>'+sl:'');
}
function isMastered(set){ // THUỘC = mọi thẻ vững cả 2 chiều
  return set.cards.length>0 && set.cards.every(cardKnown);
}
function masteryLabel(set){
  const m=deckMastery(set);
  if(!set.history.length && !set.lastCompleted && !m.done) return {t:'Chưa học',c:'gray'};
  if(isMastered(set)) return {t:'✓ Thuộc cả 2 chiều',c:'done'};
  return {t:`${m.pct}% · V→A ${m.prod}% · A→V ${m.recog}%`,c:'rev'};
}

/* ---- THỐNG KÊ TỪNG THẺ: thuộc = trả lời đúng 2 lần liên tiếp ---- */
/* Mỗi thẻ có hồ sơ RIÊNG cho từng chiều: prod = Việt→Anh, recog = Anh→Việt */
function cst(c,dir){
  if(!c.st||typeof c.st.r==='number')c.st={};      // nâng cấp từ bản cũ (1 chiều)
  if(!c.st[dir])c.st[dir]={r:0,w:0,streak:0,typo:0,last:null};
  return c.st[dir];
}
function bumpCard(c,ok,dir,typo){
  const s=cst(c,dir);
  if(ok){s.r++;s.streak++;if(typo)s.typo++;}else{s._prevStreak=s.streak;s.w++;s.streak=0;}
  s.last=todayStr();
}
function knownDir(c,dir){ return cst(c,dir).streak>=2; }
/* THUỘC = vững CẢ HAI CHIỀU. Nhận biết không tự cho sản sinh (Định luật 4). */
function cardKnown(c){ return knownDir(c,'prod') && knownDir(c,'recog'); }
function deckMastery(set){
  const n=set.cards.length;
  if(!n) return {done:0,total:0,pct:0,prod:0,recog:0};
  const done=set.cards.filter(cardKnown).length;
  return {done,total:n,pct:Math.round(done/n*100),
    prod:Math.round(set.cards.filter(c=>knownDir(c,'prod')).length/n*100),
    recog:Math.round(set.cards.filter(c=>knownDir(c,'recog')).length/n*100)};
}
/* ---- LƯU TIẾN ĐỘ GIỮA CHỪNG ---- */
function saveResume(){
  if(!session)return;
  try{
    S.resume={setId:session.set.id,mode:session.mode,dir:session.dir,
      i:session.i,correct:session.correct||0,
      cardIds:(session.cards||[]).map(c=>c.id),
      dirs:session.dirs||null,
      queue:(session.queue||[]).map(q=>({id:q.card.id,got:q.got})),
      total:session.total||0,mastered:session.mastered||0,
      tries:session.tries||0,wrongs:session.wrongs||0,
      when:new Date().toISOString()};
    save();
  }catch(e){}
}
function clearResume(){ S.resume=null; save(); }

/* ============================ ĐỒNG BỘ ĐÁM MÂY ============================ */
const SUPA_URL='https://quomfkcbbcnuubrpbwpl.supabase.co';
const SUPA_KEY='sb_publishable_vo-fgRVSsp4wcfECUse7Cw_9obpBZzr';
const SYNC_KEY='vocabvip.synccode';                 // mã ở LOCAL, không bị pull ghi đè
let syncTimer=null, syncBusy=false;
function syncCode(){ return localStorage.getItem(SYNC_KEY)||''; }
function setSyncCode(c){ c?localStorage.setItem(SYNC_KEY,c):localStorage.removeItem(SYNC_KEY); }
function newSyncCode(){ return 'kingston-'+Math.random().toString(36).slice(2,8); }
function supaHeaders(extra){
  return Object.assign({'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'},extra||{});
}
function syncStatus(msg){ const e=document.getElementById('syncStatus'); if(e)e.innerHTML=msg; }

/* FIX 06/10: CHỐNG MÁY CŨ GHI ĐÈ BẢN MỚI.
   Cũ: mở app trên máy lâu không dùng → app tự sửa lịch → tự đẩy bản CŨ lên sau 3 giây → đè mất tiến độ máy kia.
   Mới: mỗi máy nhớ "dấu thời gian của bản trên mây mà mình thấy lần cuối" (LASTSYNC_KEY).
   Trước khi đẩy, hỏi mây: có ai đẩy bản mới hơn chưa? Có → tự động thì KHÔNG đẩy, bấm tay thì hỏi trước. */
const LASTSYNC_KEY='vocabvip.lastsync';
let startupPullDone=false;                           // chưa kiểm tra mây lúc mở app thì chưa tự đẩy
async function cloudStamp(){
  const r=await fetch(SUPA_URL+'/rest/v1/vocab_sync?id=eq.'+encodeURIComponent(syncCode())+'&select=updated_at',
    {headers:supaHeaders()});
  if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,120));
  const rows=await r.json(); return rows.length?rows[0].updated_at:null;
}
async function pushCloud(silent){
  const code=syncCode(); if(!code)return false;
  if(syncBusy)return false; syncBusy=true;
  try{
    const cloudAt=await cloudStamp(), seen=localStorage.getItem(LASTSYNC_KEY);
    if(cloudAt && (!seen || new Date(cloudAt)>new Date(seen))){
      if(silent){
        syncStatus('⚠️ Trên mây có bản <b>mới hơn</b> (từ máy khác, lúc '+new Date(cloudAt).toLocaleString('vi-VN')+') → chưa tự đẩy để khỏi ghi đè. Bấm <b>Kéo về</b> để lấy bản đó, hoặc <b>Đẩy lên</b> nếu muốn bản máy này thắng.');
        return false;
      }
      if(!confirm('🚨 Trên mây có bản MỚI HƠN bản máy này từng thấy (lưu lúc '+new Date(cloudAt).toLocaleString('vi-VN')+').\n\nĐẩy lên sẽ GHI ĐÈ bản đó. Vẫn đẩy?'))return false;
    }
    const stamp=new Date().toISOString();
    const body=[{id:code,data:S,updated_at:stamp}];
    const r=await fetch(SUPA_URL+'/rest/v1/vocab_sync',{method:'POST',
      headers:supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,120));
    localStorage.setItem(LASTSYNC_KEY,stamp);
    localStorage.setItem('vocabvip.lastpush',new Date().toISOString());
    if(!silent)toast('☁️ Đã đẩy lên');
    syncStatus('✅ Đồng bộ: <b>'+code+'</b> · đẩy lên lúc '+new Date().toLocaleTimeString('vi-VN'));
    return true;
  }catch(e){
    if(!silent)toast('Đẩy lên lỗi');
    syncStatus('⚠️ Đẩy lên lỗi: '+esc(e.message)+' — dữ liệu vẫn an toàn trong máy này.');
    return false;
  }finally{syncBusy=false;}
}
function schedulePush(){ if(!syncCode()||!startupPullDone)return; clearTimeout(syncTimer); syncTimer=setTimeout(()=>pushCloud(true),3000); }

async function fetchCloud(){
  const code=syncCode(); if(!code)return null;
  const r=await fetch(SUPA_URL+'/rest/v1/vocab_sync?id=eq.'+encodeURIComponent(code)+'&select=data,updated_at',
    {headers:supaHeaders()});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const rows=await r.json();
  return rows.length?rows[0]:null;
}
function cardCount(o){try{return (o.sets||[]).reduce((n,s)=>n+((s.cards||[]).length),0);}catch(e){return 0;}}

async function pullCloud(manual){
  const code=syncCode(); if(!code){toast('Chưa có mã đồng bộ');return;}
  try{
    const row=await fetchCloud();
    if(!row){ syncStatus('☁️ Mã <b>'+code+'</b> chưa có dữ liệu trên mây. Bấm <b>Đẩy lên</b> để tạo.'); if(manual)toast('Trên mây chưa có gì'); return; }
    if(!row.data||!Array.isArray(row.data.sets)){toast('Dữ liệu trên mây hỏng');return;}
    const nCloud=cardCount(row.data), nLocal=cardCount(S);
    const when=new Date(row.updated_at).toLocaleString('vi-VN');
    if(!manual && JSON.stringify(row.data)===JSON.stringify(S)){ localStorage.setItem(LASTSYNC_KEY,row.updated_at); syncStatus('✅ Đồng bộ: <b>'+code+'</b> · đã khớp với đám mây'); return; }
    let msg='Kéo về bản trên mây?\n\nTrên mây: '+nCloud+' thẻ (lưu lúc '+when+')\nMáy này: '+nLocal+' thẻ\n\nDữ liệu máy này sẽ bị thay thế.';
    if(nCloud<nLocal)msg='🚨 Bản trên mây ÍT THẺ HƠN máy này.\n\n'+msg;
    if(!confirm(msg)){ syncStatus('ℹ️ Đang giữ bản máy này, chưa đồng bộ. Muốn bản này thắng thì bấm <b>Đẩy lên</b>.'); return; }
    localStorage.setItem(KEY+'.beforeimport',JSON.stringify(S));
    localStorage.setItem(LASTSYNC_KEY,row.updated_at);
    const nr=normalize(row.data); if(!nr){toast('Dữ liệu trên mây hỏng');return;}
    S=nr.data; save(); toast('☁️ Đã kéo về — sai thì bấm ↩️ Hoàn tác');
    syncStatus('✅ Đồng bộ: <b>'+code+'</b> · kéo về lúc '+new Date().toLocaleTimeString('vi-VN'));
    showView('today');
  }catch(e){
    syncStatus('⚠️ Kéo về lỗi: '+esc(e.message));
    if(manual)toast('Kéo về lỗi');
  }
}
/* P1.6: mỗi CÂU TRẢ LỜI được ghi ngay vào activity (Logic.recordAnswer). Gọi SAU khi đã chấm thẻ (bumpCard).
   Lật flashcard không phải là câu. Streak: toàn bộ luật nằm trong Logic.computeStreak (PLAN.md mục 3.4). */
function touchActivity(){
  const t=todayStr();
  S.activity=Logic.recordAnswer(S.activity,t,session.set.id,Logic.availableUnits(S.sets,t,creditedToday()));
  save();
}
function streakNow(){return Logic.computeStreak(S.activity,(S.streak&&S.streak.freezeUsedDays)||[],todayStr());}
function freezeUsedToday(){return ((S.streak&&S.streak.freezeUsedDays)||[]).includes(todayStr());}
// vẽ số streak + dòng trạng thái ở header; trả về kết quả computeStreak
function paintStreak(){
  const st=streakNow(), n=st.needUnits;
  document.getElementById('streakN').textContent=st.count;
  const txt=st.status==='safe'?'🔥 hôm nay đã tính'
    :(st.status==='atRisk'?'⚠️ đang nguy · ':'')+'còn thiếu '+n+' lượt để tính hôm nay';
  document.getElementById('todayCnt').textContent=txt;
  document.getElementById('freezeN').classList.toggle('hide',st.freezes<1);
  document.getElementById('freezeN').textContent='🧊 '+st.freezes+' băng';
  return st;
}
window.useFreezeToday=function(){
  S.streak=S.streak||{};
  S.streak.freezeUsedDays=Logic.useFreeze(S.streak.freezeUsedDays,todayStr());
  save(); renderToday(); toast('Đã dùng băng: cần 1 lượt hôm nay');
};

/* ============================ HELPERS ============================ */
const VNDAY=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
function fmt(s){const d=parseDate(s);return d.getDate()+'/'+(d.getMonth()+1);}
function fmtFull(s){const d=parseDate(s);return VNDAY[d.getDay()]+', '+d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),1800);}
function norm(s){return (s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[.,;!?]+$/,'').replace(/^(to|a|an|the)\s+/,'');}
function accepts(card){ // các đáp án chấp nhận cho chiều sản sinh (English)
  return card.term.split(/[\/,]/).map(x=>norm(x)).filter(Boolean);
}
/* FIX 14/09: chiều Anh→Việt — gõ ĐÚNG MỘT nghĩa (tách bởi , hoặc /) là đúng, không bắt gõ cả chuỗi.
   Bỏ dấu tiếng Việt khi so để "chinh phu" = "chính phủ". Nghĩa còn lại vẫn hiện ra để ôn. */
function normVi(x){return norm(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function acceptsVi(card){ return card.def.split(/[\/,]/).map(normVi).filter(Boolean).concat([normVi(card.def)]); }
function isRight(c,dir,val){ return dir==='prod' ? accepts(c).includes(norm(val)) : acceptsVi(c).includes(normVi(val)); }
/* Nút "Tôi đã gõ đúng": app chấm sai nhưng người học thấy nghĩa đúng (từ đồng nghĩa app không có).
   Hoàn lại cú chấm sai, ghi thành đúng, gỡ sao. Danh dự tự chấm. */
function overrideRight(c,dir){
  const st=cst(c,dir); if(st.w>0)st.w--; st.r++; st.streak=(st._prevStreak||0)+1; delete st._prevStreak; st.last=todayStr(); c.starred=false;
}
let MUTED = localStorage.getItem('vocab_muted')==='1';
/* FIX 16/09: phát âm chắc ăn hơn trên Chrome.
   - Chọn giọng tiếng Anh cụ thể (máy tiếng Việt có thể lấy nhầm giọng mặc định)
   - cancel() rồi speak() liền nhau → Chrome hay nuốt mất câu → chờ 1 nhịp
   - resume() gỡ trạng thái "kẹt pause" sau khi tab nằm nền lâu
   - giữ tham chiếu utterance (Chrome dọn rác sớm → im lặng)
   - giọng online (Google) lỗi → tự đổi sang giọng offline của máy */
let VOICE=null,_utt=null;
function pickVoice(preferLocal){
  try{const vs=speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang));
    const us=vs.filter(v=>/en[-_]US/i.test(v.lang));
    const pool=us.length?us:vs;
    VOICE=(preferLocal?pool.find(v=>v.localService):null)||pool.find(v=>/Google/i.test(v.name))||pool.find(v=>v.localService)||pool[0]||null;
  }catch(e){VOICE=null;}
  return VOICE;
}
try{pickVoice();speechSynthesis.addEventListener('voiceschanged',()=>pickVoice());}catch(e){}
function speak(txt,_retry){
  if(MUTED||!txt)return;
  const ss=window.speechSynthesis; if(!ss)return;
  try{
    if(!VOICE)pickVoice();
    const say=String(txt).split('/')[0].trim();
    const go=()=>{
      const u=new SpeechSynthesisUtterance(say);
      if(VOICE){u.voice=VOICE;u.lang=VOICE.lang;}else u.lang='en-US';
      u.rate=.9;u.volume=1;
      u.onerror=e=>{ if(!_retry && e.error!=='interrupted' && e.error!=='canceled' && VOICE && !VOICE.localService){ pickVoice(true); speak(txt,true);} };
      _utt=u; ss.resume(); ss.speak(u);
    };
    if(ss.speaking||ss.pending){ss.cancel();setTimeout(go,90);}else go();
  }catch(e){}
}
/* Anh→Việt: đọc từ tiếng Anh ngay khi hiện câu hỏi (luyện nghe, không lộ đáp án) */
function sayQ(c){ if(session&&session.dir==='recog'&&c)speak(c.term); }
(function initMute(){
  const b=document.getElementById('muteBtn');
  if(!b)return;
  function paint(){b.textContent=MUTED?'🔇':'🔊';b.classList.toggle('on',MUTED);
    b.title=MUTED?'Đang TẮT tiếng — bấm để bật':'Đang bật tiếng — bấm để tắt';}
  b.onclick=()=>{MUTED=!MUTED;localStorage.setItem('vocab_muted',MUTED?'1':'0');
    if(MUTED){try{speechSynthesis.cancel();}catch(e){}}
    else{ // bật lại → đọc thử 1 tiếng để biết chắc loa chạy
      if(!window.speechSynthesis||!speechSynthesis.getVoices().length)toast('⚠️ Trình duyệt chưa có giọng đọc tiếng Anh');
      else speak('sound on');
    }
    paint();};
  paint();
})();
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function curProjSets(){return S.sets.filter(s=>s.projectId===S.currentProj);}
function setById(id){return S.sets.find(s=>s.id===id);}
function allCardsToday(){
  // P1.3: từ của các deck trên màn Hôm nay (deck ôn được chọn + deck mới được mời)
  const p=Logic.planToday(S.sets,todayStr()),out=[];
  p.reviews.concat(p.fresh?[p.fresh]:[]).forEach(x=>x.set.cards.forEach(c=>out.push(c)));
  return out;
}

/* ============================ NAV ============================ */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function showView(v){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  ['today','sets','study','translate','settings'].forEach(id=>{
    document.getElementById('view-'+id).classList.toggle('hide',id!==v);
  });
  if(v==='today')renderToday();
  if(v==='sets')renderSets();
  if(v==='study')renderStudyPicker();
  if(v==='translate')renderTranslate();
  if(v==='settings')renderSettings();
  if(v==='study'&&typeof paintOpts==='function')paintOpts();
}

/* ============================ HÔM NAY ============================ */
function renderToday(){
  const t=todayStr();
  document.getElementById('dateLine').textContent=fmtFull(t)+' · Ngày thứ '+journeyDay()+' của hành trình';
  const SK=paintStreak();

  const bn=document.getElementById('todayBanners');bn.innerHTML='';
  if(SK.status==='atRisk'){
    const usedF=freezeUsedToday()&&SK.freezes>0;
    bn.innerHTML+=`<div class="banner b-bad" id="riskBanner">${usedF
      ?'🧊 <b>Đã dùng băng: cần 1 lượt hôm nay</b> để giữ streak '+SK.count+' ngày.'
      :'🚨 <b>Streak đang nguy: hôm qua lỡ.</b> Hôm nay cần 2 lượt (thiếu deck thì 20 câu thay 1 lượt).'}
      Còn thiếu <b>${SK.needUnits} lượt</b>.${(!usedF&&SK.freezes>0)?'<br><button class="btn sm" style="margin-top:8px" onclick="useFreezeToday()">🧊 Dùng băng</button> <span class="tag">dùng băng thì hôm nay chỉ cần 1 lượt</span>':''}</div>`;
  }
  if(S.resume){
    const rs=setById(S.resume.setId);
    if(rs){
      const m=S.resume.mode, tot=S.resume.total||(S.resume.cardIds||[]).length||rs.cards.length;
      const pos=(m==='learn')?(S.resume.mastered+'/'+tot+' từ đã thuộc'):((S.resume.i+1)+'/'+tot+' câu');
      const ago=Math.round((Date.now()-new Date(S.resume.when).getTime())/60000);
      bn.innerHTML+=`<div class="banner b-warn">⏸️ <b>Đang học dở:</b> ${esc(rs.name)} · chế độ ${esc(MODEVN[m]||m)} · ${pos}
        <span class="tag">(${ago<60?ago+' phút trước':Math.round(ago/60)+' giờ trước'})</span><br>
        <button class="btn sm" style="margin-top:8px" onclick="resumeStudy()">▶️ Học tiếp</button>
        <button class="btn sm gray" style="margin-top:8px" onclick="if(confirm('Bỏ phần đang học dở?')){clearResume();renderToday();}">Bỏ</button></div>`;
    }else{S.resume=null;}
  }
  // FIX 13/09: nhắc xuất backup nếu quá 7 ngày (dữ liệu nằm trong trình duyệt, xoá cache là mất)
  (function(){
    const last=localStorage.getItem('vocabvip.lastexport');
    const age=last?dayDiff(t,last):null;
    if(age===null||age>=7){
      bn.innerHTML+=`<div class="banner b-warn">💾 ${age===null?'Chưa từng xuất backup trên máy này':'Đã '+age+' ngày chưa xuất backup'} → <b>Cài đặt → Xuất backup (.json)</b>. Mất 10 giây, cứu được cả tháng công.</div>`;
    }
  })();
  // P1.3: kế hoạch = hàng chờ (tối đa 3 ôn + 1 mới, không dời lịch)
  const P=Logic.planToday(S.sets,t), G=P.gate;
  const GATE={
    late:'Deck mới tạm dừng: còn '+G.lateCount+' deck ôn trễ',
    valve:'Deck mới tạm dừng: đang có '+G.lateCount+' deck ôn trễ (hơn 4)',
    ceiling:'Đã quá 3 ngày chưa có deck mới nên mở 1 deck mới dù còn bài ôn',
    doneNew:'Hôm nay đã học 1 deck mới',
    emptyStock:'Kho deck mới đã hết, tạo deck mới để mai có từ học'
  };
  const row=(x,o)=>{
    const set=x.set, st=x.status, lb=deckLabel(st);
    const late=(st.kind==='waiting'&&st.late)?' · trễ '+st.late+'d':'';
    return `<div class="setrow"><span class="pill ${lb.c}">${lb.t}${late}</span>
      <span class="nm">${esc(set.name)}</span><span class="meta">${set.cards.length} từ</span>
      <span class="sp">${o.done?'<span class="pill done">✓ xong hôm nay</span>':''}
      <button class="btn sm${o.extra?' gray':''}" onclick="quickStudy('${set.id}')">${o.extra?'Học thêm':(o.done?'Học lại':'Học ngay')}</button></span></div>`;
  };
  const fold=(title,arr)=>arr.length?`<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">${title} (${arr.length})</summary>
    <div style="margin-top:8px">${arr.map(x=>row(x,{extra:true})).join('')}</div></details>`:'';
  let h='';
  h+=P.done.map(x=>row(x,{done:true})).join('');
  h+=P.reviews.map(x=>row(x,{})).join('');
  if(P.fresh)h+=row(P.fresh,{});
  if(!h)h='<p class="muted">Hôm nay không có học phần nào tới hạn. Rảnh thì tạo deck mới hoặc luyện dịch đoạn văn nhé!</p>';
  if(GATE[G.reason])h+=`<p class="small muted" id="gateLine" style="margin:10px 0 0">${GATE[G.reason]}.</p>`;
  const PC=Logic.paceInfo(S.activity,t), vn=x=>String(x).replace('.',',');
  h+=`<p class="small muted" id="paceLine" style="margin:6px 0 0">${PC.pace===null?'Chưa đủ dữ liệu để tính nhịp (cần 3 ngày).'
    :'Nhịp hiện tại '+vn(PC.pace)+' lượt/ngày → '+(PC.everyDays?'từ mới cứ '+PC.everyDays+' ngày một lần':'chưa có lượt nào trong 7 ngày qua')+'. Làm thêm 1 lượt/ngày → '+PC.everyDaysPlus1+' ngày một lần.'}</p>`;
  h+=fold('Đang chờ thêm',P.more);
  h+=fold('Kho deck mới',P.stock);
  document.getElementById('todayPlan').innerHTML=h;

  // stats
  document.getElementById('stMastered').textContent=S.sets.filter(isMastered).length;
  document.getElementById('stLearning').textContent=S.sets.filter(s=>!isMastered(s)&&(s.lastCompleted||s.history.length)).length;
  document.getElementById('stTotalCards').textContent=S.sets.reduce((a,s)=>a+s.cards.length,0);
  document.getElementById('stBest').textContent=SK.best;
}
/* P1.3: nhãn hiển thị của một deck theo Logic.deckStatus (dùng ở Hôm nay và Học phần) */
function deckLabel(st){
  if(st.kind==='stock')return {t:'HỌC MỚI',c:'new',long:'Trong kho'};
  if(st.kind==='waiting')return st.stage===0?{t:'HỌC TIẾP',c:'new',long:'Đang học dở'}
    :{t:'ÔN +'+st.stage,c:st.late?'late':'rev',long:'Đang chờ ôn +'+st.stage};
  if(st.kind==='scheduled')return {t:'Ôn '+fmt(st.due),c:'gray',long:'Ôn '+fmt(st.due)};
  return {t:'Xong chu kỳ',c:'done',long:'Xong chu kỳ'};
}
function journeyDay(){
  // FIX 16/09: Ngày 1 giờ có thể dời → chốt ngày khởi đầu hành trình MỘT LẦN, không đổi nữa
  if(!S.journeyStart){
    const anchors=S.sets.map(s=>s.anchor).sort();
    if(!anchors.length)return 1;
    S.journeyStart=anchors[0]; save();
  }
  const start=S.journeyStart, t=todayStr();
  const d=dayDiff(t,start);return d<0?1:d+1;
}
window.quickStudy=function(id){document.getElementById('studySet').value=id;showView('study');document.getElementById('studySet').value=id;};

/* ============================ HỌC PHẦN / EDITOR ============================ */
let editing=null,editCards=[];
function renderSets(){
  const ps=document.getElementById('projSelect');
  ps.innerHTML=S.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  if(!S.projects.find(p=>p.id===S.currentProj))S.currentProj=S.projects[0]?.id;
  ps.value=S.currentProj;
  const list=document.getElementById('setList');
  const sets=curProjSets();
  if(!sets.length){list.innerHTML='<p class="muted">Chưa có học phần nào trong project này.</p>';}
  else{
    list.innerHTML=sets.map(set=>{
      const m=masteryLabel(set),st=Logic.deckStatus(set,todayStr()),lb=deckLabel(st);
      const stTxt=`<span class="pill ${st.kind==='stock'?'gray':lb.c}">${lb.long}${st.kind==='waiting'&&st.late?' · trễ '+st.late+'d':''}</span>`;
      return `<div class="setrow">
        <span class="nm">${esc(set.name)}</span>
        <span class="pill ${m.c}">${m.t}</span> ${stTxt}
        <span class="meta">${set.cards.length} từ · ${set.stageIdx===0?'Ngày 1: '+fmt(set.anchor):'chặng kế: '+(OFFSETS[set.stageIdx]!=null?OFFLABEL[OFFSETS[set.stageIdx]]:'xong')}</span>
        <span class="sp">
          <button class="btn sm" onclick="quickStudy('${set.id}')">Học</button>
          <button class="btn sm gray" onclick="editSet('${set.id}')">Sửa</button>
          <button class="btn sm bad" onclick="delSet('${set.id}')">Xóa</button>
        </span></div>`;
    }).join('');
  }
  document.getElementById('setEditor').classList.add('hide');
}
document.getElementById('projSelect').onchange=e=>{S.currentProj=e.target.value;save();renderSets();};
document.getElementById('newProjBtn').onclick=()=>{const n=prompt('Tên project mới:');if(n){const p={id:uid(),name:n.trim()};S.projects.push(p);S.currentProj=p.id;save();renderSets();}};
document.getElementById('renameProjBtn').onclick=()=>{const p=S.projects.find(x=>x.id===S.currentProj);if(!p)return;const n=prompt('Đổi tên project:',p.name);if(n){p.name=n.trim();save();renderSets();}};
document.getElementById('delProjBtn').onclick=()=>{
  if(S.projects.length<=1){toast('Phải còn ít nhất 1 project');return;}
  if(!confirm('Xóa project này và mọi học phần trong đó?'))return;
  S.sets=S.sets.filter(s=>s.projectId!==S.currentProj);
  S.projects=S.projects.filter(p=>p.id!==S.currentProj);
  S.currentProj=S.projects[0].id;save();renderSets();
};
document.getElementById('newSetBtn').onclick=()=>openEditor(null);
window.editSet=id=>openEditor(id);
window.delSet=id=>{if(confirm('Xóa học phần này?')){S.sets=S.sets.filter(s=>s.id!==id);save();renderSets();}};

function openEditor(id){
  editing=id?setById(id):null;
  editCards=editing?editing.cards.map(c=>({...c})):[];
  document.getElementById('setEditor').classList.remove('hide');
  document.getElementById('setEditorTitle').textContent=editing?'Sửa: '+editing.name:'Học phần mới';
  document.getElementById('setName').value=editing?editing.name:suggestName();
  document.getElementById('setAnchor').value=editing?editing.anchor:todayStr();
  document.getElementById('pasteBox').value='';document.getElementById('parseInfo').textContent='';
  renderEditCards();
  document.getElementById('setEditor').scrollIntoView({behavior:'smooth'});
}
function suggestName(){const d=new Date();return String(d.getDate()).padStart(2,'0')+String(d.getMonth()+1).padStart(2,'0');}
function renderEditCards(){
  document.getElementById('cardCount').textContent=editCards.length;
  const el=document.getElementById('cardEditList');
  el.innerHTML=editCards.map((c,i)=>`<div class="setrow" style="padding:7px 10px">
    <input value="${esc(c.term)}" onchange="editCards[${i}].term=this.value" style="flex:1;min-width:120px">
    <input value="${esc(c.def)}" onchange="editCards[${i}].def=this.value" style="flex:1;min-width:120px">
    <button class="minibtn" onclick="editCards.splice(${i},1);renderEditCards()">✕</button></div>`).join('')
    ||'<p class="muted small">Chưa có thẻ nào.</p>';
}
document.getElementById('tabPaste').onclick=()=>{tabTo('paste');};
document.getElementById('tabManual').onclick=()=>{tabTo('manual');};
function tabTo(w){
  document.getElementById('panePaste').classList.toggle('hide',w!=='paste');
  document.getElementById('paneManual').classList.toggle('hide',w!=='manual');
  document.getElementById('tabPaste').classList.toggle('gray',w!=='paste');
  document.getElementById('tabManual').classList.toggle('gray',w!=='manual');
}
document.getElementById('mAdd').onclick=()=>{
  const t=document.getElementById('mTerm').value.trim(),d=document.getElementById('mDef').value.trim();
  if(!t||!d){toast('Nhập cả từ và nghĩa');return;}
  editCards.push({id:uid(),term:t,def:d,note:'',starred:false});
  document.getElementById('mTerm').value='';document.getElementById('mDef').value='';
  document.getElementById('mTerm').focus();renderEditCards();
};
document.getElementById('mDef').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('mAdd').click();});
document.getElementById('parseBtn').onclick=()=>doParse(document.getElementById('pasteBox').value);
document.getElementById('fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{document.getElementById('pasteBox').value=r.result;doParse(r.result);};r.readAsText(f);};
function doParse(text){
  let sep=document.getElementById('sepSel').value;if(sep==='\\t')sep='\t';
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let added=0,bad=0;
  lines.forEach(l=>{
    let idx=l.indexOf(sep);
    if(idx<0){bad++;return;}
    const term=l.slice(0,idx).trim(), def=l.slice(idx+sep.length).trim();
    if(term&&def){editCards.push({id:uid(),term,def,note:'',starred:false});added++;}else bad++;
  });
  renderEditCards();
  document.getElementById('parseInfo').textContent=` Thêm ${added} thẻ${bad?', bỏ qua '+bad+' dòng lỗi':''}.`;
  if(added)toast('Đã thêm '+added+' thẻ');
}
document.getElementById('cancelSetBtn').onclick=()=>{document.getElementById('setEditor').classList.add('hide');};
document.getElementById('saveSetBtn').onclick=()=>{
  const name=document.getElementById('setName').value.trim()||suggestName();
  const anchor=document.getElementById('setAnchor').value||todayStr();
  if(!editCards.length){toast('Học phần cần ít nhất 1 thẻ');return;}
  /* FIX 13/09: chặn từ trùng — deck 1109 từng có 15/30 thẻ đã nằm ở deck khác */
  const dupInfo=findDupTerms(editCards, editing?editing.id:null);
  if(dupInfo.length){
    const list=dupInfo.slice(0,12).map(d=>d.term+' (đã có ở '+d.deck+')').join('\n')+(dupInfo.length>12?'\n…':'');
    if(confirm('⚠️ '+dupInfo.length+' từ trong deck này ĐÃ CÓ ở deck khác:\n\n'+list+'\n\nOK = bỏ '+dupInfo.length+' từ trùng ra, giữ '+(editCards.length-dupInfo.length)+' từ mới.\nHủy = giữ nguyên, chấp nhận ôn trùng.')){
      const bad=new Set(dupInfo.map(d=>norm(d.term)));
      editCards=editCards.filter(c=>!bad.has(norm(c.term)));
      if(!editCards.length){toast('Bỏ trùng xong thì deck rỗng — không lưu');return;}
    }
  }
  if(editing){editing.name=name;editing.anchor=anchor;editing.cards=editCards.map(c=>({...c}));}
  else{S.sets.push({id:uid(),name,projectId:S.currentProj,anchor,createdAt:todayStr(),
    stageIdx:0,lastCompleted:null,rescheduled:false,history:[],cards:editCards.map(c=>({...c}))});}
  save();renderSets();toast('Đã lưu học phần');
};

/* ============================ STUDY ============================ */
let session=null;
const MODEVN={flash:'Thẻ',learn:'Học',write:'Viết',test:'Kiểm tra'};
function resumeStudy(){
  const r=S.resume; if(!r)return;
  const set=setById(r.setId); if(!set){clearResume();return;}
  const byId=id=>set.cards.find(c=>c.id===id);
  session={set,mode:r.mode,dir:r.dir,i:r.i||0,correct:r.correct||0,answers:[],_touched:true,
    cards:(r.cardIds||[]).map(byId).filter(Boolean),
    dirs:r.dirs||null,
    total:r.total||0,mastered:r.mastered||0,tries:r.tries||0,wrongs:r.wrongs||0};
  if(!session.cards.length)session.cards=shuffle(set.cards);
  showView('study');
  if(r.mode==='learn'){
    session.queue=(r.queue||[]).map(q=>({card:byId(q.id),got:q.got})).filter(q=>q.card);
    session.total=session.total||set.cards.length;
    showStudyPane('quiz');
    document.getElementById('quizTitle').textContent='Trắc nghiệm + Tự luận · '+set.name;
    drawLearnNext();
  }else if(r.mode==='flash'){startFlashAt();}
  else if(r.mode==='write'){showStudyPane('quiz');document.getElementById('quizTitle').textContent='Viết · '+set.name;drawWrite();}
  else if(r.mode==='test'){showStudyPane('quiz');document.getElementById('quizTitle').textContent='📝 Kiểm tra · '+set.name;drawTestItem();}
  toast('Học tiếp từ chỗ dừng');
}
function startFlashAt(){showStudyPane('flash');flashFlipped=false;drawFlash();}
function renderStudyPicker(){
  const sel=document.getElementById('studySet');
  const sets=S.sets;
  sel.innerHTML=sets.map(s=>`<option value="${s.id}">${esc(s.name)} (${s.cards.length} từ)</option>`).join('')||'<option>—</option>';
  showStudyPane('picker');
}
function showStudyPane(p){
  document.getElementById('studyPicker').classList.toggle('hide',p!=='picker');
  document.getElementById('studyFlash').classList.toggle('hide',p!=='flash');
  document.getElementById('studyQuiz').classList.toggle('hide',p!=='quiz');
  document.getElementById('studyResult').classList.toggle('hide',p!=='result');
}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showStudyPane('picker'));
document.querySelectorAll('#studyPicker [data-mode]').forEach(b=>b.onclick=()=>startMode(b.dataset.mode));

/* ---- Tùy chọn Học & Kiểm tra ---- */
function OPT(){
  const s=S.settings;
  if(s.testProd===undefined)s.testProd='write';   // FIX 14/09: loại câu theo chiều
  if(s.testRecog===undefined)s.testRecog='mcq';
  if(s.learnBatch===undefined)s.learnBatch=20;
  if(s.learnMCQ===undefined)s.learnMCQ=true;
  if(s.learnWrite===undefined)s.learnWrite=true;
  if(s.testMCQ===undefined)s.testMCQ=true;
  if(s.testWrite===undefined)s.testWrite=true;
  if(s.testTF===undefined)s.testTF=false;
  return s;
}
function paintOpts(){
  const s=OPT();
  const g=id=>document.getElementById(id);
  if(!g('optLearnBatch'))return;
  g('optLearnBatch').value=String(s.learnBatch);
  g('optLearnMCQ').checked=s.learnMCQ;
  g('optLearnWrite').checked=s.learnWrite;
  g('optTestN').value=s.testN;
  g('optTestMCQ').checked=s.testMCQ;
  g('optTestWrite').checked=s.testWrite;
  g('optTestTF').checked=s.testTF;
  if(g('optTestProd'))g('optTestProd').value=s.testProd;
  if(g('optTestRecog'))g('optTestRecog').value=s.testRecog;
}
function readOpts(){
  const s=OPT();const g=id=>document.getElementById(id);
  if(!g('optLearnBatch'))return s;
  s.learnBatch=+g('optLearnBatch').value;
  s.learnMCQ=g('optLearnMCQ').checked;
  s.learnWrite=g('optLearnWrite').checked;
  if(!s.learnMCQ&&!s.learnWrite){s.learnWrite=true;g('optLearnWrite').checked=true;toast('Phải bật ít nhất 1 loại câu hỏi');}
  s.testN=Math.max(1,+g('optTestN').value||20);
  s.testMCQ=g('optTestMCQ').checked;
  s.testWrite=g('optTestWrite').checked;
  s.testTF=g('optTestTF').checked;
  if(g('optTestProd'))s.testProd=g('optTestProd').value;
  if(g('optTestRecog'))s.testRecog=g('optTestRecog').value;
  if(!s.testMCQ&&!s.testWrite&&!s.testTF){s.testMCQ=true;g('optTestMCQ').checked=true;toast('Phải bật ít nhất 1 loại câu hỏi');}
  save();return s;
}
['optLearnBatch','optLearnMCQ','optLearnWrite','optTestN','optTestMCQ','optTestWrite','optTestTF','optTestProd','optTestRecog']
  .forEach(id=>{const e=document.getElementById(id);if(e)e.onchange=readOpts;});
paintOpts();

function startMode(mode){
  const set=setById(document.getElementById('studySet').value);
  if(!set||!set.cards.length){toast('Học phần trống');return;}
  readOpts();
  const dir=document.getElementById('studyDir').value;
  session={set,mode,dir,cards:shuffle(set.cards),i:0,correct:0,answers:[],_touched:false};
  S.resume=null;
  if(mode==='flash')startFlash();
  else if(mode==='learn')startLearn();
  else if(mode==='write')startWrite();
  else if(mode==='test')startTest();
}
/* ---- Flashcards ---- */
let flashFlipped=false;
function startFlash(){showStudyPane('flash');session.i=0;flashFlipped=false;drawFlash();}
function frontBack(card,dir,flipped){
  // dir prod: mặt trước = nghĩa Việt, mặt sau = English. recog: ngược lại
  const vi=card.def, en=card.term;
  const front = dir==='prod'?vi:en, back = dir==='prod'?en:vi;
  return flipped?{main:back,isEn:(dir==='prod')}:{main:front,isEn:(dir!=='prod')};
}
function drawFlash(){
  const c=session.cards[session.i];
  const fb=frontBack(c,session.dir,flashFlipped);
  document.getElementById('flashSide').textContent=flashFlipped?'MẶT SAU':'MẶT TRƯỚC';
  document.getElementById('flashBig').textContent=fb.main;
  document.getElementById('flashSub').textContent=flashFlipped?'':'(bấm để lật)';
  document.getElementById('flashNote').textContent=(flashFlipped&&c.note)?('📝 '+c.note):'';
  document.getElementById('flashCount').textContent=`${session.i+1} / ${session.cards.length}`;
  if(fb.isEn)speak(fb.main);
}
document.getElementById('flashCard').onclick=()=>{flashFlipped=!flashFlipped;drawFlash();};
document.getElementById('flashFlip').onclick=e=>{e.stopPropagation();flashFlipped=!flashFlipped;drawFlash();};
document.getElementById('flashSpeak').onclick=e=>{e.stopPropagation();const c=session.cards[session.i];speak(c.term);};
document.getElementById('flashNext').onclick=e=>{e.stopPropagation();if(session.i<session.cards.length-1){session.i++;flashFlipped=false;saveResume();drawFlash();}else finishFlash();};
document.getElementById('flashPrev').onclick=e=>{e.stopPropagation();if(session.i>0){session.i--;flashFlipped=false;drawFlash();}};
function finishFlash(){clearResume();showResult('Đã xem hết thẻ 🃏',`Xong ${session.cards.length} thẻ. `+sessionSummary(session.set,{before:Logic.deckStatus(session.set,todayStr()),credit:false},'flash',0),false);}

/* ---- Học: Trắc nghiệm + Tự luận (trắc nghiệm trước, tự luận sau) ---- */
function askAnswer(card,dir){ return dir==='prod'?{q:card.def,a:card.term}:{q:card.term,a:card.def}; }
function startLearn(){
  showStudyPane('quiz');
  const s=OPT();
  session.steps=[];
  if(s.learnMCQ)session.steps.push('mcq');
  if(s.learnWrite)session.steps.push('write');
  if(!session.steps.length)session.steps=['write'];
  let pool=shuffle(session.set.cards);
  if(s.learnBatch>0&&s.learnBatch<pool.length){
    // P1.6: mẻ nhỏ hơn deck → thẻ CHƯA đúng lần nào hôm nay lên trước, để các mẻ cộng dồn phủ hết deck
    const t=todayStr(), ok=c=>['prod','recog'].some(k=>c.st&&c.st[k]&&c.st[k].last===t&&c.st[k].streak>=1);
    pool=pool.filter(c=>!ok(c)).concat(pool.filter(ok)).slice(0,s.learnBatch);
  }
  session.queue=pool.map(c=>({card:c,got:0}));
  session.total=session.queue.length;session.mastered=0;session.tries=0;session.wrongs=0;
  document.getElementById('quizTitle').textContent='Học · '+session.set.name+' · '+session.total+' thẻ';
  drawLearnNext();
}
function learnHeader(){return `Đã thuộc ${session.mastered}/${session.total} · còn ${session.queue.length} lượt`;}
function requeue(st,gap){const q=session.queue;q.splice(Math.min(q.length,gap),0,st);}
function drawLearnNext(){
  if(!session.queue.length){finishLearn();return;}
  setProg(session.mastered/session.total);
  const st=session.queue[0];
  const steps=session.steps||['mcq','write'];
  if(steps[Math.min(st.got,steps.length-1)]==='mcq')drawLearnMCQ(st);else drawLearnWrite(st);
}
// Mỗi từ cần đúng 2 lần (trắc nghiệm → tự luận) = THUỘC. Sai → reset + đẩy lại hàng đợi (lặp nhiều hơn).
function learnDone(st,correct){
  bumpCard(st.card,correct,session.dir,st._typo); touchActivity();
  session.tries++;session.queue.shift();
  if(correct){
    st.got++;
    if(st.got>=(session.steps||['mcq','write']).length)session.mastered++; else requeue(st,3);
  }else{
    session.wrongs++;st.got=0;st.card.starred=true;requeue(st,2);
  }
  saveResume();
  drawLearnNext();
}
function drawLearnMCQ(st){
  const c=st.card;const {q,a}=askAnswer(c,session.dir);
  const wrongs=shuffle(session.set.cards.filter(x=>x.id!==c.id)).slice(0,3).map(x=>session.dir==='prod'?x.term:x.def);
  const opts=shuffle([a,...wrongs]);
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">Trắc nghiệm · ${learnHeader()}</p>
    <div class="flash" style="min-height:110px;cursor:default"><div class="big" style="font-size:24px">${esc(q)}</div></div>
    <div class="opts" id="lo"></div>`;
  sayQ(c);
  const oc=document.getElementById('lo');
  opts.forEach((o,ki)=>{const b=document.createElement('button');b.className='opt';b.textContent=o;b.dataset.k=ki+1;
    b.onclick=()=>{const ok=norm(o)===norm(a);
      [...oc.children].forEach(x=>{x.style.pointerEvents='none';if(norm(x.textContent)===norm(a))x.classList.add('correct');});
      if(!ok)b.classList.add('wrong');
      if(session.dir==='prod')speak(a);
      setTimeout(()=>learnDone(st,ok),ok?450:950);};oc.appendChild(b);});
}
function drawLearnWrite(st){
  const c=st.card;const {q}=askAnswer(c,session.dir);sayQ(c);
  const ans=session.dir==='prod'?c.term:c.def;
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">Tự luận · ${learnHeader()}</p>
    <div class="flash" style="min-height:90px;cursor:default"><div class="big" style="font-size:23px">${esc(q)}</div></div>
    <div class="row" style="margin-top:12px"><input id="lIn" placeholder="Gõ đáp án..." autocomplete="off" style="flex:1"><button class="btn" id="lChk">Kiểm tra</button></div>
    <div id="lFb" style="margin-top:10px"></div>`;
  const inp=document.getElementById('lIn');inp.focus();
  const check=()=>{
    const ok=isRight(c,session.dir,inp.value);
    const fb=document.getElementById('lFb');inp.disabled=true;inp.blur();document.getElementById('lChk').classList.add('hide');
    if(ok){fb.innerHTML='<span class="pill done">✓ Đúng — thuộc từ này!</span>';if(session.dir==='prod')speak(c.term);setTimeout(()=>learnDone(st,true),650);}
    else{const typed=inp.value.trim()||'(để trống)';if(session.dir==='prod')speak(c.term);
      fb.innerHTML=`<div class="banner b-bad" style="margin:0">✗ Bạn gõ: <b>${esc(typed)}</b> — chưa đúng.<br>✅ Đáp án đúng: <b style="font-size:19px">${esc(ans)}</b> &nbsp;<span class="tag">(từ này sẽ được lặp lại để nhớ)</span></div>`;
      const nb=document.createElement('button');nb.className='btn sm';nb.id='lNext';nb.textContent='Đã nhớ, tiếp → (Enter)';nb.style.marginTop='10px';nb.onclick=()=>learnDone(st,false);fb.appendChild(nb);
      const tb=document.createElement('button');tb.className='btn sm gray';tb.id='lOverride';tb.textContent='⌨️ Tôi gõ nhầm phím — tính đúng ( \\ )';tb.style.margin='10px 0 0 8px';
      tb.title='Chỉ dùng khi thật sự bấm nhầm phím. Nhớ mang máng mà bấm nút này là tự lừa mình.';
      tb.onclick=()=>{st._typo=true;learnDone(st,true);};fb.appendChild(tb);}
  };
  document.getElementById('lChk').onclick=check;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!inp.disabled)check();});
}
function finishLearn(){
  clearResume();
  const acc=session.tries?Math.round((session.tries-session.wrongs)/session.tries*100):100;
  const res=finishSession(session.set,'learn',acc);
  showResult('Học xong mẻ này 🎯',`Đã đúng đủ bước cho <b>${session.total} từ</b> · ${session.tries} lượt trả lời · độ chính xác ${acc}%.<br>`+sessionSummary(session.set,res,'learn',acc),res.advanced);
}
/* ---- Viết (sai phải gõ lại ĐÚNG mới đi tiếp) ---- */
function startWrite(){showStudyPane('quiz');document.getElementById('quizTitle').textContent='Viết · '+session.set.name;session.i=0;session.correct=0;session.cards=shuffle(session.set.cards);drawWrite();}
function nextWrite(){if(session.i<session.cards.length-1){session.i++;drawWrite();}else finishWrite();}
function finishWrite(){const pct=session.cards.length?session.correct/session.cards.length*100:0;clearResume();
  const res=finishSession(session.set,'write',pct);
  showResult('Viết xong ⌨️',`Đúng ngay lần đầu ${session.correct}/${session.cards.length} (${Math.round(pct)}%). Từ nào sai đã gắn ⭐ để ôn lại.<br>`+sessionSummary(session.set,res,'write',pct),pct>=S.settings.kpi);}
function drawWrite(){
  const c=session.cards[session.i];const {q}=askAnswer(c,session.dir);setProg(session.i/session.cards.length);sayQ(c);
  const ans=session.dir==='prod'?c.term:c.def;
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">${session.i+1}/${session.cards.length}</p>
    <div class="flash" style="min-height:90px;cursor:default"><div class="big" style="font-size:24px">${esc(q)}</div></div>
    <div class="row" style="margin-top:12px"><input id="wIn" placeholder="Gõ đáp án..." autocomplete="off" style="flex:1">
    <button class="btn" id="wChk">Kiểm tra</button></div><div id="wFb" style="margin-top:10px"></div>`;
  const inp=document.getElementById('wIn');inp.focus();
  let retype=false;
  const matches=v=>isRight(c,session.dir,v);
  const check=()=>{
    const fb=document.getElementById('wFb');
    if(!retype){
      if(matches(inp.value)){session.correct++;bumpCard(c,true,session.dir);touchActivity();saveResume();fb.innerHTML='<span class="pill done">✓ Đúng</span>';if(session.dir==='prod')speak(c.term);
        inp.disabled=true;document.getElementById('wChk').classList.add('hide');setTimeout(nextWrite,600);}
      else{c.starred=true;bumpCard(c,false,session.dir);touchActivity();saveResume();retype=true;if(session.dir==='prod')speak(c.term);
        fb.innerHTML=`<span class="pill broken">✗ Sai</span> &nbsp;Đáp án: <b>${esc(ans)}</b> <span class="tag">(đã gắn ⭐)</span> <button class="btn gray" id="wOverride" style="margin-left:6px">✔ Tôi đã gõ đúng ( \\ )</button><br><span class="tag">Gõ lại cho đúng để đi tiếp:</span>`;
        inp.value='';inp.focus();document.getElementById('wChk').textContent='Xác nhận';
        document.getElementById('wOverride').onclick=()=>{overrideRight(c,session.dir);session.correct++;saveResume();fb.innerHTML='<span class="pill done">✓ Tính là đúng</span>';inp.disabled=true;document.getElementById('wChk').classList.add('hide');setTimeout(nextWrite,500);};}
    }else{
      if(matches(inp.value)){fb.innerHTML='<span class="pill done">✓ Đúng rồi!</span>';inp.disabled=true;document.getElementById('wChk').classList.add('hide');if(session.dir==='prod')speak(c.term);setTimeout(nextWrite,500);}
      else{toast('Chưa khớp — gõ lại: '+ans);inp.select();}
    }
  };
  document.getElementById('wChk').onclick=check;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!inp.disabled)check();});
}
/* ---- Test ---- */
function startTest(){
  const s=OPT();
  session.types=[];
  if(s.testMCQ)session.types.push('mcq');
  if(s.testWrite)session.types.push('write');
  if(s.testTF)session.types.push('tf');
  if(!session.types.length)session.types=['mcq'];
  /* FIX 14/09: Kiểm tra = TOÀN BỘ học phần × 2 chiều. Mỗi thẻ hỏi 2 lần:
     Việt→Anh (sản sinh) + Anh→Việt (nhận biết). Thuộc = đạt KPI trên cả hai chiều cộng lại. */
  const items=[];
  session.set.cards.forEach(c=>{items.push({c,dir:'prod'});items.push({c,dir:'recog'});});
  const sh=shuffle(items);
  session.cards=sh.map(x=>x.c); session.dirs=sh.map(x=>x.dir);
  const n=session.cards.length;
  session.mode='test';showStudyPane('quiz');
  document.getElementById('quizTitle').textContent='📝 Kiểm tra · '+session.set.name+' · '+n+' câu ('+session.set.cards.length+' từ × 2 chiều)';
  session.i=0;session.correct=0;drawTestItem();
}
function drawTestItem(){
  // FIX 14/09: chiều đổi theo từng câu. Sản sinh → ưu tiên tự luận (gõ tiếng Anh).
  // Nhận biết → trắc nghiệm/đúng-sai (gõ y hệt nghĩa tiếng Việt là bắt lỗi giả, không đo được nhận biết).
  if(session.dirs&&session.dirs[session.i])session.dir=session.dirs[session.i];
  const o=OPT(); const pick=session.dir==='prod'?o.testProd:o.testRecog;
  const t = pick==='mix' ? ['write','mcq','tf'][session.i%3] : pick;
  if(t==='write')drawWriteTest();
  else if(t==='tf')drawTFTest();
  else drawMCQTest();
}
function drawTFTest(){
  const c=session.cards[session.i];const {q,a}=askAnswer(c,session.dir);
  setProg(session.i/session.cards.length);
  // 50% hiện đáp án đúng, 50% hiện đáp án của thẻ khác
  const isTrue=Math.random()<0.5;
  let shown=a;
  if(!isTrue){
    const others=session.set.cards.filter(x=>x.id!==c.id);
    if(others.length){const o=others[Math.floor(Math.random()*others.length)];
      shown=session.dir==='prod'?o.term:o.def;}
  }
  const truth=norm(shown)===norm(a);
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">Câu ${session.i+1}/${session.cards.length} · đúng/sai</p>
    <div class="flash" style="min-height:110px;cursor:default">
      <div class="big" style="font-size:21px">${esc(q)}</div>
      <div class="sub" style="margin-top:10px;font-size:19px">➜ <b>${esc(shown)}</b></div></div>
    <div class="opts" id="tfo"></div><div id="tFb" style="margin-top:8px"></div>`;
  sayQ(c);
  const oc=document.getElementById('tfo');
  [['✓ Đúng',true],['✗ Sai',false]].forEach(([lab,val],ki)=>{
    const b=document.createElement('button');b.className='opt';b.textContent=lab;b.dataset.k=ki+1;
    b.onclick=()=>{
      const ok=(val===truth);
      [...oc.children].forEach(x=>x.style.pointerEvents='none');
      bumpCard(c,ok,session.dir);touchActivity();if(session.dir==='prod')speak(c.term);
      if(ok){session.correct++;b.classList.add('correct');}
      else{b.classList.add('wrong');c.starred=true;
        document.getElementById('tFb').innerHTML=`<span class="pill broken">✗</span> Đáp án đúng của "${esc(q)}" là: <b>${esc(a)}</b>`;}
      saveResume();setTimeout(()=>nextTest(),ok?450:1200);};
    oc.appendChild(b);});
}
function drawMCQTest(){
  const c=session.cards[session.i];const {q,a}=askAnswer(c,session.dir);
  const wrongs=shuffle(session.set.cards.filter(x=>x.id!==c.id)).slice(0,3).map(x=>session.dir==='prod'?x.term:x.def);
  const opts=shuffle([a,...wrongs]);setProg(session.i/session.cards.length);
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">Câu ${session.i+1}/${session.cards.length} · trắc nghiệm</p>
    <div class="flash" style="min-height:90px;cursor:default"><div class="big" style="font-size:22px">${esc(q)}</div></div><div class="opts" id="mo"></div>`;
  sayQ(c);
  const oc=document.getElementById('mo');
  opts.forEach((o,ki)=>{const b=document.createElement('button');b.className='opt';b.textContent=o;b.dataset.k=ki+1;
    b.onclick=()=>{const ok=norm(o)===norm(a);[...oc.children].forEach(x=>{x.style.pointerEvents='none';if(norm(x.textContent)===norm(a))x.classList.add('correct');});
      bumpCard(c,ok,session.dir);touchActivity();if(session.dir==='prod')speak(c.term);
      if(ok)session.correct++;else{b.classList.add('wrong');c.starred=true;}
      saveResume();setTimeout(()=>nextTest(),ok?450:850);};oc.appendChild(b);});
}
function drawWriteTest(){
  const c=session.cards[session.i];const {q}=askAnswer(c,session.dir);setProg(session.i/session.cards.length);
  const body=document.getElementById('quizBody');
  body.innerHTML=`<p class="tag">Câu ${session.i+1}/${session.cards.length} · viết</p>
    <div class="flash" style="min-height:80px;cursor:default"><div class="big" style="font-size:22px">${esc(q)}</div></div>
    <div class="row" style="margin-top:12px"><input id="tIn" placeholder="Gõ đáp án..." autocomplete="off" style="flex:1"><button class="btn" id="tChk">OK</button></div><div id="tFb" style="margin-top:8px"></div>`;
  const inp=document.getElementById('tIn');inp.focus();sayQ(c);
  const check=()=>{const val=inp.value;const ok=isRight(c,session.dir,val);
    bumpCard(c,ok,session.dir);touchActivity();if(session.dir==='prod')speak(c.term);
    if(ok){session.correct++;inp.disabled=true;saveResume();setTimeout(()=>nextTest(),350);return;}
    c.starred=true;inp.disabled=true;inp.blur();saveResume();
    // FIX 14/09: sai → hiện đáp án + 2 nút: "Tôi đã gõ đúng" (hoàn lại) / "Tiếp". Không tự nhảy câu.
    document.getElementById('tFb').innerHTML=`<span class="pill broken">✗</span> Đáp án: <b>${esc(session.dir==='prod'?c.term:c.def)}</b>
      <div class="row" style="margin-top:8px"><button class="btn gray" id="tOverride">✔ Tôi đã gõ đúng ( \\ )</button><button class="btn" id="tNext">Tiếp → (Enter)</button></div>`;
    document.getElementById('tOverride').onclick=()=>{overrideRight(c,session.dir);session.correct++;saveResume();nextTest();};
    document.getElementById('tNext').onclick=()=>nextTest();};
  document.getElementById('tChk').onclick=check;inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!inp.disabled)check();});
}
function nextTest(){if(session.i<session.cards.length-1){session.i++;drawTestItem();}else{
  const pct=session.correct/session.cards.length*100;clearResume();
  const res=finishSession(session.set,'test',pct);
  const pass=pct>=S.settings.kpi;
  showResult((pass?'🎉 Đạt KPI!':'Chưa đạt KPI')+' — '+Math.round(pct)+'%',
    `Đúng ${session.correct}/${session.cards.length}. KPI = ${S.settings.kpi}%.<br>`+sessionSummary(session.set,res,'test',pct),
    pass);
}}
function setProg(f){document.getElementById('quizProg').style.width=Math.round(f*100)+'%';}
function showResult(title,html,good){
  showStudyPane('result');document.getElementById('resTitle').textContent=title;
  document.getElementById('resBody').innerHTML=`<div class="banner ${good?'b-good':'b-warn'}">${html}</div>`;
}
document.getElementById('resAgain').onclick=()=>startMode(session.mode);

/* ============================ TRANSLATE ============================ */
let pool=[];
function renderTranslate(){
  const sel=document.getElementById('pickSetSel');
  sel.innerHTML=S.sets.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
}
document.getElementById('pickToday').onclick=()=>{
  const cards=allCardsToday();
  if(!cards.length){toast('Hôm nay chưa có từ tới hạn');return;}
  pool=cards.map(c=>c.term);drawPool();
};
document.getElementById('pickSetBtn').onclick=()=>{const s=document.getElementById('pickSetSel');s.classList.toggle('hide');if(!s.classList.contains('hide')){s.onchange=()=>{const set=setById(s.value);pool=set.cards.map(c=>c.term);drawPool();};s.onchange();}};
function drawPool(){document.getElementById('wordPool').innerHTML=pool.length?('<b>'+pool.length+' từ:</b> '+pool.map(esc).join(' · ')):'Chưa chọn từ nào.';}
document.getElementById('copyGen').onclick=()=>{
  if(!pool.length){toast('Chọn từ trước đã');return;}
  const p=`Hãy viết cho tôi MỘT đoạn văn tiếng Anh ngắn (4–6 câu, trình độ khoảng B1, chủ đề IELTS thường gặp) dùng tự nhiên càng nhiều càng tốt các từ sau, KHÔNG cần dùng hết nếu bị gượng, và đừng làm đoạn dài quá: ${pool.join(', ')}.\nSau đó đừng dịch — để tôi tự dịch sang tiếng Việt. Chỉ in đoạn văn tiếng Anh thôi.`;
  copy(p);
};
document.getElementById('copyGrade').onclick=()=>{
  const para=document.getElementById('paraBox').value.trim(),tr=document.getElementById('transBox').value.trim();
  if(!para||!tr){toast('Cần có đoạn văn và bản dịch');return;}
  const p=`Tôi đang luyện đọc-hiểu tiếng Anh. Đây là đoạn văn:\n"""\n${para}\n"""\nĐây là bản dịch tiếng Việt của tôi:\n"""\n${tr}\n"""\nHãy chấm theo tiêu chí HIỂU ĐÚNG & ĐỦ Ý (đáp án linh hoạt, không bắt dịch từng chữ):\n1) Cho điểm /10 về độ chính xác nghĩa.\n2) Chỉ ra chỗ nào tôi hiểu sai hoặc bỏ sót, kèm nghĩa đúng.\n3) Trong các từ này: ${pool.join(', ')} — từ nào tôi dịch/nhận diện SAI? Liệt kê để tôi thêm vào deck.\nNgắn gọn, thẳng thắn.`;
  copy(p);
};
function copy(t){navigator.clipboard.writeText(t).then(()=>toast('Đã copy — dán vào khung chat với Claude')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Đã copy');});}

/* ============================ SETTINGS ============================ */
function renderSettings(){document.getElementById('setKpi').value=S.settings.kpi;document.getElementById('setTestN').value=S.settings.testN;
  const c=syncCode();document.getElementById('syncCode').value=c;
  if(c){const lp=localStorage.getItem('vocabvip.lastpush');
    syncStatus('✅ Đồng bộ: <b>'+esc(c)+'</b>'+(lp?' · đẩy lên gần nhất '+new Date(lp).toLocaleString('vi-VN'):' · chưa đẩy lần nào'));}
  else syncStatus('Chưa bật đồng bộ.');}
document.getElementById('saveSettings').onclick=()=>{
  S.settings.kpi=Math.max(50,Math.min(100,+document.getElementById('setKpi').value||80));
  S.settings.testN=Math.max(5,+document.getElementById('setTestN').value||20);save();toast('Đã lưu cài đặt');
};
/* ---- đếm thẻ, dùng cho cả xuất lẫn nhập ---- */
function countCards(o){try{return (o.sets||[]).reduce((n,s)=>n+((s.cards||[]).length),0);}catch(e){return 0;}}

document.getElementById('exportBtn').onclick=()=>{
  const text=JSON.stringify(S,null,2);
  // tự kiểm trước khi tải: chuỗi phải parse ngược lại được
  try{
    const back=JSON.parse(text);
    if(countCards(back)!==countCards(S)) throw new Error('lệch số thẻ');
  }catch(err){
    alert('❌ KHÔNG xuất được — dữ liệu trong máy đang lỗi.\nĐừng xóa cache. Báo lại lỗi này: '+err.message);
    return;
  }
  const nSets=(S.sets||[]).length, nCards=countCards(S);
  const blob=new Blob([text],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='kingston-vocab-backup-'+todayStr()+'.json';
  document.body.appendChild(a);           // Firefox cần link nằm trong DOM mới click được
  a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
  try{localStorage.setItem('vocabvip.lastexport',todayStr());}catch(err){} // FIX 13/09: nhớ ngày xuất backup để nhắc
  alert('✅ Đã xuất: '+nSets+' deck · '+nCards+' thẻ · '+text.length.toLocaleString()+' ký tự.\n\nMỞ FILE VỪA TẢI RA KIỂM TRA: dòng cuối phải là dấu }\nNếu file cụt giữa chừng thì backup đó HỎNG, xuất lại.');
};

document.getElementById('importFile').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onerror=()=>alert('❌ Không đọc được file (lỗi ổ đĩa hoặc file đang mở ở chỗ khác).');
  r.onload=()=>{
    const txt=r.result;
    let o;
    // 1. parse — báo ĐÚNG lỗi, không nuốt
    try{ o=JSON.parse(txt); }
    catch(err){
      const m=/position (\d+)/.exec(err.message);
      let extra='';
      if(m){
        const p=+m[1];
        extra='\n\nFile dài '+txt.length+' ký tự, chết ở ký tự '+p+
              (p>txt.length-50?'\n→ File bị CỤT ĐUÔI. Backup này hỏng, phải xuất lại từ máy còn dữ liệu.':'');
      }
      // FIX 11/11: Chrome báo "Unexpected end of JSON input" không kèm vị trí → tự nhận ra file cụt
      else if(!txt.trim().endsWith('}')){
        extra='\n\nFile dài '+txt.length+' ký tự nhưng KHÔNG kết thúc bằng dấu }\n→ File bị CỤT ĐUÔI. Backup này hỏng, phải xuất lại từ máy còn dữ liệu.';
      }
      alert('❌ File JSON hỏng.\n\n'+err.message+extra);
      e.target.value=''; return;
    }
    // 2. kiểm + chuẩn hoá cấu trúc (FIX 11/11: đắp phần thiếu để file cũ/khác phiên bản không làm sập app)
    const n=normalize(o);
    if(!n){ alert('❌ Không phải file backup của app này (thiếu mục "sets").'); e.target.value=''; return; }
    o=n.data;
    // 3. giống hệt dữ liệu đang có → khỏi nhập
    if(JSON.stringify(o)===JSON.stringify(S)){ toast('File giống hệt dữ liệu đang có — không cần nhập'); e.target.value=''; return; }
    // 4. so sánh ĐỘ MỚI, không chỉ số thẻ (FIX 11/11: cùng 175 thẻ vẫn có thể là bản cũ hơn cả tháng)
    const a=summarize(o), b=summarize(S);
    const warns=[];
    if(a.cards<b.cards)     warns.push('file có ÍT THẺ HƠN ('+a.cards+' < '+b.cards+')');
    if(a.answers<b.answers) warns.push('file có ÍT LƯỢT TRẢ LỜI HƠN ('+a.answers+' < '+b.answers+') → tiến độ cũ hơn');
    if(b.last&&a.last<b.last) warns.push('lần học gần nhất trong file ('+(a.last?fmt(a.last):'chưa học')+') CŨ HƠN máy này ('+fmt(b.last)+')');
    let msg='Sắp NHẬP:\n  '+summaryLine(a)+'\n\nĐang có:\n  '+summaryLine(b)+'\n\n'+
            'Nhập backup sẽ THAY THẾ toàn bộ dữ liệu hiện tại.';
    if(n.fixes.length) msg+='\n\nĐã tự vá trong file: '+n.fixes.slice(0,5).join('; ')+(n.fixes.length>5?' (+'+(n.fixes.length-5)+' mục)':'');
    if(warns.length) msg='🚨 CẢNH BÁO — file này có vẻ CŨ HƠN dữ liệu đang có:\n  • '+warns.join('\n  • ')+'\n\n'+msg+'\n\nNhập vào là MẤT phần tiến độ mới hơn. Chắc chưa?';
    if(!confirm(msg+'\n\nOK để tiếp tục.')){ e.target.value=''; return; }
    // 5. lưu bản cũ để hoàn tác được — lưu KHÔNG được thì dừng, không nhập mù
    try{ localStorage.setItem(KEY+'.beforeimport', JSON.stringify(S)); }
    catch(err){ if(!confirm('⚠️ Không cất được bản hiện tại để hoàn tác (bộ nhớ đầy?).\nXuất backup trước rồi hãy nhập.\n\nVẫn nhập (KHÔNG hoàn tác được)?')){ e.target.value=''; return; } }
    // 6. nhập: chạy luôn các bước xếp lịch như lúc mở app, để màn Hôm nay đúng ngay
    S=o; save();
    toast('✅ Đã nhập '+a.cards+' thẻ — sai thì bấm ↩️ Hoàn tác');
    showView('today');
    e.target.value='';
  };
  r.readAsText(f);
};

/* ---- nút đồng bộ ---- */
document.getElementById('syncNew').onclick=()=>{
  const c=newSyncCode();
  document.getElementById('syncCode').value=c;
  toast('Đã tạo mã — bấm Lưu mã để bật');
};
document.getElementById('syncSave').onclick=async()=>{
  const c=document.getElementById('syncCode').value.trim();
  if(!c){toast('Nhập mã đã');return;}
  setSyncCode(c);
  syncStatus('⏳ Đang kiểm tra mã <b>'+esc(c)+'</b>...');
  try{
    const row=await fetchCloud();
    if(row) await pullCloud(true);
    else { syncStatus('☁️ Mã mới <b>'+esc(c)+'</b> — chưa có dữ liệu trên mây.'); await pushCloud(false); }
  }catch(e){ syncStatus('⚠️ Không kết nối được: '+esc(e.message)+'<br><span class="tag">Nếu đang mở bằng file:// thì phải chạy qua https (GitHub Pages).</span>'); }
};
document.getElementById('syncPush').onclick=()=>pushCloud(false);
document.getElementById('syncPull').onclick=()=>pullCloud(true);
document.getElementById('syncOff').onclick=()=>{
  if(!confirm('Tắt đồng bộ trên máy này? Dữ liệu trong máy giữ nguyên, trên mây cũng giữ nguyên.'))return;
  setSyncCode(''); document.getElementById('syncCode').value='';
  syncStatus('Chưa bật đồng bộ.'); toast('Đã tắt đồng bộ');
};

document.getElementById('undoImport').onclick=()=>{
  const raw=localStorage.getItem(KEY+'.beforeimport');
  if(!raw){ alert('Không có bản nào để hoàn tác.'); return; }
  if(!confirm('Quay lại trạng thái NGAY TRƯỚC lần nhập gần nhất?')) return;
  try{ const nu=normalize(JSON.parse(raw)); if(!nu)throw new Error('thiếu mục "sets"'); S=nu.data; save(); toast('Đã hoàn tác'); showView('today'); }
  catch(err){ alert('Bản lưu tạm cũng hỏng: '+err.message); }
};
document.getElementById('resetAll').onclick=()=>{if(confirm('Xóa sạch TOÀN BỘ học phần và tiến độ? Không nạp lại deck nào — app sẽ trống trơn. Nhớ Xuất backup trước.')){S=seed();save();showView('today');}};

/* ============================ UTIL ============================ */
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
document.addEventListener('keydown',e=>{
  if(document.getElementById('studyFlash').classList.contains('hide'))return;
  if(e.code==='Space'){e.preventDefault();flashFlipped=!flashFlipped;drawFlash();}
  if(e.code==='ArrowRight')document.getElementById('flashNext').click();
  if(e.code==='ArrowLeft')document.getElementById('flashPrev').click();
});

/* ===== BÀN PHÍM CHO PANE HỌC (thêm 18/09/2026) =====
   1-4 chọn đáp án · Enter đi tiếp · \ = "tôi đã nhớ đúng" · Space nghe lại.
   Mục tiêu: 2 tay ở yên trên bàn phím, không rời sang chuột. */
function kbQuizOpen(){const q=document.getElementById('studyQuiz');return q&&!q.classList.contains('hide');}
function kbOpts(){
  for(const id of ['lo','mo','tfo']){
    const el=document.getElementById(id);
    if(el&&el.children.length)return [...el.children];
  }
  return null;
}
function kbFirstBtn(ids){
  for(const id of ids){const b=document.getElementById(id);if(b&&!b.classList.contains('hide'))return b;}
  return null;
}
function kbCard(){
  if(!session)return null;
  if(session.queue&&session.queue.length&&session.queue[0].card)return session.queue[0].card;
  if(session.cards&&session.cards.length)return session.cards[session.i];
  return null;
}
document.addEventListener('keydown',e=>{
  if(!kbQuizOpen())return;
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  const t=e.target,inField=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA');

  /* \ — chạy được KỂ CẢ khi con trỏ đang nằm trong ô nhập (chế độ Viết bắt gõ lại) */
  if(e.key==='\\'){
    const ov=kbFirstBtn(['wOverride','tOverride','lOverride']);
    if(ov){e.preventDefault();ov.click();}
    return;
  }
  if(inField)return;   /* đang gõ đáp án thì để yên cho gõ */

  if(e.key>='1'&&e.key<='4'){
    const opts=kbOpts();
    if(opts){
      const b=opts[+e.key-1];
      if(b&&b.style.pointerEvents!=='none'){e.preventDefault();b.click();}
    }
    return;
  }
  if(e.key==='Enter'){
    const nx=kbFirstBtn(['lNext','tNext']);
    if(nx){e.preventDefault();nx.click();}
    return;
  }
  if(e.code==='Space'){
    const c=kbCard();
    if(c){e.preventDefault();speak(c.term);}
  }
});

/* ============================ INIT ============================ */
showView('today');
if(syncCode()){ syncStatus('⏳ Đang kiểm tra đám mây...'); pullCloud(false).finally(()=>{startupPullDone=true;}); }
else startupPullDone=true;
