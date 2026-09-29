// ============================================================
// 필터 칩 개수 (검색어·오늘방문 조건 안에서, 칩 필터와 무관하게 셈)
// ============================================================
const CHIP_MATCH = {
  '매일': s => s.frequency === '매일', '격일': s => s.frequency === '격일',
  '부산/대구': s => s.frequency === '부산/대구', '대전': s => s.frequency === '대전',
  '셀프only': s => s.frequency === '셀프only', '직영': s => s.type === '직영', '론디원': s => s.rondiOne === '론디원',
};
function renderChipCounts(base) {
  document.querySelectorAll('.filter-bar .chip[data-key]').forEach(chip => {
    chip.querySelector('.chip-n').textContent = base.filter(CHIP_MATCH[chip.dataset.key]).length;
  });
}
// ============================================================
// HERO (전체/오늘 방문 수, 날짜) — 오늘 방문 클릭 시 해당 매장만 보기
// ============================================================
let todayOnly = false;
let heroCounted = false;
function renderHero() {
  const total = STORES.length;
  const today = STORES.filter(isVisitingToday).length;
  document.getElementById('hero-date').textContent = todayLabel();
  // 첫 로드 때만 숫자가 올라가는 모션, 이후(실시간 갱신 등)엔 바로 표시
  if (!heroCounted && total) { heroCounted = true; countUp('hero-total', total); countUp('hero-today', today); }
  else if (heroCounted) { document.getElementById('hero-total').textContent = total; document.getElementById('hero-today').textContent = today; }
}
function countUp(id, to) {
  const el = document.getElementById(id);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  const step = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function toggleTodayOnly() {
  todayOnly = !todayOnly;
  document.getElementById('hero-today-btn').classList.toggle('on', todayOnly);
  renderList();
}

// ============================================================
// RENDER LIST
// ============================================================
function renderList() {
  renderHero();
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const filtered = [];
  const base = [];
  STORES.forEach((s, i) => {
    if (q && !s.name.toLowerCase().includes(q)) return;
    if (todayOnly && !isVisitingToday(s)) return;
    base.push(s);
    if (activeFilters.size > 0 && ![...activeFilters].some(k => CHIP_MATCH[k](s))) return;
    filtered.push({ s, i });
  });

  document.getElementById('result-count').innerHTML = `전체 <strong>${filtered.length}</strong>개 매장`;
  document.getElementById('empty-state').style.display = filtered.length === 0 ? 'block' : 'none';
  renderChipCounts(base);

  document.getElementById('store-tbody').innerHTML = filtered.map(({ s, i }) => {
    // 다음 방문 예정일 계산 (폐점 매장은 계산하지 않음)
    let visitHtml = '<span style="font-size:12px;color:var(--text3)">—</span>';
    const closedNow = isEffectivelyClosed(s);
    if (closedNow) {
      visitHtml = '<span style="font-size:12px;color:var(--text3);font-weight:700;">폐점</span>';
    } else if (['매일','격일','부산/대구','대전'].includes(s.frequency)) {
      const dates = getNextTwoDates(s.frequency, s.line);
      if (dates && dates.length >= 2) {
        // 오늘 방문 매장은 날짜 대신 초록 알약, 아래에 그다음 방문일
        const isToday = dates[0].toDateString() === new Date().toDateString();
        visitHtml = isToday
          ? `<div class="visit-dates"><span class="visit-today-pill">오늘 방문</span><span class="visit-next2">다음 ${formatDate(dates[1])}</span></div>`
          : `<div class="visit-dates">
          <span class="visit-next">${formatDate(dates[0])} <span style="font-size:10px;opacity:.7">${getDaysUntil(dates[0])}</span></span>
          <span class="visit-next2">${formatDate(dates[1])}</span>
        </div>`;
      }
    }
    const rowCls = closedNow ? 'store-closed' : '';
    return `<tr onclick="openModal(${i})" ${rowCls ? `class="${rowCls}"` : ''}>
      <td class="td-no">${s.no}${closedNow ? '<span class="closed-strike"></span><span class="closed-stamp">매장 폐점</span>' : ''}</td>
      <td class="td-name">${s.name}${isVisitingToday(s) ? `<span class="today-tag ${getLineClass(s.line, s.frequency)}">오늘</span>` : ''}${closedNow ? '<span class="closed-tag">폐점</span>' : closureStageTagHtml(s)}${s.rondiTopupBlocked ? '<span class="rondi-topup-tag">론디페이 고객센터 지급불가</span>' : ''}</td>
      <td><span class="badge b-${s.type}">${s.type}</span></td>
      <td><span class="badge ${s.rondiOne === '론디원' ? 'b-론디원' : 'b-비론디원'}">${s.rondiOne === '론디원' ? '론디원' : '—'}</span></td>
      <td><span class="badge b-${s.storeType}">${s.storeType}</span></td>
      <td style="white-space:nowrap"><span class="b-line ${getLineClass(s.line, s.frequency)}">${s.line || '—'}</span></td>
      <td><span class="freq ${freqCls(s.frequency)}">${s.frequency || '—'}</span></td>
      <td>${visitHtml}</td>
      <td>${s.kiosk ? `<span class="kiosk-badge kiosk-${s.kiosk.toLowerCase()}">${s.kiosk}</span>` : '<span style="font-size:12px;color:var(--text3)">—</span>'}</td>
      <td style="font-size:12px;color:var(--text2);font-weight:500;white-space:nowrap;min-width:80px">${s.selfAS || '—'}</td>
      <td>${s.storeNote ? `<span class="note-preview"> ${s.storeNote.split('\n')[0]}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

function toggleFilter(val, btn) {
  activeFilters.has(val) ? (activeFilters.delete(val), btn.classList.remove('on')) : (activeFilters.add(val), btn.classList.add('on'));
  renderList();
}
function clearFilters() {
  activeFilters.clear();
  todayOnly = false;
  document.getElementById('hero-today-btn').classList.remove('on');
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
  renderList();
}

function goHome() {
  document.getElementById('search-input').value = '';
  clearFilters();
  switchPage('list');
}

// ============================================================
// MODAL
// ============================================================
function openModal(i) {
  const s = STORES[i];
  document.getElementById('m-no').textContent = 'NO. ' + String(s.no).padStart(3, '0');
  document.getElementById('m-name').textContent = s.name;
  document.getElementById('m-tags').innerHTML = `
    <span class="badge b-${s.type}">${s.type}</span>
    <span class="badge ${s.rondiOne === '론디원' ? 'b-론디원' : 'b-비론디원'}">${s.rondiOne}</span>
    <span class="badge b-${s.storeType}">${s.storeType}</span>
    <span class="freq ${freqCls(s.frequency)}">${s.frequency || '—'}</span>
    ${isEffectivelyClosed(s) ? `<span class="closed-tag" style="font-size:12px;padding:3px 10px;">폐점${s.closedDate ? ' · ' + s.closedDate : ''}</span>` : ''}
    ${s.rondiTopupBlocked ? `<span class="rondi-topup-tag" style="font-size:12px;padding:3px 10px;">론디페이 고객센터 지급불가</span>` : ''}
  `;

  // 폐업 공지 (폐점일이 예정되어 있거나 이미 지난 경우)
  let noticeHtml = '';
  if (s.isClosed) {
    const parseDateStr = ds => { if (!ds) return null; const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
    const noticeRows = [
      ['세탁접수 마감', s.closedNoticeReceiptDate],
      ['마지막 세탁물 배송 예정', s.closedNoticeLastDeliveryDate],
      ['세탁물 찾기 마감', s.closedNoticePickupDate],
      ['폐점일', s.closedDate],
    ].filter(([, ds]) => ds).map(([label, ds]) => `<div class="info-cell"><label>${label}</label><span>${formatDate(parseDateStr(ds))}</span></div>`).join('');
    if (noticeRows) {
      noticeHtml = `
        <div class="sec-lbl" style="color:#b91c1c">폐업 공지</div>
        <div class="info-grid">${noticeRows}</div>
        ${s.closedNoticeNote ? `<div class="note-card" style="margin-top:10px;white-space:pre-line">${s.closedNoticeNote}</div>` : ''}
      `;
    }
  }

  // 방문 예정일 계산
  let visitCardHtml = '';
  if (!isEffectivelyClosed(s) && ['매일','격일','부산/대구','대전'].includes(s.frequency)) {
    const dates = getNextTwoDates(s.frequency, s.line);
    if (dates && dates.length >= 2) {
      visitCardHtml = `
        <div class="sec-lbl">방문 예정일</div>
        <div class="visit-card">
          <div class="visit-item"><label>가장 가까운 방문</label><span>${formatDate(dates[0])} <span style="font-size:12px;opacity:.7">${getDaysUntil(dates[0])}</span></span></div>
          <div class="visit-item"><label>그 다음 방문</label><span class="secondary">${formatDate(dates[1])} <span style="font-size:12px;opacity:.7">${getDaysUntil(dates[1])}</span></span></div>
        </div>`;
    }
  }

  const sd = getSchedByFreq(s.frequency);
  const costs = [['dryStation','드라이스테이션'],['interior','인테리어'],['washer','세탁기'],['dryer','건조기'],['vending','자판기'],['cardReader','카드리더기']];
  const costCalc = calcCosts(s);
  document.getElementById('m-body').innerHTML = isEffectivelyClosed(s) ? noticeHtml : `
    ${noticeHtml}
    ${visitCardHtml}
    <div class="sec-lbl" ${(visitCardHtml || noticeHtml) ? 'style="margin-top:20px"' : ''}>기본 정보</div>
    <div class="info-grid">
      <div class="info-cell"><label>라인</label><span><span class="b-line ${getLineClass(s.line, s.frequency)}">${s.line || '—'}</span></span></div>
      <div class="info-cell"><label>방문 요일 패턴</label><span style="color:var(--accent-text);font-size:13px">${sd ? sd.days : '—'}</span></div>
      <div class="info-cell"><label>키오스크 버전</label><span>${s.kiosk === 'V2'
        ? `<a href="https://admin.sbox24.co.kr/react-page/operation-admin/equipment-control" target="_blank" class="kiosk-badge kiosk-v2" style="cursor:pointer;text-decoration:none">V2 ↗</a>`
        : s.kiosk === 'V1' ? `<span class="kiosk-badge kiosk-v1">V1</span>` : '—'
      }</span></div>
      <div class="info-cell"><label>셀프장비 A/S</label><span>${s.selfAS || '—'}</span></div>
      <div class="info-cell"><label>오픈/양수일</label><span>${s.openDate || '—'}</span></div>
      <div class="info-cell"><label>셀프장비 보증</label><span>${s.selfWarranty || '—'}</span></div>
      <div class="info-cell"><label>드라이 보증</label><span>${s.dryWarranty || '—'}</span></div>
    </div>
    <div class="sec-lbl" style="margin-top:20px">출장비 발생 현황</div>
    <div class="cost-chips">${costs.map(([k,l]) => `<span class="cc cc-${costCalc[k]}">${l}: ${costCalc[k]}</span>`).join('')}</div>
    ${s.storeNote ? `<div class="sec-lbl" style="margin-top:20px">매장 특이사항</div><div class="note-card warn">${s.storeNote}</div>` : ''}
    ${s.ownerNote ? `<div class="sec-lbl" style="margin-top:20px">점주 특이사항</div><div class="note-card">${s.ownerNote}</div>` : ''}
    ${(s.parking || s.cctv) ? `
      <div class="sec-lbl" style="margin-top:20px">기타 정보</div>
      <div class="info-grid">
        ${(s.parking || s.parkingUrl) ? `<div class="info-cell" style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px">
          <label>주차 정보</label>
          ${s.parkingUrl ? `<a href="${s.parkingUrl}" target="_blank" rel="noopener" class="modal-link">주차 등록하기 ↗</a>` : ''}
          ${s.parking ? `<span style="font-size:13px;white-space:pre-line">${s.parking}</span>` : ''}
        </div>` : ''}
        ${(s.cctv || s.cctvUrl) ? `<div class="info-cell" style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px">
          <label>CCTV 정보</label>
          ${s.cctvUrl ? `<a href="${s.cctvUrl}" target="_blank" rel="noopener" class="modal-link">CCTV 접속하기 ↗</a>` : ''}
          ${s.cctv ? `<span style="font-size:13px;white-space:pre-line">${s.cctv}</span>` : ''}
        </div>` : ''}
      </div>` : ''
    }
  `;
  document.getElementById('overlay').classList.add('open');
}
function closeOverlay(e) { if (e.target.id === 'overlay') document.getElementById('overlay').classList.remove('open'); }
