// ============================================================
// REFUND: 환불 주체 확인
// ============================================================
const RF_CARD_DEVICES = new Set(['건조기','세탁기','자판기','동전교환기']);
let rfStores = [], rfSelected = null, rfDevice = null, rfPayment = null;

async function loadRefundStores() {
  try {
    const res = await sbFetch('stores?select=id,no,name,type,rondi_one,card_cancel_possible,local_currency_available,self_device_managed,rondi_topup_blocked,refund_note&order=no');
    rfStores = res;
    document.getElementById('rf-loading').style.display = 'none';
    document.getElementById('rf-search-wrap').style.display = 'block';
  } catch(e) {
    document.getElementById('rf-loading').innerHTML = '매장 데이터를 불러오지 못했어요. 새로고침 해주세요.';
  }
}

function rfIsRondi(s) { return s.rondi_one === '론디원'; }
function rfIsDirect(s) { return s.type === '직영' || s.type === '일반/직영'; }

function rfOnSearch() {
  const q = document.getElementById('rf-store-input').value.trim();
  const dd = document.getElementById('rf-dropdown');
  document.getElementById('rf-clear-btn').style.display = q ? 'block' : 'none';
  if (!q) { dd.classList.remove('open'); return; }
  const hits = rfStores.filter(s => s.name.includes(q)).slice(0, 8);
  if (!hits.length) {
    dd.innerHTML = '<div class="rf-dd-item" style="color:var(--text3);">검색 결과 없음</div>';
    dd.classList.add('open'); return;
  }
  dd.innerHTML = hits.map(s => {
    const rondiTag = rfIsRondi(s)
      ? `<span class="rf-pill" style="background:var(--accent-light);color:var(--accent-text);">론디원</span>`
      : `<span class="rf-pill" style="background:#fff7ed;color:#c2410c;">비론디원</span>`;
    const cashTag = s.card_cancel_possible === false
      ? `<span class="rf-pill" style="background:#fee2e2;color:#b91c1c;">현금전용</span>` : '';
    return `<div class="rf-dd-item" onclick="rfPickStore(${s.id})"><span>${s.name}</span><div class="rf-dd-badges">${rondiTag}${cashTag}</div></div>`;
  }).join('');
  dd.classList.add('open');
}

function rfPickStore(id) {
  rfSelected = rfStores.find(s => s.id === id);
  rfDevice = null; rfPayment = null;
  document.getElementById('rf-store-input').value = rfSelected.name;
  document.getElementById('rf-clear-btn').style.display = 'block';
  document.getElementById('rf-dropdown').classList.remove('open');
  const rondi = rfIsRondi(rfSelected);
  const rc = rondi ? 'background:var(--accent-light);color:var(--accent-text);' : 'background:#fff7ed;color:#c2410c;';
  const tags = [
    `<span class="rf-pill" style="background:var(--bg);color:var(--text3);border:1px solid var(--border);">${rfSelected.type}</span>`,
    `<span class="rf-pill" style="${rc}">${rondi ? '론디원' : '비론디원'}</span>`,
    rfSelected.card_cancel_possible === false ? `<span class="rf-pill" style="background:#fee2e2;color:#b91c1c;">현금입금 전용</span>` : '',
    rfSelected.self_device_managed === false ? `<span class="rf-pill" style="background:#fff7ed;color:#c2410c;">셀프장비 미안내</span>` : '',
    rfSelected.rondi_topup_blocked === true ? `<span class="rf-pill" style="background:#fff7ed;color:#c2410c;">론디페이 고객센터 지급불가 (기존 잔액만 사용 가능)</span>` : '',
  ].filter(Boolean).join('');
  document.getElementById('rf-selected-store').innerHTML =
    `<div class="rf-selected-store"><div class="rf-store-name">${rfSelected.name}</div><div class="rf-store-tags">${tags}</div></div>`;
  document.getElementById('rf-selected-store').style.display = 'block';
  document.getElementById('rf-b1').classList.add('done');
  document.getElementById('rf-sec-device').style.display = 'block';
  document.querySelectorAll('[id^="rfdev-"]').forEach(c => c.classList.remove('on'));
  document.getElementById('rf-sec-payment').style.display = 'none';
  document.getElementById('rf-result').classList.remove('show');
  document.getElementById('rf-reset-btn').style.display = 'none';
}

function rfClearSearch() {
  document.getElementById('rf-store-input').value = '';
  document.getElementById('rf-clear-btn').style.display = 'none';
  document.getElementById('rf-dropdown').classList.remove('open');
  document.getElementById('rf-selected-store').style.display = 'none';
  document.getElementById('rf-sec-device').style.display = 'none';
  document.getElementById('rf-sec-payment').style.display = 'none';
  document.getElementById('rf-result').classList.remove('show');
  document.getElementById('rf-b1').classList.remove('done');
  document.getElementById('rf-reset-btn').style.display = 'none';
  document.getElementById('rf-apply-wrap').style.display = 'none';
  document.getElementById('rf-partial-btn').style.display = 'none';
  rfSelected = null; rfDevice = null; rfPayment = null;
}

