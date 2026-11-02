// ============================================================
// EVENT BOARD (이벤트)
// 쉬고 돌아온 사람이 "쉬는 동안 올라온 이벤트"를 한 번에 확인하는 화면.
// 데이터: Supabase events 테이블 / AI 정리: 기존 Gemini 키(getGeminiKey) 재사용
// ============================================================
const EventBoard = (() => {
  const CATS = ['할인/프로모션', '사은품', '교육/공지', '기타'];
  const OPEN = '9999-12-31';                 // 종료일 없음: 비교·정렬이 그대로 되도록 먼 미래 날짜로 다룸 (DB에는 null)
  const EV_MODEL = 'gemini-2.5-flash-lite';  // 환불 상신 문구 생성과 같은 모델
  const TABS = [['new', '새 이벤트'], ['on', '진행중'], ['soon', '예정'], ['end', '종료'], ['all', '전체']];
  const WD = '일월화수목금토';

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
  const md = d => d.slice(5).replace('-', '.');
  const wd = d => { const [y, m, x] = d.split('-').map(Number); return WD[new Date(y, m - 1, x).getDay()]; };
  const fmtTs = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dateVal = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const norm = s => String(s).replace(/\s/g, '').toLowerCase();
  const active = () => $('#page-events')?.classList.contains('active');

  // 내 매장·"여기까지 확인함" 시각은 이 기기에만 저장. 처음이면 7일 전부터 보여 줌
  let events = [], loaded = false, loadError = false;
  let tab = 'on', tabInit = false, query = '';
  let myStore = ls('l24_ev_store') || '', onlyTodo = false, onlyMine = false;
  let since = +ls('l24_ev_last') || (Date.now() - 7 * 864e5);
  let editing = null, draftRaw = '';
  const openIds = new Set();

  // ---------- 날짜·상태 ----------
  const status = e => { const t = today(); return e.end < t ? 'end' : e.start > t ? 'soon' : 'on'; };
  const isNew = e => e.created > since;
  const pending = e => (e.checks || []).filter(c => !c.d).length;
  const exHits = e => !myStore ? [] : (e.excluded || []).filter(x => { const a = norm(x), b = norm(myStore); return a && b && (a.includes(b) || b.includes(a)); });
  const exMine = e => exHits(e).length > 0;

  // 적용일 텍스트("10/23, 10/25" 또는 "2026-10-23") ↔ ISO 날짜 배열. 연도 없으면 y 사용
  const parseDays = (txt, y) => [...new Set([...txt.matchAll(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/g)].map(m => `${m[1] || y}-${pad(m[2])}-${pad(m[3])}`))].sort();
  const daysToText = ds => (ds || []).map(d => `${+d.slice(5, 7)}/${+d.slice(8)}`).join(', ');
  const checksToText = c => (c || []).map(x => x.t).join('\n');
  const faqToText = f => (f || []).map(x => `Q. ${x.q}\nA. ${x.a}`).join('\n\n');
  const textToFaq = t => t.split(/\n\s*\n/).map(b => { const m = b.match(/^\s*Q\.?\s*([\s\S]*?)\n\s*A\.?\s*([\s\S]*)$/); return m ? { q: m[1].trim(), a: m[2].trim() } : null; }).filter(Boolean);

  // 입력한 매장명을 매장 목록의 정식 명칭으로 맞춤 (애매하면 입력 그대로)
  function canonStore(n) {
    const nn = norm(n);
    if (!nn || typeof STORES === 'undefined' || !STORES.length) return n.trim();
    const exact = STORES.find(s => norm(s.name) === nn);
    if (exact) return exact.name;
    if (nn.length >= 2) {
      const c = STORES.filter(s => norm(s.name).includes(nn) || nn.includes(norm(s.name)));
      if (c.length === 1) return c[0].name;
    }
    return n.trim();
  }
  const splitNames = t => t.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const knownStore = n => typeof STORES === 'undefined' || !STORES.length || STORES.some(s => s.name === n);

  // ---------- DB ----------
  const fromRow = r => ({
    id: r.id, title: r.title, start: r.start_date, end: r.end_date || OPEN,
    days: (r.apply_days || []).slice().sort(), category: r.category, body: r.body || '',
    excluded: r.excluded || [], checks: r.checks || [], faq: r.faq || [],
    link: r.link || '', raw: r.raw || '', created: Date.parse(r.created_at),
  });
  const toRow = d => ({
    title: d.title, start_date: d.start, end_date: d.end === OPEN ? null : d.end,
    apply_days: d.days, category: d.category, body: d.body, excluded: d.excluded,
    checks: d.checks, faq: d.faq, link: d.link, raw: d.raw,
  });

  async function load() {
    try {
      const rows = await sbFetch('events?select=*&order=created_at.desc');
      events = (rows || []).map(fromRow);
      loaded = true; loadError = false;
    } catch (e) {
      loadError = true;
    }
    renderNavBadge();
    if (active()) render();
  }

  function renderNavBadge() {
    const n = events.filter(isNew).length, el = $('#ev-nav-n');
    if (!el) return;
    el.textContent = n; el.style.display = n ? '' : 'none';
  }

  // ---------- 목록 ----------
  function badge(e, s) {
    const t = dayNum(today());
    if (s === 'end') return ['end', '종료'];
    if (e.days.length) {   // 특정 일자만 적용: 오늘이 적용일인지, 다음 적용일이 언제인지
      const td = today();
      if (e.days.includes(td)) return ['on', '오늘 적용'];
      const nx = e.days.find(d => d > td), n = dayNum(nx) - t;
      return ['soon', n === 1 ? '내일 적용' : n + '일 후 적용'];
    }
    if (s === 'soon') { const n = dayNum(e.start) - t; return ['soon', n === 1 ? '내일 시작' : n + '일 후 시작']; }
    if (e.end === OPEN) return ['on', '진행중'];
    const n = dayNum(e.end) - t;
    return n === 0 ? ['urgent', '오늘 마감'] : n === 1 ? ['urgent', '내일 마감'] : ['on', n + '일 남음'];
  }

  function whenLine(e) {
    if (e.days.length) {
      const td = today();
      return `<div class="ev-when"><b>특정 일자만 적용</b><span class="ev-dch">${e.days.map(d => `<i class="${d === td ? 'now' : d < td ? 'past' : ''}">${md(d)}(${wd(d)})</i>`).join('')}</span></div>`;
    }
    if (e.end === OPEN) return `<div class="ev-when">${e.start.slice(0, 4)}.${md(e.start)} ~ 종료일 미정</div>`;
    return `<div class="ev-when">${e.start.slice(0, 4)}.${md(e.start)} ~ ${e.start.slice(0, 4) === e.end.slice(0, 4) ? '' : e.end.slice(0, 4) + '.'}${md(e.end)}</div>`;
  }

  function card(e) {
    const s = status(e), [bc, bt] = badge(e, s), ch = e.checks, faq = e.faq, pend = pending(e), mine = exMine(e);
    const hits = exHits(e);
    return `<details class="ev-row ${s}${mine ? ' mine' : ''}" data-id="${e.id}"${openIds.has(e.id) ? ' open' : ''}>
  <summary class="ev-head">
    <div class="ev-c1"><span class="ev-st ${bc}"><i></i>${bt}</span>${whenLine(e)}</div>
    <div class="ev-c2"><h3>${esc(e.title)}</h3>
      ${e.body ? `<p class="ev-pv">${esc(e.body)}</p>` : ''}
      <div class="ev-meta"><span>${esc(e.category)}</span>${e.excluded.length ? `<span class="ev-exn">미참여 ${e.excluded.length}곳</span>` : ''}<span>${fmtTs(e.created)} 등록</span></div></div>
    <div class="ev-c3">${isNew(e) ? '<span class="ev-tg new">NEW</span>' : ''}${mine ? `<span class="ev-tg mine">미참여 · ${esc(hits.slice(0, 2).join(', '))}${hits.length > 2 ? ` 외 ${hits.length - 2}곳` : ''}</span>` : ''}${pend ? `<span class="ev-tg chk">확인 필요 ${pend}</span>` : ''}<span class="ev-caret">▼</span></div>
  </summary>
  <div class="ev-more">
    ${/^https?:\/\//.test(e.link) ? `<a class="ev-lnk" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">슬랙 공지 원문 열기 ↗</a>` : ''}
    ${e.body ? `<div class="ev-sec"><h4 class="mono">내용</h4><p class="ev-body">${esc(e.body)}</p></div>` : ''}
    ${e.excluded.length ? `<div class="ev-sec"><h4 class="mono">미참여 매장 ${e.excluded.length}곳</h4><div class="ev-exset">${e.excluded.map(x => `<span class="${exMine({ excluded: [x] }) ? 'me' : ''}">${esc(x)}</span>`).join('')}</div></div>` : ''}
    ${ch.length ? `<div class="ev-todo"><h4 class="mono">추가 확인 필요</h4>${ch.map((c, i) => `<div class="ev-ci"><label><input type="checkbox" data-evchk="${e.id}:${i}"${c.d ? ' checked' : ''}><span class="${c.d ? 'done' : ''}">${esc(c.t)}</span></label><button type="button" class="ev-x" data-evdelchk="${e.id}:${i}" title="이 항목 삭제" aria-label="이 항목 삭제">✕</button></div><input class="input ev-note" data-evnote="${e.id}:${i}" maxlength="300" value="${esc(c.n || '')}" placeholder="확인 결과 메모 (누구에게 어떻게 답변받았는지)" aria-label="확인 결과 메모">`).join('')}</div>` : ''}
    ${faq.length ? `<details class="ev-sub"><summary class="mono">고객 예상 질문 ${faq.length}개</summary>${faq.map(x => `<div class="ev-qa"><div class="q">Q. ${esc(x.q)}</div><div class="a">${esc(x.a)}</div><button type="button" class="btn btn-sm" data-evcopy="${esc(x.a)}">답변 복사</button></div>`).join('')}</details>` : ''}
    ${e.raw ? `<details class="ev-sub"><summary class="mono">공지 원문</summary><div class="ev-raw">${esc(e.raw)}</div></details>` : ''}
    <div class="ev-acts"><button type="button" class="btn btn-sm" data-evedit="${e.id}">수정</button><button type="button" class="btn btn-sm btn-danger-ghost" data-evdel="${e.id}">삭제</button></div>
  </div></details>`;
  }

  function match(e) {
    if (!query) return true;
    return [e.title, e.body, e.category, ...e.excluded, ...e.faq.map(f => f.q)].join(' ').toLowerCase().includes(query);
  }

  function render() {
    const list = $('#ev-list');
    if (!list) return;
    if (loadError && !loaded) { list.innerHTML = '<div class="empty">이벤트를 불러오지 못했습니다. Supabase에 events 테이블이 만들어져 있는지 확인해 주세요.</div>'; return; }
    if (!loaded) { list.innerHTML = '<div class="empty">불러오는 중…</div>'; return; }

    const cnt = { new: 0, on: 0, soon: 0, end: 0, all: events.length };
    events.forEach(e => { cnt[status(e)]++; if (isNew(e)) cnt.new++; });
    if (!tabInit) { tab = cnt.new ? 'new' : 'on'; tabInit = true; }   // 새 이벤트가 있으면 그것부터 보여 줌

    $('#ev-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" class="seg-btn${k === tab ? ' on' : ''}" data-evtab="${k}">${l}<span class="chip-n">${cnt[k]}</span></button>`).join('');
    const live = events.filter(e => status(e) !== 'end');
    const todoN = live.filter(pending).length;
    $('#ev-chips').innerHTML = `<button type="button" class="chip${onlyTodo ? ' on' : ''}" data-evf="todo">확인 필요만<span class="chip-n">${todoN}</span></button>` +
      (myStore ? `<button type="button" class="chip${onlyMine ? ' on' : ''}" data-evf="mine">미참여 이벤트 숨기기</button>` : '');

    const td = today();
    const pri = e => e.days.length ? (e.days.includes(td) ? 0 : 2) : 1;   // 진행중: 오늘 적용 → 그 외 → 특정 일자만(오늘 아님)
    const rank = { on: 0, soon: 1, end: 2 };
    const inTab = e => tab === 'all' || (tab === 'new' ? isNew(e) : status(e) === tab);
    const rows = events.filter(e => inTab(e) && match(e) && (!onlyTodo || pending(e)) && (!onlyMine || !exMine(e))).sort((a, b) => {
      if (tab === 'new') return b.created - a.created;
      const sa = status(a), sb = status(b);
      if (sa !== sb) return rank[sa] - rank[sb];
      if (sa === 'on' && pri(a) !== pri(b)) return pri(a) - pri(b);
      return sa === 'end' ? b.end.localeCompare(a.end) : sa === 'soon' ? a.start.localeCompare(b.start) : a.end.localeCompare(b.end);
    });

    const chgOpen = $('#ev-chg')?.open;   // 다시 그려도 "기준 변경" 펼침 유지
    $('#ev-catch').innerHTML = tab === 'new' ? `<div class="ev-catch"><div class="ev-ct"><i class="ev-cdot"></i><span><b>${fmtTs(since)}</b> 이후 새 이벤트 <b>${cnt.new}</b>건</span></div>
      <div class="ev-cr">${cnt.new ? '<button type="button" class="btn btn-primary" data-evseen>모두 확인했어요</button>' : ''}
      <details class="ev-chg" id="ev-chg"${chgOpen ? ' open' : ''}><summary>기준 변경</summary><div class="ev-cr2"><input type="date" class="input" id="ev-sd" value="${dateVal(since)}" max="${td}" aria-label="여기부터 보기">
      <button type="button" class="chip" data-evago="1">어제부터</button><button type="button" class="chip" data-evago="3">3일 전부터</button><button type="button" class="chip" data-evago="7">1주 전부터</button></div>
      <div class="ev-hint">기준 시각은 이 기기에만 저장됩니다.</div></details></div></div>` : '';

    const filtered = query || onlyTodo || onlyMine;
    list.innerHTML = rows.length ? rows.map(card).join('') :
      `<div class="empty">${filtered ? '조건에 맞는 이벤트가 없습니다. 검색어나 필터를 해제해 보세요.' : tab === 'new' ? '이 기간에 새로 올라온 이벤트가 없습니다. 진행중 탭에서 현재 이벤트를 확인해 보세요.' : tab === 'all' ? '아직 등록된 이벤트가 없습니다. 오른쪽 위 “이벤트 추가”로 공지를 붙여넣어 보세요.' : tab === 'on' ? '지금 진행 중인 이벤트가 없습니다. 예정 탭에서 곧 시작할 이벤트를 확인해 보세요.' : '이 분류에 해당하는 이벤트가 없습니다.'}</div>`;
  }

  // ---------- 등록/수정 팝업 ----------
  function openForm(e) {
    editing = e ? e.id : null; draftRaw = e?.raw || '';
    const v = e || { title: '', start: today(), end: today(), category: CATS[0], body: '', excluded: [], checks: [], faq: [], days: [], link: '' };
    const endless = v.end === OPEN;
    $('#ev-dlg').innerHTML = `<form id="evf" autocomplete="off">
    <div class="dlg-hd"><div><div class="dlg-kicker mono">EVENT / ${e ? 'EDIT' : 'NEW'}</div><div class="dlg-title dlg-title-lg">${e ? '이벤트 수정' : '이벤트 추가'}</div></div>
      <button type="button" class="dlg-x" data-evclose title="닫기">✕</button></div>
    <div class="dlg-bd">
    ${!e ? `<div class="ev-ai"><div class="field" style="margin-bottom:0"><label for="evf-raw">공지 붙여넣기</label><textarea id="evf-raw" class="input" rows="6" placeholder="슬랙 공지 내용을 그대로 붙여넣으세요"></textarea></div>
      <div class="ev-aifoot"><span class="ev-hint" id="evf-aih">붙여넣고 누르면 아래 항목이 자동으로 채워집니다.</span><button type="button" class="btn btn-primary" id="evf-ai" data-evai>AI로 정리</button></div></div>` : ''}
    <div class="field"><label for="evf-title">이벤트명</label><input id="evf-title" class="input input-lg" required maxlength="80" value="${esc(v.title)}"></div>
    <div class="ev-row3">
      <div class="field"><label for="evf-start">시작일</label><input id="evf-start" type="date" class="input input-lg" required value="${v.start}"></div>
      <div class="field"><div class="ev-lh"><label for="evf-end">종료일</label><label class="ev-inl" for="evf-endless"><input type="checkbox" id="evf-endless"${endless ? ' checked' : ''}>종료일 없음</label></div><input id="evf-end" type="date" class="input input-lg" value="${endless ? '' : v.end}"${endless ? ' disabled' : ''}></div>
      <div class="field"><label for="evf-cat">분류</label><select id="evf-cat" class="input input-lg">${CATS.map(c => `<option${c === v.category ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="evf-body">내용 <span class="ev-hint">(대상, 혜택, 조건 요약)</span></label><textarea id="evf-body" class="input" rows="5" maxlength="2000">${esc(v.body)}</textarea></div>
    <div class="field"><label for="evf-ex">미참여 매장 <span class="ev-hint">(쉼표 또는 줄바꿈으로 구분 · 저장할 때 매장 목록의 정식 이름으로 맞춰요)</span></label><textarea id="evf-ex" class="input" rows="2" list="ev-stores">${esc(v.excluded.join(', '))}</textarea><div class="ev-hint" id="evf-exh"></div></div>
    <details class="ev-adv" id="evf-adv"${e && (v.days.length || v.link || v.checks.length || v.faq.length) ? ' open' : ''}><summary>더 입력하기 (특정 적용일, 슬랙 링크, 확인 필요, 예상 질문)</summary><div class="ev-advbody">
      <div class="field"><label for="evf-days">특정 일자만 적용될 때 <span class="ev-hint">(예: 10/23, 10/25, 10/30)</span></label><input id="evf-days" class="input" value="${esc(daysToText(v.days))}" placeholder="기간 내내 적용이면 비워 두세요"><div class="ev-hint">입력하면 시작일·종료일은 첫날~마지막날로 자동 설정되고, 카드에는 적용일만 표시됩니다.</div></div>
      <div class="field"><label for="evf-link">슬랙 공지 링크</label><input id="evf-link" type="url" class="input" placeholder="https://… 슬랙 메시지 링크 복사해서 붙여넣기" value="${esc(v.link)}"></div>
      <div class="field"><label for="evf-checks">추가 확인 필요 <span class="ev-hint">(한 줄에 하나)</span></label><textarea id="evf-checks" class="input" rows="3">${esc(checksToText(v.checks))}</textarea></div>
      <div class="field"><label for="evf-faq">고객 예상 질문 <span class="ev-hint">(Q. 질문 / A. 답변, 질문 사이는 빈 줄)</span></label><textarea id="evf-faq" class="input" rows="8">${esc(faqToText(v.faq))}</textarea></div>
    </div></details>
    <div class="alert alert-error" id="evf-msg" style="display:none;margin:14px 0 0"></div>
    <div class="dlg-actions"><button type="button" class="btn btn-lg" data-evclose>취소</button><button type="submit" class="btn btn-lg btn-primary" id="evf-save">${e ? '저장' : '추가'}</button></div>
    </div></form>`;
    $('#ev-form-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    (!e ? $('#evf-raw') : $('#evf-title')).focus();
    showUnknown();
  }

  function closeForm() {
    $('#ev-form-overlay').style.display = 'none';
    $('#ev-dlg').innerHTML = '';
    document.body.style.overflow = '';
  }

  // 매장 목록에 없는 이름이 있으면 안내
  function showUnknown() {
    const el = $('#evf-exh'); if (!el) return;
    const bad = splitNames($('#evf-ex').value).map(canonStore).filter(n => !knownStore(n));
    el.textContent = bad.length ? `매장 목록에 없는 이름: ${bad.join(', ')} (그대로 저장돼요)` : '';
  }

  function showMsg(t) { const m = $('#evf-msg'); m.textContent = t; m.style.display = t ? 'block' : 'none'; }

  async function save() {
    const old = editing ? events.find(x => x.id === editing) : null;
    const checks = $('#evf-checks').value.split('\n').map(s => s.trim()).filter(Boolean)
      .map(t => { const o = old?.checks.find(x => x.t === t); return { t, d: !!o?.d, n: o?.n || '' }; });  // 문구가 같으면 체크·메모 유지
    const d = {
      title: $('#evf-title').value.trim(), start: $('#evf-start').value, end: $('#evf-end').value,
      category: $('#evf-cat').value, body: $('#evf-body').value.trim(),
      excluded: [...new Set(splitNames($('#evf-ex').value).map(canonStore))],
      checks, faq: textToFaq($('#evf-faq').value), raw: draftRaw, link: $('#evf-link').value.trim(),
    };
    if ($('#evf-endless').checked) d.end = OPEN;
    const days = parseDays($('#evf-days').value, $('#evf-start').value.slice(0, 4));
    if (days.length) { d.start = days[0]; d.end = days[days.length - 1]; }
    d.days = days;
    if (!d.title) return showMsg('이벤트명을 입력해 주세요.');
    if (!d.start) return showMsg('시작일을 입력해 주세요.');
    if (!d.end) return showMsg('종료일을 입력하거나 “종료일 없음”을 체크해 주세요.');
    if (d.end < d.start) return showMsg('종료일이 시작일보다 빠릅니다.');
    const btn = $('#evf-save'); btn.disabled = true; showMsg('');
    try {
      if (editing) {
        await sbFetch('events?id=eq.' + editing, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(toRow(d)) });
      } else {
        const { data: { session } } = await sbClient.auth.getSession();
        await sbFetch('events', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ ...toRow(d), created_by: session?.user?.email || null }) });
      }
      closeForm();
      showToast(editing ? '이벤트를 수정했습니다' : '이벤트를 추가했습니다');
      await load();
    } catch (e) {
      showMsg('저장하지 못했습니다: ' + (e.message || e));
      btn.disabled = false;
    }
  }

  // ---------- AI 정리 (기존 Gemini 키 재사용) ----------
  function buildPrompt(raw) {
    const stores = (typeof STORES !== 'undefined' ? STORES : []).map(s => s.name).join(', ');
    return `당신은 세탁 서비스 매장 직원 팀을 돕는 도우미입니다. 아래 본사/매장 공지를 읽고 JSON 하나만 출력하세요.
오늘 날짜: ${today()}. 공지에 연도가 없으면 오늘 기준 가장 가까운 미래 또는 진행 중인 연도로 해석하세요.
형식: {"title":"이벤트명(짧게)","start":"YYYY-MM-DD","end":"YYYY-MM-DD","days":["YYYY-MM-DD"],"category":"${CATS.join('|')} 중 하나","body":"직원이 빠르게 읽을 요약. 대상, 혜택, 조건, 제외 사항 중심으로 줄바꿈 포함 5줄 이내","excluded":["공지에 적힌 미참여(제외) 매장명. 없으면 빈 배열"],"checks":["공지에 없거나 모호해서 직원이 본사/점장에게 추가로 확인해야 할 사항"],"faq":[{"q":"고객이 실제로 할 법한 질문","a":"공지에 근거한 답변. 공지에 답이 없으면 '공지에 없음, 확인 필요'라고 쓸 것"}]}
규칙: 이벤트가 기간 중 특정 날짜에만 적용되면(예: 10/23, 10/25, 10/30만 할인) days에 그 날짜들을 모두 넣고, start/end는 첫날/마지막날로 하세요. 기간 내내 적용이면 days는 빈 배열입니다. 기간 전체가 대상인 것처럼 오해될 수 있으니 body에도 적용일을 명확히 쓰세요. 공지에 없는 내용을 지어내지 말 것. 시작일이 공지에 없으면 빈 문자열로 두고 checks에 넣을 것. 종료일이 공지에 없으면 end를 빈 문자열로 두세요(화면에서 '종료일 미정'으로 처리되므로 checks에는 넣지 않음). 미참여 매장명은 아래 매장 목록에 있는 정식 이름과 가장 가까운 것으로 맞춰 쓰세요(목록에 없으면 공지에 적힌 그대로). 이 매장 팀에는 멤버십(회원 등급·적립·포인트)과 제휴 할인(카드사·통신사·제휴사 할인)이 없습니다. 따라서 checks와 faq에서 멤버십·제휴 할인 관련 항목(병행 가능 여부, 적립, 카드·통신사 할인 등)은 만들지 말고, 공지가 멤버십이나 제휴 할인을 언급해도 해당 조건은 확인 항목으로 삼지 마세요. 이 팀은 세탁 서비스 업체이고 환불·취소·교환이 없습니다. 환불·취소·교환 관련 항목은 checks에 넣지 말고, 고객이 물을 만한 경우 faq 답변은 '환불·취소·교환은 불가'로 쓰세요. 공지에 최소 금액·수량 등 적용 조건이 있으면, checks에 '일부 세탁물이 반려되어 조건 미만의 세탁물만 세탁·과금된 경우 혜택·세탁비 처리'를 한 항목으로 넣으세요(아직 본사 답변 전인 확인 사항입니다). 그 외 checks는 최대 5개, 공지에서 실제로 빠졌거나 모호해서 직원이 판단하기 어려운 것만(제외 품목, 수량 한도, 적용 매장, 기간·시간 조건, 수거·배송 일정 영향 등). 해당하는 것이 없으면 적게 내거나 빈 배열로 두세요. faq는 6~10개, 답변은 고객에게 바로 말할 수 있는 한두 문장.
매장 목록: ${stores}
공지:
"""
${raw}
"""`;
  }

  async function organize() {
    const raw = $('#evf-raw').value.trim(), hint = $('#evf-aih');
    if (!raw) { hint.textContent = '공지 내용을 먼저 붙여넣어 주세요.'; return; }
    const btn = $('#evf-ai'); btn.disabled = true; btn.textContent = '정리 중…'; hint.textContent = '';
    try {
      const key = await getGeminiKey();
      if (!key) throw new Error('Gemini API 키를 불러오지 못했습니다');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EV_MODEL}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(raw) }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('API 오류 ' + res.status + ': ' + (data.error?.message || ''));
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('응답 내용이 비어있습니다');
      const r = JSON.parse(text.replace(/```json|```/g, '').trim());
      $('#evf-title').value = r.title || '';
      if (r.start) $('#evf-start').value = r.start;
      const noEnd = !r.end; $('#evf-endless').checked = noEnd; $('#evf-end').disabled = noEnd; $('#evf-end').value = noEnd ? '' : r.end;
      $('#evf-days').value = daysToText((r.days || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort());
      if (CATS.includes(r.category)) $('#evf-cat').value = r.category;
      $('#evf-body').value = r.body || '';
      $('#evf-ex').value = [...new Set((r.excluded || []).map(canonStore))].join(', ');
      $('#evf-checks').value = (r.checks || []).join('\n');
      $('#evf-faq').value = faqToText(r.faq || []);
      draftRaw = raw;
      $('#evf-adv').open = true;   // 확인 필요·예상 질문을 바로 검토할 수 있게 펼침
      showUnknown();
      hint.textContent = '정리됐습니다. 내용을 확인하고 수정한 뒤 추가를 누르세요.';
    } catch (e) {
      hint.textContent = '정리하지 못했습니다. ' + (e.message || '잠시 후 다시 시도해 주세요.');
    }
    btn.disabled = false; btn.textContent = 'AI로 정리';
  }

  // ---------- 이벤트 핸들러 ----------
  async function patchChecks(id, checks) {
    await sbFetch('events?id=eq.' + id, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ checks }) });
    const e = events.find(x => x.id === id); if (e) e.checks = checks;
    render();
  }

  async function onClick(ev) {
    const t = ev.target.closest('button'); if (!t) return;
    const d = t.dataset;
    try {
      if (d.evtab) { tab = d.evtab; render(); }
      else if (d.evf) { if (d.evf === 'todo') onlyTodo = !onlyTodo; else onlyMine = !onlyMine; render(); }
      else if (d.evseen !== undefined) { since = Date.now(); ls('l24_ev_last', since); renderNavBadge(); render(); }
      else if (d.evago) { const x = new Date(); x.setHours(0, 0, 0, 0); since = x.getTime() - (+d.evago - 1) * 864e5; ls('l24_ev_last', since); renderNavBadge(); render(); }
      else if (d.evedit) openForm(events.find(e => e.id === d.evedit));
      else if (d.evdel) {
        const e = events.find(x => x.id === d.evdel);
        if (!confirm(`“${e?.title || '이벤트'}”를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`)) return;
        await sbFetch('events?id=eq.' + d.evdel, { method: 'DELETE', prefer: 'return=minimal' });
        events = events.filter(x => x.id !== d.evdel); renderNavBadge(); render(); showToast('이벤트를 삭제했습니다');
      }
      else if (d.evdelchk) { const [id, i] = d.evdelchk.split(':'); const e = events.find(x => x.id === id); await patchChecks(id, e.checks.filter((_, j) => j != i)); }
      else if (d.evcopy !== undefined) {
        const done = () => { t.textContent = '복사됨'; setTimeout(() => t.textContent = '답변 복사', 1200); };
        try { await navigator.clipboard.writeText(d.evcopy); done(); }
        catch (err) {   // 클립보드 권한이 없으면 임시 입력칸으로 복사
          const ta = document.createElement('textarea'); ta.value = d.evcopy; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e2) { t.textContent = '직접 선택해 복사해 주세요'; }
          ta.remove();
        }
      }
    } catch (e) { showToast('처리하지 못했습니다: ' + (e.message || e), 'error'); }
  }

  async function onChange(ev) {
    const el = ev.target;
    if (el.id === 'ev-sd') { if (el.value) { since = new Date(el.value + 'T00:00:00').getTime(); ls('l24_ev_last', since); renderNavBadge(); render(); } return; }
    const c = el.dataset?.evchk || el.dataset?.evnote; if (!c) return;
    const [id, i] = c.split(':'), e = events.find(x => x.id === id), isChk = !!el.dataset.evchk;
    try {
      await patchChecks(id, e.checks.map((x, j) => j == i ? (isChk ? { ...x, d: el.checked } : { ...x, n: el.value.trim() }) : x));
    } catch (err) { if (isChk) el.checked = !el.checked; showToast('저장하지 못했습니다', 'error'); }
  }

  function init() {
    const page = $('#page-events');
    page.addEventListener('click', e => { if (e.target.id === 'ev-add') openForm(); else onClick(e); });
    page.addEventListener('change', onChange);
    page.addEventListener('input', e => {
      if (e.target.id === 'ev-q') { query = e.target.value.trim().toLowerCase(); render(); }
      else if (e.target.id === 'ev-ms') { myStore = e.target.value.trim(); ls('l24_ev_store', myStore); if (!myStore) onlyMine = false; render(); }
    });
    page.addEventListener('toggle', e => {   // 펼침 상태는 재렌더 후에도 유지
      const d = e.target; if (d.classList?.contains('ev-row')) { d.open ? openIds.add(d.dataset.id) : openIds.delete(d.dataset.id); }
    }, true);
    const ov = $('#ev-form-overlay');
    ov.addEventListener('mousedown', e => { ov._down = e.target === ov; });   // 입력 중 드래그가 바깥에서 끝나도 닫히지 않게
    ov.addEventListener('click', e => {
      if (e.target === ov && ov._down) closeForm();
      else if (e.target.closest('[data-evclose]')) closeForm();
      else if (e.target.closest('[data-evai]')) organize();
    });
    ov.addEventListener('submit', e => { e.preventDefault(); save(); });
    ov.addEventListener('change', e => { if (e.target.id === 'evf-endless') $('#evf-end').disabled = e.target.checked; });
    ov.addEventListener('input', e => { if (e.target.id === 'evf-ex') showUnknown(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.style.display !== 'none') closeForm(); });
    $('#ev-ms').value = myStore;
  }

  function fillStoreList() {
    const dl = $('#ev-stores');
    if (dl && typeof STORES !== 'undefined') dl.innerHTML = STORES.map(s => `<option value="${esc(s.name)}"></option>`).join('');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    load,                                              // 로그인 직후 한 번 (메뉴의 새 이벤트 숫자용)
    reload() { if (!document.activeElement?.closest?.('#page-events .ev-note')) return load(); },   // realtime
    onShow() { fillStoreList(); load(); },
  };
})();
