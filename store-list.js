// ============================================================
// STATS
// ============================================================
function renderStats(stores) {
  const c = { total: stores.length, 매일: 0, 격일: 0, '부산/대구': 0, 대전: 0, 직영: 0 };
  stores.forEach(s => {
    if (s.frequency === '매일') c['매일']++;
    else if (s.frequency === '격일') c['격일']++;
    else if (s.frequency === '부산/대구') c['부산/대구']++;
    else if (s.frequency === '대전') c['대전']++;
    if (s.type === '직영') c['직영']++;
  });
  document.getElementById('stats-row').innerHTML = [
    { num: c.total, lbl: '전체 매장', color: '#111' },
    { num: c['매일'], lbl: '매일 방문', color: '#10b981' },
    { num: c['격일'], lbl: '격일 방문', color: '#3b82f6' },
    { num: c['부산/대구'], lbl: '부산/대구', color: '#f59e0b' },
    { num: c['대전'], lbl: '대전', color: '#ef4444' },
    { num: c['직영'], lbl: '직영 매장', color: '#0072ce' },
  ].map(x => `<div class="stat-card"><div class="stat-dot" style="background:${x.color}"></div><div><div class="stat-num">${x.num}</div><div class="stat-lbl">${x.lbl}</div></div></div>`).join('');
}