function rfSelectDevice(dev) {
  rfDevice = dev; rfPayment = null;
  document.querySelectorAll('[id^="rfdev-"]').forEach(c => c.classList.remove('on'));
  document.getElementById('rfdev-' + dev).classList.add('on');
  document.getElementById('rf-b2').classList.add('done');
  document.getElementById('rf-result').classList.remove('show');
  document.getElementById('rf-reset-btn').style.display = 'none';
  if (dev === '잔여론디페이') {
    document.getElementById('rf-sec-payment').style.display = 'none';
    rfCalc(); return;
  }
  const isNonRondi = !rfIsRondi(rfSelected);
  document.getElementById('rfpay-카드').style.display = '';
  document.getElementById('rfpay-현금').style.display = dev === '드라이스테이션' ? 'none' : '';
  document.getElementById('rfpay-론디페이').style.display = (RF_CARD_DEVICES.has(dev) && isNonRondi) ? 'none' : '';
  document.getElementById('rfpay-지역화폐').style.display = rfSelected.local_currency_available === false ? 'none' : '';
  document.querySelectorAll('[id^="rfpay-"]').forEach(c => c.classList.remove('on'));
  document.getElementById('rf-sec-payment').style.display = 'block';
}

function rfSelectPayment(pay) {
  rfPayment = pay;
  document.querySelectorAll('[id^="rfpay-"]').forEach(c => c.classList.remove('on'));
  document.getElementById('rfpay-' + pay).classList.add('on');
  document.getElementById('rf-b3').classList.add('done');
  rfCalc();
}

function rfCalc() {
  if (!rfSelected || !rfDevice) return;
  const rondi = rfIsRondi(rfSelected);
  const isCashOnly = rfSelected.card_cancel_possible === false;
  // 본사 = 초록, 점주 = 주황 (결과 영역 위쪽 선·마침표 색)
  const CT = 'var(--accent)';
  const CA = '#F59E0B';

  if (rfDevice === '잔여론디페이') {
    const isBonsa = rondi;
    const c = isBonsa ? CT : CA;
    rfShowResult(isBonsa, c, `
      <div class="rf-step-row"><div class="rf-snum mono">01</div><div>카드 취소 <span style="font-size:12px;opacity:.7;">(론디페이 사용 이력 없을 경우)</span></div></div>
      <div class="rf-step-row"><div class="rf-snum mono">02</div><div>계좌입금 <span style="font-size:12px;opacity:.7;">(론디페이 사용 이력 있을 경우)</span></div></div>`);
    return;
  }
  if (!rfPayment) return;

  let isBonsa = false;
  if (rfIsDirect(rfSelected)) { isBonsa = true; }
  else if (rondi) { isBonsa = !(rfPayment === '현금' || rfPayment === '지역화폐'); }
  else { isBonsa = rfDevice === '드라이스테이션'; }
  const c = isBonsa ? CT : CA;

  let steps = '';
  if (isBonsa) {
    if (rfPayment === '카드' && RF_CARD_DEVICES.has(rfDevice) && !rfIsDirect(rfSelected)) {
      steps = `
        <div class="rf-step-row"><div class="rf-snum mono">01</div><div>론디페이로 환불 제안</div></div>
        <div class="rf-step-row"><div class="rf-snum mono">02</div><div>고객이 거절 시 → <strong>망치에서 카드 취소 가능</strong></div></div>`;
    } else if (rfPayment === '론디페이' && RF_CARD_DEVICES.has(rfDevice)) {
      steps = `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>결제한 론디페이 금액 재지급</div></div>`;
    } else if (!rondi && rfDevice !== '드라이스테이션') {
      // 비론디원 매장은 셀프장비(세탁기/건조기/자판기/동전교환기)에서 론디페이 사용이 불가능하므로 제안 단계 없이 바로 본사 계좌입금
      // (단, 드라이스테이션은 비론디원 매장도 론디페이 사용 가능하므로 이 예외에서 제외)
      steps = `<div class="rf-step-row"><div class="rf-snum mono">01</div><div><strong>본사 계좌입금</strong>으로 처리 <span style="font-size:12px;opacity:.7;">(비론디원 매장은 셀프장비에서 론디페이 사용 불가)</span></div></div>`;
    } else {
      steps = `
        <div class="rf-step-row"><div class="rf-snum mono">01</div><div>론디페이로 환불 제안</div></div>
        <div class="rf-step-row"><div class="rf-snum mono">02</div><div>고객이 거절 시 → <strong>본사 계좌입금</strong>으로 처리</div></div>`;
    }
  } else {
    if (rfPayment === '현금') steps = `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>현금 지급</div></div>`;
    else if (rfPayment === '지역화폐') steps = `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>지역화폐 환불</div></div>`;
    else if (rfPayment === '론디페이') steps = `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>결제한 론디페이 금액 재지급</div></div>`;
    else steps = isCashOnly
      ? `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>현금 입금 <span style="font-size:12px;opacity:.7;">(카드 취소 불가 매장)</span></div></div>`
      : `<div class="rf-step-row"><div class="rf-snum mono">01</div><div>카드 취소</div></div>`;
  }
  rfShowResult(isBonsa, c, steps);
}

function rfShowResult(isBonsa, color, stepsHtml) {
  const note = rfSelected.refund_note && !['NULL','EMPTY',''].includes(rfSelected.refund_note)
    ? `<div class="rf-note-box" style="border-left-color:${color};"><span style="white-space:pre-line;">${rfSelected.refund_note}</span></div>` : '';
  const el = document.getElementById('rf-result');
  el.innerHTML = `
    <div class="rf-result-top">
      <div>
        <div class="rf-result-label mono">환불 주체</div>
        <div class="rf-result-owner">${isBonsa ? '본사 환불' : '점주 환불'}<span style="color:${color};">.</span></div>
      </div>
      <div class="rf-result-store-tag mono">${rfSelected.name}</div>
    </div>
    <div class="rf-steps-lbl mono">환불 절차</div>
    ${stepsHtml}${note}`;
  el.style.borderTopColor = color;
  el.classList.add('show');
  document.getElementById('rf-reset-btn').style.display = 'block';
  showRefundApplyBtn();
}
function rfFullReset() {
  rfClearSearch();
  document.getElementById('rf-store-input').focus();
}
