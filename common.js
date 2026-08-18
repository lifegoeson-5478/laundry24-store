// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(msg, type = 'success', duration = 3000) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  const icons = { success: '✓', error: '✕', warn: '' };
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// 배포할 때마다 버전을 올려주세요 (푸터에 표시됨)
const APP_VERSION = '1.4.2';

// 아래 두 줄만 본인 값으로 교체하세요
// ============================================================
const SUPABASE_URL  = 'https://ebiepxqkqeyyxewnddov.supabase.co';   // 예: https://xxxx.supabase.co
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaWVweHFrcWV5eXhld25kZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzA3NjIsImV4cCI6MjA5NjM0Njc2Mn0.LF0mgkF1o7_k-6HaI3O0r_DxRGRchq2FWuGVj37W5x8';        // anon public key

// ============================================================
// REALTIME (어드민에서 저장하면 랜딩페이지에 자동 반영)
// ============================================================
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let realtimeReloadTimer = null;

function scheduleRealtimeReload(msg) {
  // 짧은 시간에 여러 변경이 몰려도 한 번만 새로고침하도록 살짝 지연
  clearTimeout(realtimeReloadTimer);
  realtimeReloadTimer = setTimeout(() => {
    loadData();
    if (msg) showToast(msg, 'success', 2000);
  }, 400);
}

function setupRealtime() {
  sbClient.channel('public:schedules')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
      scheduleRealtimeReload('운송 일정이 업데이트되었습니다');
    })
    .subscribe();

  sbClient.channel('public:stores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
      scheduleRealtimeReload('매장 정보가 업데이트되었습니다');
    })
    .subscribe();
}

// ============================================================
// DATA
// ============================================================
let STORES = [];
const DEFAULT_SCHED = [
  { key: 'daily',   label: '매일',      color: '#10b981', lines: 'Z, Y, X, W',               days: '매일 (월~일)',                        note: '' },
  { key: 'alt',     label: '격일',      color: '#3b82f6', lines: 'A, B, C, D, E, F, G, H',   days: 'B·D·F·H: 홀수일 / A·C·E·G: 짝수일', note: '' },
  { key: 'busan',   label: '부산/대구', color: '#f59e0b', lines: '부산·대구 지역 매장',       days: '월, 목, 토',                          note: '' },
  { key: 'daejeon', label: '대전',      color: '#ef4444', lines: '대전 지역 매장',             days: '월, 목, 토',                          note: '' },
];
let schedData = JSON.parse(JSON.stringify(DEFAULT_SCHED));

// ============================================================
// SUPABASE API HELPERS
// ============================================================
async function sbFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || '',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// DB 컬럼 → JS 객체 변환
function rowToStore(r) {
  return {
    no: r.no, name: r.name, type: r.type, rondiOne: r.rondi_one,
    storeType: r.store_type, line: r.line, frequency: r.frequency,
    openDate: r.open_date || '', selfWarranty: r.self_warranty || '',
    dryWarranty: r.dry_warranty || '', selfAS: r.self_as || '',
    dryStation: r.dry_station || '', interior: r.interior || '',
    washer: r.washer || '', dryer: r.dryer || '',
    vending: r.vending || '', cardReader: r.card_reader || '',
    kiosk: r.kiosk || '', storeNote: r.store_note || '',
    ownerNote: r.owner_note || '', parking: r.parking || '',
    parkingUrl: r.parking_url || '', cctv: r.cctv || '', cctvUrl: r.cctv_url || '', _id: r.id,
    cardCancelPossible: r.card_cancel_possible !== false,
    localCurrencyAvailable: r.local_currency_available !== false,
    selfDeviceManaged: r.self_device_managed !== false,
    refundNote: r.refund_note || '',
    isClosed: r.is_closed === true,
    closedDate: r.closed_date || '',
    rondiTopupBlocked: r.rondi_topup_blocked === true,
    closedNoticeReceiptDate: r.closed_notice_receipt_date || '',
    closedNoticeLastDeliveryDate: r.closed_notice_last_delivery_date || '',
    closedNoticePickupDate: r.closed_notice_pickup_date || '',
    closedNoticeNote: r.closed_notice_note || '',
  };
}