// ============================================================
// RENDER LIST
// ============================================================
function renderList() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const filtered = [];
  STORES.forEach((s, i) => {
    if (q && !s.name.toLowerCase().includes(q)) return;
    if (activeFilters.size > 0) {
      let ok = false;
      if (activeFilters.has('매일') && s.frequency === '매일') ok = true;
      if (activeFilters.has('격일') && s.frequency === '격일') ok = true;
      if (activeFilters.has('부산/대구') && s.frequency === '부산/대구') ok = true;
      if (activeFilters.has('대전') && s.frequency === '대전') ok = true;
      if (activeFilters.has('셀프only') && s.frequency === '셀프only') ok = true;
      if (activeFilters.has('직영') && s.type === '직영') ok = true;
      if (activeFilters.has('론디원') && s.rondiOne === '론디원') ok = true;
      if (!ok) return;
    }
    filtered.push({ s, i });
  });

  document.getElementById('result-count').innerHTML = `전체 <strong>${filtered.length}</strong>개 매장`;
  document.getElementById('empty-state').style.display = filtered.length === 0 ? 'block' : 'none';
  renderStats(filtered.map(x => x.s));

  document.getElementById('store-tbody').innerHTML = filtered.map(({ s, i }) => {
    // 다음 방문 예정일 계산 (폐점 매장은 계산하지 않음)
    let visitHtml = '<span style="font-size:12px;color:var(--text3)">—</span>';
    const closedNow = isEffectivelyClosed(s);
    if (closedNow) {
      visitHtml = '<span style="font-size:12px;color:var(--text3);font-weight:700;">폐점</span>';
    } else if (['매일','격일','부산/대구','대전'].includes(s.frequency)) {
      const dates = getNextTwoDates(s.frequency, s.line);
      if (dates && dates.length >= 2) {
        visitHtml = `<div class="visit-dates">
          <span class="visit-next">▶ ${formatDate(dates[0])} <span style="font-size:10px;opacity:.7">${getDaysUntil(dates[0])}</span></span>
          <span class="visit-next2">${formatDate(dates[1])}</span>
        </div>`;
      }
    }
    const rowCls = [isVisitingToday(s) ? 'visit-today' : '', closedNow ? 'store-closed' : ''].filter(Boolean).join(' ');
    return `<tr onclick="openModal(${i})" ${rowCls ? `class="${rowCls}"` : ''}>
      <td class="td-no">${s.no}</td>
      <td class="td-name">${s.name}${isVisitingToday(s) ? '<span class="today-tag">오늘</span>' : ''}${closedNow ? '<span class="closed-tag">폐점</span>' : closureStageTagHtml(s)}${s.rondiTopupBlocked ? '<span class="rondi-topup-tag">론디페이 고객센터 지급불가</span>' : ''}</td>
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
  positionClosedStamps();
}

// ============================================================
// 폐점 도장 오버레이 위치 계산
// 각 셀 내용과 무관하게, 테이블 카드 전체의 가로 중앙에 고정하고
// 세로 위치만 각 폐점 행의 실제 위치에 맞춰 배치한다.
// ============================================================
function positionClosedStamps() {
  const card = document.querySelector('#page-list .table-card');
  if (!card) return;
  card.querySelectorAll('.row-closed-stamp').forEach(el => el.remove());
  const cardRect = card.getBoundingClientRect();
  card.querySelectorAll('tbody tr.store-closed').forEach(tr => {
    const r = tr.getBoundingClientRect();
    const stamp = document.createElement('div');
    stamp.className = 'row-closed-stamp';
    stamp.textContent = '매장 폐점';
    stamp.style.top = (r.top - cardRect.top + r.height / 2) + 'px';
    card.appendChild(stamp);
  });
}

let _stampResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_stampResizeTimer);
  _stampResizeTimer = setTimeout(positionClosedStamps, 150);
});

function toggleFilter(val, btn) {
  activeFilters.has(val) ? (activeFilters.delete(val), btn.classList.remove('on')) : (activeFilters.add(val), btn.classList.add('on'));
  renderList();
}
function clearFilters() {
  activeFilters.clear();
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
  renderList();
}

// ============================================================
// MODAL
// ============================================================
function openModal(i) {
  const s = STORES[i];
  document.getElementById('m-no').textContent = 'No.' + s.no;
  document.getElementById('m-name').textContent = s.name;
  document.getElementById('m-tags').innerHTML = `
    <span class="badge b-${s.type}">${s.type}</span>
    <span class="badge ${s.rondiOne === '론디원' ? 'b-론디원' : 'b-비론디원'}">${s.rondiOne}</span>
    <span class="badge b-${s.storeType}">${s.storeType}</span>
    <span class="freq ${freqCls(s.frequency)}">${s.frequency || '—'}</span>
    ${isEffectivelyClosed(s) ? `<span class="closed-tag" style="font-size:11px;padding:3px 10px;">폐점${s.closedDate ? ' · ' + s.closedDate : ''}</span>` : ''}
    ${s.rondiTopupBlocked ? `<span class="rondi-topup-tag" style="font-size:11px;padding:3px 10px;">론디페이 고객센터 지급불가</span>` : ''}
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
    ].filter(([, ds]) => ds).map(([label, ds]) => `<div class="visit-item"><label>${label}</label><span>${formatDate(parseDateStr(ds))}</span></div>`).join('');
    if (noticeRows) {
      noticeHtml = `
        <div class="sec-lbl" style="color:#b91c1c">폐업 공지</div>
        <div class="note-card warn">"${s.name}"의 폐업이 확정되어 공유드립니다.</div>
        <div class="visit-card" style="margin-top:8px">${noticeRows}</div>
        ${s.closedNoticeNote ? `<div class="note-card" style="margin-top:10px;white-space:pre-line">${s.closedNoticeNote}</div>` : ''}
      `;
    }
  }

  // 방문 예정일 계산
  let visitCardHtml = '';
  if (['매일','격일','부산/대구','대전'].includes(s.frequency)) {
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
  document.getElementById('m-body').innerHTML = `
    ${noticeHtml}
    ${visitCardHtml}
    <div class="sec-lbl" ${(visitCardHtml || noticeHtml) ? 'style="margin-top:20px"' : ''}>기본 정보</div>
    <div class="info-grid">
      <div class="info-cell"><label>라인</label><span><span class="b-line ${getLineClass(s.line, s.frequency)}">${s.line || '—'}</span></span></div>
      <div class="info-cell"><label>방문 요일 패턴</label><span style="color:var(--accent);font-size:13px">${sd ? sd.days : '—'}</span></div>
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
          <label>🅿 주차 정보</label>
          ${s.parkingUrl ? `<a href="${s.parkingUrl}" target="_blank" style="color:var(--accent2);font-weight:700;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:var(--accent2-light);padding:5px 12px;border-radius:6px;align-self:flex-start">🅿 주차 등록하기 ↗</a>` : ''}
          ${s.parking ? `<span style="font-size:13px;white-space:pre-line">${s.parking}</span>` : ''}
        </div>` : ''}
        ${(s.cctv || s.cctvUrl) ? `<div class="info-cell" style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px">
          <label>CCTV 정보</label>
          ${s.cctvUrl ? `<a href="${s.cctvUrl}" target="_blank" style="color:var(--text);font-weight:700;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:var(--bg);border:1.5px solid var(--border);padding:5px 12px;border-radius:6px;align-self:flex-start">CCTV 접속하기 ↗</a>` : ''}
          ${s.cctv ? `<span style="font-size:13px;white-space:pre-line">${s.cctv}</span>` : ''}
        </div>` : ''}
      </div>` : ''
    }
  `;
  document.getElementById('overlay').classList.add('open');
}
function closeOverlay(e) { if (e.target.id === 'overlay') document.getElementById('overlay').classList.remove('open'); }