// JS 객체 → DB 컬럼 변환
function storeToRow(s) {
  return {
    no: s.no, name: s.name, type: s.type, rondi_one: s.rondiOne,
    store_type: s.storeType, line: s.line, frequency: s.frequency,
    open_date: s.openDate || null, self_warranty: s.selfWarranty || null,
    dry_warranty: s.dryWarranty || null, self_as: s.selfAS,
    dry_station: s.dryStation, interior: s.interior,
    washer: s.washer, dryer: s.dryer, vending: s.vending,
    card_reader: s.cardReader, kiosk: s.kiosk,
    store_note: s.storeNote, owner_note: s.ownerNote,
    parking: s.parking, parking_url: s.parkingUrl, cctv: s.cctv, cctv_url: s.cctvUrl,
    card_cancel_possible: s.cardCancelPossible !== false,
    local_currency_available: s.localCurrencyAvailable !== false,
    self_device_managed: s.selfDeviceManaged !== false,
    refund_note: s.refundNote || null,
    is_closed: s.isClosed === true,
    closed_date: s.closedDate || null,
    rondi_topup_blocked: s.rondiTopupBlocked === true,
    closed_notice_receipt_date: s.closedNoticeReceiptDate || null,
    closed_notice_last_delivery_date: s.closedNoticeLastDeliveryDate || null,
    closed_notice_pickup_date: s.closedNoticePickupDate || null,
    closed_notice_note: s.closedNoticeNote || null,
    updated_at: new Date().toISOString(),
  };
}

// ============================================================
// 초기 데이터 로드
// ============================================================
function showLoading(msg) {
  document.getElementById('store-tbody').innerHTML =
    `<tr><td colspan="12" style="text-align:center;padding:60px;color:var(--text3);font-size:14px">⏳ ${msg}</td></tr>`;
}
function showError(msg) {
  document.getElementById('store-tbody').innerHTML =
    `<tr><td colspan="12" style="text-align:center;padding:60px;color:var(--danger);font-size:14px"> ${msg}<br><small style="color:var(--text3)">SUPABASE_URL과 SUPABASE_KEY를 확인해주세요.</small></td></tr>`;
}

async function loadData() {
  showLoading('데이터를 불러오는 중...');
  try {
    // 매장 데이터
    const rows = await sbFetch('stores?select=*&order=no.asc');
    STORES = rows.map(rowToStore);

    // 운송 일정
    const scheds = await sbFetch('schedules?select=*&order=id.asc');
    if (scheds && scheds.length > 0) {
      schedData = scheds.map(r => ({
        key: r.key, label: r.label, color: r.color,
        lines: r.lines, days: r.days, note: r.note || '',
      }));
    }
    renderList();
  } catch (e) {
    showError('데이터 로드 실패: ' + e.message);
  }
}

// ============================================================
// NEXT VISIT DATE CALCULATOR
// 방문 요일 패턴 문자열을 파싱해서 가장 가까운 날짜 2개를 계산
// ============================================================

// 요일명 → JS getDay() 숫자 매핑
const DAY_MAP = { '일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6 };

// "B·D·F·H: 짝수일 / A·C·E·G: 홀수일" 같은 어드민 입력 텍스트를 파싱해서
// 실제 라인 → 홀짝 매핑을 만든다. (더 이상 코드에 하드코딩하지 않음)
function parseLineParityMap(pattern) {
  const map = {};
  if (!pattern) return map;
  const regex = /([A-Za-z·,\s]+):\s*(홀수일|짝수일)/g;
  let m;
  while ((m = regex.exec(pattern)) !== null) {
    const lines = m[1].split(/[·,\s]+/).filter(Boolean);
    const parity = m[2] === '홀수일' ? 'odd' : 'even';
    lines.forEach(l => { map[l.toUpperCase()] = parity; });
  }
  return map;
}

// 패턴 문자열에서 요일 목록 추출
// 지원 패턴:
//   "매일 (월~일)" → [0,1,2,3,4,5,6]
//   "월, 목, 토" → [1,4,6]
//   "A·C·E·G: 홀수일 / B·D·F·H: 짝수일" → 라인 기반 → 별도 처리
//   "홀수일" "짝수일" → 날짜 기반

function parseDaysFromPattern(pattern, line) {
  if (!pattern) return null;

  // 매일
  if (pattern.includes('매일') || pattern.includes('월~일')) {
    return { type: 'fixed', days: [0,1,2,3,4,5,6] };
  }

  // 홀수일 / 짝수일 분기 (격일 복합 패턴) — 어드민이 입력한 텍스트를 실시간으로 파싱
  if (pattern.includes('홀수일') || pattern.includes('짝수일')) {
    const map = parseLineParityMap(pattern);
    const upperLine = (line || '').toUpperCase().trim();
    if (map[upperLine]) return { type: 'date_parity', parity: map[upperLine] };
    // 라인 매칭이 안 되면(라인 미기입 등) 패턴 전체에서 단일 값으로 판단
    if (pattern.includes('홀수일') && !pattern.includes('짝수일')) return { type: 'date_parity', parity: 'odd' };
    if (pattern.includes('짝수일') && !pattern.includes('홀수일')) return { type: 'date_parity', parity: 'even' };
  }

  // "월, 목, 토" 형태 — 한글 요일 추출
  const found = [];
  for (const [name, num] of Object.entries(DAY_MAP)) {
    if (pattern.includes(name)) found.push(num);
  }
  if (found.length >0) return { type: 'fixed', days: [...new Set(found)].sort((a,b)=> a-b) };

  return null;
}

function getNextTwoDates(frequency, line) {
  const sd = schedData.find(s => s.label === frequency);
  if (!sd) return null;

  const parsed = parseDaysFromPattern(sd.days, line);
  if (!parsed) return null;

  const today = new Date();
  today.setHours(0,0,0,0);
  const results = [];

  if (parsed.type === 'fixed') {
    // 고정 요일: 다음 7일~14일에서 해당 요일 찾기
    for (let offset = 0; offset <= 13 && results.length < 2; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      if (parsed.days.includes(d.getDay())) results.push(new Date(d));
    }
  } else if (parsed.type === 'date_parity') {
    // 홀수/짝수일: 앞으로 14일 중 해당 날짜 찾기
    const isOdd = parsed.parity === 'odd';
    for (let offset = 0; offset <= 13 && results.length < 2; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const dateNum = d.getDate();
      if (isOdd ? dateNum % 2 === 1 : dateNum % 2 === 0) results.push(new Date(d));
    }
  }

  return results.length >= 2 ? results : results.length === 1 ? results : null;
}

function formatDate(d) {
  if (!d) return '';
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const days = ['일','월','화','수','목','금','토'];
  return `${mm}/${dd}(${days[d.getDay()]})`;
}

function getDaysUntil(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  return `${diff}일 후`;
}

// ============================================================
// 출장비 자동 계산
// No.1 일성OT는 수동값 유지, 나머지는 보증 도래일 기준 자동 계산
// ============================================================
function calcCosts(s) {
  // 일성OT (No.1) 예외 — 수동값 그대로
  if (s.no === 1) {
    return {
      dryStation: s.dryStation || '미발생',
      interior:   s.interior   || '미발생',
      washer:     s.washer     || '미발생',
      dryer:      s.dryer      || '미발생',
      vending:    s.vending    || '미발생',
      cardReader: s.cardReader || '미발생',
    };
  }

  const today = new Date(); today.setHours(0,0,0,0);

  // 드라이 2년 도래일 기준 → 드라이스테이션
  const dryExpired = s.dryWarranty && new Date(s.dryWarranty) < today;
  // 셀프 1년 도래일 기준 → 나머지 5개
  const selfExpired = s.selfWarranty && new Date(s.selfWarranty) < today;

  return {
    dryStation: dryExpired  ? '발생' : '미발생',
    interior:   selfExpired ? '발생' : '미발생',
    washer:     selfExpired ? '발생' : '미발생',
    dryer:      selfExpired ? '발생' : '미발생',
    vending:    selfExpired ? '발생' : '미발생',
    cardReader: selfExpired ? '발생' : '미발생',
  };
}


function getLineClass(line, frequency) {
  const l = (line || '').toUpperCase().trim();
  if (['A','C','E','G'].includes(l)) return 'line-A';
  if (['B','D','F','H'].includes(l)) return 'line-B';
  if (['Z','Y','X','W'].includes(l)) return 'line-Z';
  if (frequency === '부산/대구') return 'line-busan';
  if (frequency === '대전') return 'line-daejeon';
  return 'line-etc';
}

// 폐점일을 미리 등록해두는 경우가 있어, 폐점 처리는 등록된 폐점일이 되어야 실제로 반영된다
function isEffectivelyClosed(s) {
  if (!s.isClosed) return false;
  if (!s.closedDate) return true;
  const todayStr = new Date().toISOString().split('T')[0];
  return s.closedDate <= todayStr;
}

// 폐점 예정 매장의 진행 단계 (세탁접수마감 → 배송완료 → 찾기마감) — 폐점일 도래 후에는 기존 폐점 도장이 대신 표시된다
function closureStageTag(s) {
  if (!s.isClosed || isEffectivelyClosed(s)) return null;
  const todayStr = new Date().toISOString().split('T')[0];
  if (s.closedNoticePickupDate && todayStr >= s.closedNoticePickupDate) return { cls: 'done', text: '찾기 마감' };
  if (s.closedNoticeLastDeliveryDate && todayStr >= s.closedNoticeLastDeliveryDate) return { cls: 'warn2', text: '배송 완료' };
  if (s.closedNoticeReceiptDate && todayStr >= s.closedNoticeReceiptDate) return { cls: 'warn1', text: '세탁접수 마감' };
  return { cls: 'warn1', text: '폐점예정 · ' + s.closedDate };
}
function closureStageTagHtml(s) {
  const t = closureStageTag(s);
  return t ? `<span class="stage-tag ${t.cls}">${t.text}</span>` : '';
}

// ============================================================
// TODAY VISIT CHECKER
// B·D·F·H 라인(홀수일) 또는 A·C·E·G(짝수일) 기준으로 오늘 방문인지 판단
// 매일 라인은 항상 today, 부산/대구/대전은 월/목/토 체크
// ============================================================
function isVisitingToday(s) {
  if (isEffectivelyClosed(s)) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const dateNum = today.getDate();
  const dow = today.getDay(); // 0=일,1=월...6=토
  const l = (s.line || '').toUpperCase().trim();

  if (s.frequency === '매일') return true;
  if (s.frequency === '격일') {
    const sd = getSchedByFreq('격일');
    if (sd) {
      const map = parseLineParityMap(sd.days);
      const parity = map[l];
      if (parity === 'odd')  return dateNum % 2 === 1;
      if (parity === 'even') return dateNum % 2 === 0;
    }
  }
  if (s.frequency === '부산/대구' || s.frequency === '대전') {
    return [1, 4, 6].includes(dow); // 월=1, 목=4, 토=6
  }
  return false;
}


function getSchedByFreq(freq) {
  return schedData.find(s => s.label === freq) || null;
}

function freqCls(f) {
  if (f === '매일')      return 'f-매일';
  if (f === '격일')      return 'f-격일';
  if (f === '부산/대구') return 'f-busan';
  if (f === '대전')      return 'f-daejeon';
  if (f === '셀프only')  return 'f-셀프only';
  return 'f-기타';
}

// ============================================================
// STATE
// ============================================================
let activeFilters = new Set();
let editingIdx = -1;   // -1: no selection, -2: new store mode
let deleteTargetIdx = -1;

// ============================================================
// PAGE SWITCHING
// ============================================================
function switchPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const idx = { list: 0, schedule: 1, refund: 2, refundlist: 3 };
  if (idx[p] !== undefined) document.querySelectorAll('.nav-tab')[idx[p]]?.classList.add('active');
  if (p === 'schedule') renderSchedDisplay();
  if (p === 'admin') { renderAlist(); renderSchedEditTable(); loadGeminiKey(); }
  if (p === 'refund' && rfStores.length === 0) loadRefundStores();
  if (p === 'refundlist') { loadPaymentDate(); loadRefundList(); renderPaymentDateList(); }
}

// ============================================================
// INIT (global listeners)
// ============================================================
document.getElementById('app-version').textContent = 'v' + APP_VERSION;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('overlay').classList.remove('open');
    document.getElementById('confirm-overlay').classList.remove('open');
    closePwModal();
  }
});
window.addEventListener('scroll', () => {
  document.getElementById('top-btn').classList.toggle('visible', window.scrollY > 300);
});

// ============================================================
// 새 버전 배포 감지 → 자동 새로고침
// 서버가 보내는 ETag/Last-Modified가 처음 로드했을 때와 달라지면 새 배포로 간주
// ============================================================
let _versionTag = null;
async function checkForNewVersion() {
  try {
    const res = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
    const tag = res.headers.get('etag') || res.headers.get('last-modified');
    if (!tag) return;
    if (_versionTag === null) { _versionTag = tag; return; }
    if (tag !== _versionTag) {
      showToast('새 버전이 배포되어 새로고침합니다', 'success', 1500);
      setTimeout(() => location.reload(), 1200);
    }
  } catch (e) { /* 오프라인 등 - 다음 주기에 재시도 */ }
}
setInterval(checkForNewVersion, 60000);
