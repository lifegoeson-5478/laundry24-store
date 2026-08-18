// ============================================================
// REFUND FORM & ADMIN
// ============================================================

// 입금일 목록 저장/로드 (Supabase settings 테이블, JSON 배열)
// 3영업일 전 계산 (주말 제외)
function calcShinsinDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  let count = 0;
  while (count < 3) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d.toISOString().split('T')[0];
}

async function getPaymentDates() {
  try {
    const result = await sbFetch('settings?key=eq.paymentDates&select=value');
    const val = result?.[0]?.value;
    if (!val) return [];
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.sort() : [];
  } catch(e) { return []; }
}

async function savePaymentDates(dates) {
  const value = JSON.stringify(dates.sort());
  try {
    await sbFetch('settings?key=eq.paymentDates', { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch('settings', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({ key: 'paymentDates', value, updated_at: new Date().toISOString() }),
    });
  } catch(e) { showToast('저장 실패: ' + e.message); }
}

// ============================================================
// 상신 내용 생성 "학습" — 관리자가 직접 다듬은 결과물을 예시로 저장해두고
// 다음 생성 시 few-shot 예시로 함께 넘겨서 AI가 스타일을 참고하게 함
// ============================================================
async function getShinsinExamples() {
  try {
    const result = await sbFetch('settings?key=eq.shinsinExamples&select=value');
    const val = result?.[0]?.value;
    if (!val) return [];
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr : [];
  } catch(e) { return []; }
}

async function saveShinsinExamplesList(examples) {
  const value = JSON.stringify(examples);
  try {
    await sbFetch('settings?key=eq.shinsinExamples', { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch('settings', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({ key: 'shinsinExamples', value, updated_at: new Date().toISOString() }),
    });
  } catch(e) { showToast('학습 예시 저장 실패: ' + e.message); throw e; }
}

let _lastShinsinCasesText = '';

async function saveShinsinExampleFromCurrent() {
  const finalText = document.getElementById('shinsin-content-text').value.trim();
  if (!finalText) { showToast('저장할 내용이 없습니다', 'warn'); return; }
  if (!_lastShinsinCasesText) { showToast('참고할 원본 접수 목록 정보가 없습니다. 다시 생성해주세요', 'warn'); return; }
  const btn = document.getElementById('shinsin-learn-btn');
  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    const examples = await getShinsinExamples();
    examples.push({ cases: _lastShinsinCasesText, output: finalText, savedAt: new Date().toISOString() });
    // 최근 5개까지만 유지 (오래된 예시는 자동 정리)
    const trimmed = examples.slice(-5);
    await saveShinsinExamplesList(trimmed);
    showToast('학습 예시로 저장했습니다. 다음 생성 시 이 스타일을 참고합니다', 'success', 3500);
    btn.textContent = '✓ 이 내용으로 학습 저장';
  } catch(e) {
    btn.textContent = '✓ 이 내용으로 학습 저장';
  } finally {
    btn.disabled = false;
  }
}

async function addPaymentDate() {
  const val = document.getElementById('admin-payment-date').value;
  if (!val) return;
  const dates = await getPaymentDates();
  if (!dates.includes(val)) dates.push(val);
  await savePaymentDates(dates);
  document.getElementById('admin-payment-date').value = '';
  showToast('입금일이 추가되었습니다');
  renderPaymentDateList();
}

async function markPaymentDateSubmitted(date) {
  showConfirmModal(
    '상신 완료 처리',
    `${date} 입금일 상신을 완료 처리할까요?\n목록에서 제거되고 다음 입금일로 자동 전환됩니다.`,
    async () => {
      await removePaymentDate(date);
      showToast('상신 완료 처리되었습니다');
    }
  );
}

async function removePaymentDate(date) {
  let dates = await getPaymentDates();
  dates = dates.filter(d => d !== date);
  await savePaymentDates(dates);
  renderPaymentDateList();
}

async function renderPaymentDateList() {
  const dates = await getPaymentDates();
  const todayStr = new Date().toISOString().split('T')[0];
  const wrap = document.getElementById('admin-payment-date-list');
  const shinsinEl = document.getElementById('next-shinsin-date');
  const future = dates.filter(d => d >= todayStr);
  if (shinsinEl) shinsinEl.textContent = future.length ? calcShinsinDate(future[0]) : '-';
  if (!dates.length) {
    wrap.innerHTML = '<span style="font-size:13px;color:var(--text3);">등록된 입금일이 없습니다</span>';
    return;
  }
  wrap.innerHTML = dates.map(d => {
    const isNext = d >= todayStr && d === dates.find(x => x >= todayStr);
    const submitBtn = isNext
      ? `<button onclick="markPaymentDateSubmitted('${d}')" style="background:rgba(255,255,255,.25);border:none;border-radius:999px;cursor:pointer;color:inherit;font-size:12px;font-weight:700;line-height:1;padding:4px 10px;margin-left:2px;">상신 완료</button>`
      : '';
    return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;
      ${isNext ? 'background:var(--accent);color:white;' : 'background:var(--white);border:1.5px solid var(--border);color:var(--text2);'}">
      ${isNext ? ' ' : ''}${d}${isNext ? ' (다음)' : ''}
      ${submitBtn}
      <button onclick="removePaymentDate('${d}')" style="background:none;border:none;cursor:pointer;color:inherit;opacity:.7;font-size:14px;line-height:1;padding:0;">✕</button>
    </span>`;
  }).join('');
}

async function loadPaymentDate() {
  renderPaymentDateList();
}

async function getNextPaymentDate() {
  const dates = await getPaymentDates();
  const todayStr = new Date().toISOString().split('T')[0];
  const future = dates.filter(d => d >= todayStr);
  return future.length ? future[0] : null;
}

// 환불 방법 결정
function getRefundMethod() {
  if (!rfSelected || !rfDevice || !rfPayment && rfDevice !== '잔여론디페이') return '';
  const rondi = rfIsRondi(rfSelected);
  const isBonsa = rondi
    ? !(rfPayment === '현금' || rfPayment === '지역화폐')
    : rfDevice === '드라이스테이션';

  if (rfDevice === '잔여론디페이') return '계좌입금(잔여론디페이)';
  if (rfPayment === '현금') return '현금지급';
  if (rfPayment === '지역화폐') return '지역화폐환불';
  if (rfPayment === '론디페이') return '론디페이재지급';
  if (rfPayment === '카드') {
    if (isBonsa) return '본사계좌입금또는카드취소';
    return '카드취소';
  }
  return '';
}

function onRefundMethodChange() {
  const method = document.getElementById('rform-method-select').value;
  document.getElementById('rform-card-section').style.display = method === '카드취소' ? '' : 'none';
  document.getElementById('rform-account-section').style.display = method === '현금입금' ? '' : 'none';
  document.getElementById('rform-shinsin-wrap').style.display = 'none';
}

async function openRefundForm() {
  // 론디페이 결제 시 접수 불가 경고
  if (rfPayment === '론디페이') {
    document.getElementById('rondi-alert-overlay').style.display = 'flex';
    return;
  }
  // 론디원 + 카드 결제 시 경고 (체크박스는 절차 확인용, 본사/점주 분류에는 영향 없음)
  if (rfIsRondi(rfSelected) && rfPayment === '카드') {
    document.getElementById('rondi-card-exception-check').checked = false;
    document.getElementById('rondi-card-proceed-btn').disabled = true;
    document.getElementById('rondi-card-proceed-btn').style.background = 'var(--border2)';
    document.getElementById('rondi-card-proceed-btn').style.cursor = 'not-allowed';
    document.getElementById('rondi-card-alert-overlay').style.display = 'flex';
    return;
  }
  await _openRefundFormCore();
}

let isPartialCancel = false;

async function openPartialCancelForm() {
  isPartialCancel = true;

  const today = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\. /g,'-').replace('.','');
  document.getElementById('rform-date').value = today;
  document.getElementById('rform-store').value = rfSelected?.name || '';
  const devLabel = rfDevice;
  document.getElementById('rform-device').value = devLabel;
  document.getElementById('rform-payment').value = rfPayment || '-';
  document.getElementById('rform-title').textContent = '부분 취소 요청';
  document.getElementById('rform-subtitle').textContent =
    `현재 입력된 매장(${rfSelected?.name}) 및 선택된 내용(${devLabel}${rfPayment ? ' · ' + rfPayment : ''})을 기준으로 부분 취소를 요청합니다.`;

  // 기기번호 필드
  const needDevNum = rfDevice === '세탁기' || rfDevice === '건조기';
  document.getElementById('rform-devnum-wrap').style.display = needDevNum ? '' : 'none';
  document.getElementById('rform-devnum').value = '';

  // 환불방법: 부분취소 고정, 카드+계좌 정보 모두 표시
  const methodReadonly = document.getElementById('rform-method-readonly');
  const methodSelect = document.getElementById('rform-method-select');
  methodReadonly.value = '부분취소';
  methodReadonly.style.display = '';
  methodSelect.style.display = 'none';
  document.getElementById('rform-card-section').style.display = '';
  document.getElementById('rform-account-section').style.display = '';
  document.getElementById('rform-shinsin-wrap').style.display = 'none';

  // 초기화
  ['rform-manager','rform-type','rform-cause','rform-reason','rform-usedate','rform-customer-no','rform-member',
   'rform-cardco','rform-cardno','rform-appno','rform-appdate','rform-cardamt',
   'rform-bank','rform-accno','rform-holder','rform-accamt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? '' : '';
  });
  document.getElementById('rform-error').style.display = 'none';
  document.getElementById('rform-submit-btn').disabled = false;
  document.getElementById('rform-submit-btn').textContent = '접수 완료';
  document.getElementById('refund-form-overlay').style.display = 'flex';
  document.getElementById('refund-form-overlay').style.alignItems = 'flex-start';
}

async function _openRefundFormCore() {
  isPartialCancel = false;
  document.getElementById('rform-title').textContent = '환불 접수';

  // 입금일 로드 (가장 가까운 미래 입금일)
  const payDate = await getNextPaymentDate();

  const today = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\. /g,'-').replace('.','');
  document.getElementById('rform-date').value = today;
  document.getElementById('rform-store').value = rfSelected?.name || '';
  const devLabel = rfDevice === '잔여론디페이' ? '잔여 론디페이' : rfDevice;
  document.getElementById('rform-device').value = devLabel;
  document.getElementById('rform-payment').value = rfDevice === '잔여론디페이' ? '카드' : (rfPayment || '-');
  document.getElementById('rform-subtitle').textContent =
    `현재 입력된 매장(${rfSelected?.name}) 및 선택된 내용(${devLabel}${rfPayment ? ' · ' + rfPayment : ''})을 기준으로 환불됩니다.`;

  // 기기번호 필드
  const needDevNum = rfDevice === '세탁기' || rfDevice === '건조기';
  document.getElementById('rform-devnum-wrap').style.display = needDevNum ? '' : 'none';
  document.getElementById('rform-devnum').value = '';

  // 본사/점주 판단
  // 론디원 매장은 현금/지역화폐 결제를 제외하면 항상 본사 부담 (예외 확인 체크박스는 분류에 영향 없음)
  const rondi = rfIsRondi(rfSelected);
  const isBonsa = rfDevice === '잔여론디페이'
    ? (rfIsDirect(rfSelected) || rondi)
    : rfIsDirect(rfSelected) ? true
    : rondi
      ? !(rfPayment === '현금' || rfPayment === '지역화폐')
      : rfDevice === '드라이스테이션';

  const methodReadonly = document.getElementById('rform-method-readonly');
  const methodSelect = document.getElementById('rform-method-select');

  if (isBonsa) {
    // 본사: 계좌 입금 고정
    methodReadonly.value = '계좌입금';
    methodReadonly.style.display = '';
    methodSelect.style.display = 'none';
    document.getElementById('rform-card-section').style.display = 'none';
    document.getElementById('rform-account-section').style.display = '';
    // 다음 입금일
    const shinsinWrap = document.getElementById('rform-shinsin-wrap');
    shinsinWrap.style.display = payDate ? '' : 'none';
    if (payDate) document.getElementById('rform-shinsin').value = payDate;
  } else {
    // 점주: 카드 취소 / 현금 입금 선택
    methodReadonly.style.display = 'none';
    methodSelect.style.display = '';
    methodSelect.value = '카드취소';
    document.getElementById('rform-card-section').style.display = '';
    document.getElementById('rform-account-section').style.display = 'none';
    document.getElementById('rform-shinsin-wrap').style.display = 'none';
  }

  // 초기화
  ['rform-manager','rform-type','rform-cause','rform-reason','rform-usedate','rform-customer-no','rform-member',
   'rform-cardco','rform-cardno','rform-appno','rform-appdate','rform-cardamt',
   'rform-bank','rform-accno','rform-holder','rform-accamt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? '' : '';
  });
  document.getElementById('rform-error').style.display = 'none';
  document.getElementById('rform-submit-btn').disabled = false;
  document.getElementById('rform-submit-btn').textContent = '접수 완료';
  document.getElementById('refund-form-overlay').style.display = 'flex';
  document.getElementById('refund-form-overlay').style.alignItems = 'flex-start';
}

function closeRefundForm() {
  document.getElementById('refund-form-overlay').style.display = 'none';
}

async function submitRefundForm() {
  const manager = document.getElementById('rform-manager').value.trim();
  const cause = document.getElementById('rform-cause').value.trim();
  const reason = document.getElementById('rform-reason').value.trim();
  const customerNo = document.getElementById('rform-customer-no').value.trim();
  const member = document.getElementById('rform-member').value;
  if (!manager || !cause || !reason || !customerNo || !member) {
    const err = document.getElementById('rform-error');
    err.textContent = '담당자명, 상세원인, 취소사유, 고객번호, 회원여부는 필수입니다.';
    err.style.display = 'block';
    return;
  }

  const methodReadonly = document.getElementById('rform-method-readonly');
  const methodSelect = document.getElementById('rform-method-select');
  const method = methodReadonly.style.display !== 'none' ? methodReadonly.value : methodSelect.value;
  const isCard = method === '카드취소' || method === '카드 취소' || isPartialCancel;
  const isAccount = method === '계좌입금' || method === '현금입금' || isPartialCancel;
  const devNum = document.getElementById('rform-devnum').value;

  const payload = {
    접수일자: document.getElementById('rform-date').value,
    담당자명: manager,
    매장명: document.getElementById('rform-store').value,
    사용기기: document.getElementById('rform-device').value,
    기기번호: devNum || null,
    결제수단: document.getElementById('rform-payment').value,
    환불방법: method,
    문의유형: document.getElementById('rform-type').value.trim(),
    상세원인: cause,
    취소사유: reason,
    이용일시: document.getElementById('rform-usedate').value.trim() || null,
    고객번호: document.getElementById('rform-customer-no').value.trim() || null,
    회원여부: member,
    카드사명: isCard ? document.getElementById('rform-cardco').value.trim() : null,
    카드번호: isCard ? document.getElementById('rform-cardno').value.trim() : null,
    승인번호: isCard ? document.getElementById('rform-appno').value.trim() : null,
    승인일시: isCard ? document.getElementById('rform-appdate').value.trim() : null,
    최종취소금액: isCard ? document.getElementById('rform-cardamt').value.trim() : null,
    은행명: isAccount ? document.getElementById('rform-bank').value.trim() : null,
    계좌번호: isAccount ? document.getElementById('rform-accno').value.trim() : null,
    예금주: isAccount ? document.getElementById('rform-holder').value.trim() : null,
    최종환불금액: isAccount ? document.getElementById('rform-accamt').value.trim() : null,
    상신예정일: (method === '계좌입금' || method === '계좌 입금') && (rfIsRondi(rfSelected) || rfDevice === '드라이스테이션' || rfIsDirect(rfSelected)) ? (document.getElementById('rform-shinsin').value || null) : null,
    처리완료: false,
  };

  const btn = document.getElementById('rform-submit-btn');
  btn.disabled = true;
  btn.textContent = '접수 중...';

  try {
    const result = await sbFetch('refund_requests', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify(payload),
    });
    const savedId = Array.isArray(result) && result[0] ? result[0].id : null;
    closeRefundForm();
    const rondi = rfIsRondi(rfSelected);
    const isJumju = !rondi || (rondi && (rfPayment === '현금' || rfPayment === '지역화폐')) || isPartialCancel;
    if (isJumju) {
      showTemplateModal({ ...payload, id: savedId });
    } else {
      showToast('✅ 환불 접수가 완료되었습니다');
    }
  } catch(e) {
    const err = document.getElementById('rform-error');
    err.textContent = '접수 실패: ' + e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '접수 완료';
  }
}

// 번호 필요 없는 기기
const NO_NUM_DEVICES = new Set(['자판기','동전교환기','드라이스테이션','잔여 론디페이']);

function buildDeviceLabel(device, devNum) {
  if (NO_NUM_DEVICES.has(device)) return device;
  return devNum ? `${device} ${devNum}번` : device;
}

function showTemplateModal(p) {
  const devLabel = buildDeviceLabel(p.사용기기, p.기기번호);
  const isCard = p.환불방법 === '카드취소' || p.환불방법 === '카드 취소';
  const isRondiPay = p.사용기기 === '잔여 론디페이';
  const isPartial = p.환불방법 === '부분취소';
  let tmpl = '';

  if (isPartial) {
    tmpl = `안녕하세요 경영주님
런드리24 고객센터 ${p.담당자명}입니다.

고객님께서 요청하신 ${devLabel} 부분 환불 요청드립니다.

- 매장명: ${p.매장명}
- 사용장비: ${devLabel}
- 결제수단: ${p.결제수단}
- 사유: ${p.취소사유}

[환불 정보]
• 카드사: ${p.카드사명 || ''}
• 카드번호: ${p.카드번호 || ''}

• 결제된 금액: ${p.최종취소금액 || ''}원
• 결제/이용 시간: ${p.승인일시 || ''}
• 승인번호: ${p.승인번호 || ''}

혹시나 부분 취소가 어려우신 경우 아래 계좌로 환불 부탁드립니다.

• 계좌번호: ${p.계좌번호 || ''}
• 은행명: ${p.은행명 || ''}
• 예금주: ${p.예금주 || ''}

위 내용 확인 부탁드리며, 환불 진행 후 회신은 꼭 하단의 채팅상담 링크로 접속하시어 말씀 부탁드리겠습니다.

감사합니다.`;
  } else if (isRondiPay && isCard) {
    // 잔여 론디페이 카드 취소
    tmpl = `안녕하세요 경영주님,
런드리24 고객센터 ${p.담당자명}입니다.

${p.매장명} 이용하시는 고객님께서 잔여론디페이 카드 환불 접수하셨습니다. 환불 부탁드립니다.

- 매장명: ${p.매장명}
- 사유: ${p.취소사유}
- 카드사: ${p.카드사명 || ''}
- 카드번호: ${p.카드번호 || ''}
- 카드승인번호: ${p.승인번호 || ''}
- 승인일시: ${p.승인일시 || ''}
- 결제 금액: ${p.최종취소금액 || ''}원
- 고객 연락처: ${p.고객번호 || ''}

위 내용 확인 부탁드리며, 결제 취소 후 회신은 꼭 하단의 채팅상담 링크로 접속하시어 말씀 부탁드리겠습니다.

감사합니다.`;
  } else if (isRondiPay && !isCard) {
    // 잔여 론디페이 현금 환불
    tmpl = `안녕하세요 경영주님
런드리24 고객센터 ${p.담당자명}입니다.

${p.매장명} 이용하시는 고객님께서 잔여론디페이 환불 접수하셨습니다. 환불 부탁드립니다.

[ 환불 정보 ]
 - 전화번호 : ${p.고객번호 || ''}
 - 예금주명 : ${p.예금주 || ''}
 - 은행명 : ${p.은행명 || ''}
 - 계좌번호 : ${p.계좌번호 || ''}
 - 환불 금액 : ${p.최종환불금액 || ''}원

위 내용 확인 부탁드리며, 환불 하신 후 회신은 꼭 하단의 채팅상담 링크로 접속하시어 말씀 부탁드리겠습니다.

감사합니다.`;
  } else if (isCard) {
    // 기기 카드 취소
    tmpl = `안녕하세요 경영주님,
런드리24 고객센터 ${p.담당자명}입니다.

고객님께서 카드결제하신 ${devLabel} 환불 요청드립니다.

- 매장명: ${p.매장명}
- 이용일시: ${p.이용일시 || ''}
- 사용장비: ${devLabel}
- 결제수단: ${p.결제수단}
- 사유: ${p.취소사유}
- 카드사: ${p.카드사명 || ''}
- 카드번호: ${p.카드번호 || ''}
- 카드승인번호: ${p.승인번호 || ''}
- 승인일시: ${p.승인일시 || ''}
- 결제 금액: ${p.최종취소금액 || ''}원
- 고객 연락처: ${p.고객번호 || ''}

위 내용 확인 부탁드리며, 결제 취소 후 회신은 꼭 하단의 채팅상담 링크로 접속하시어 말씀 부탁드리겠습니다.

감사합니다.`;
  } else {
    // 기기 현금 환불 (계좌 입금)
    tmpl = `안녕하세요 경영주님
런드리24 고객센터 ${p.담당자명}입니다.

고객님의 ${devLabel} 환불 요청드립니다.

- 매장명: ${p.매장명}
- 이용일시: ${p.이용일시 || ''}
- 사용장비: ${devLabel}
- 결제수단: ${p.결제수단}
- 사유: ${p.취소사유}

[ 환불 정보 ]
 - 고객번호 : ${p.고객번호 || ''}
 - 예금주명 : ${p.예금주 || ''}
 - 은행명 : ${p.은행명 || ''}
 - 계좌번호 : ${p.계좌번호 || ''}
 - 환불 금액 : ${p.최종환불금액 || ''}원

위 내용 확인 부탁드리며, 환불 진행 후 회신은 꼭 하단의 채팅상담 링크로 접속하시어 말씀 부탁드리겠습니다.

감사합니다.`;
  }

  document.getElementById('template-content').textContent = tmpl;
  document.getElementById('template-copy-btn').textContent = '복사하기';
  document.getElementById('template-overlay').style.display = 'flex';

  // 템플릿 Supabase에 저장
  if (p.id) {
    sbFetch(`refund_requests?id=eq.${p.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ 템플릿: tmpl }),
    }).catch(() => {});
  }
}

function copyTemplate() {
  const text = document.getElementById('template-content').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('template-copy-btn');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = '복사하기', 2000);
  });
}

// 어드민 환불 목록
let refundList = [];
let refundSortKey = null;
let refundSortDir = 1;
let collapsedMonths = new Set();

function toggleSort(key) {
  if (refundSortKey === key) { refundSortDir *= -1; }
  else { refundSortKey = key; refundSortDir = 1; }
  ['_idx','사용기기','상신예정일'].forEach(k => {
    const el = document.getElementById('sort-icon-' + k);
    if (el) el.textContent = k === refundSortKey ? (refundSortDir === 1 ? '↑' : '↓') : '↕';
  });
  renderRefundList();
}

async function loadRefundList() {
  document.getElementById('refund-list-loading').style.display = 'block';
  document.getElementById('refund-list-wrap').style.display = 'none';
  try {
    refundList = await sbFetch('refund_requests?select=*&order=created_at.desc');
    renderRefundList();
  } catch(e) {
    document.getElementById('refund-list-loading').textContent = '불러오기 실패: ' + e.message;
  }
}

function renderRefundList() {
  const filter = document.getElementById('refund-filter-shinsin').value;
  const q = document.getElementById('refund-search').value.trim();
  const qc = document.getElementById('refund-search-customer').value.trim();
  let list = refundList.map((r, i) => ({ ...r, _idx: refundList.length - i }));
  if (filter !== 'all') list = list.filter(r => (r.처리완료 ? 'Y' : 'N') === filter);
  if (q) list = list.filter(r => (r.매장명 || '').includes(q));
  if (qc) list = list.filter(r => (r.고객번호 || '').includes(qc));
  if (refundSortKey) {
    list.sort((a, b) => {
      const va = refundSortKey === '_idx' ? a._idx : (a[refundSortKey] || '');
      const vb = refundSortKey === '_idx' ? b._idx : (b[refundSortKey] || '');
      return va < vb ? -refundSortDir : va > vb ? refundSortDir : 0;
    });
  }

  document.getElementById('refund-list-count').textContent = `전체 ${list.length}건`;

  // 월별 그룹핑
  const groups = {};
  list.forEach(r => {
    const d = r.접수일자 || r.created_at || '';
    const month = d.slice(0, 7) || '날짜없음';
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  });

  const tbody = document.getElementById('refund-list-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text3);">접수 내역이 없습니다</td></tr>';
  } else {
    let html = '';
    Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(month => {
      const isCollapsed = collapsedMonths.has(month);
      const label = month === '날짜없음' ? '날짜 없음' : month.replace('-', '년 ') + '월';
      html += `<tr style="background:var(--bg);">
        <td colspan="12" style="padding:8px 12px;font-size:12px;font-weight:800;color:var(--text2);cursor:pointer;user-select:none;" onclick="toggleMonth('${month}')">
          ${isCollapsed ? '▶' : '▼'} ${label} (${groups[month].length}건)
        </td>
      </tr>`;
      if (!isCollapsed) {
        groups[month].forEach(r => {
          html += `<tr style="border-bottom:1px solid var(--border);${r.처리완료 ? 'background:#f0fdf4;' : ''}cursor:pointer;" onclick="openRefundDetail('${r.id}')" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='${r.처리완료 ? '#f0fdf4' : ''}'">
            <td style="padding:8px 10px;color:var(--text3);">${r._idx}</td>
            <td style="padding:8px 10px;white-space:nowrap;">${r.접수일자 || '-'}</td>
            <td style="padding:8px 10px;white-space:nowrap;">${r.담당자명 || '-'}</td>
            <td style="padding:8px 10px;font-weight:600;white-space:nowrap;">${r.매장명 || '-'}</td>
            <td style="padding:8px 10px;white-space:nowrap;">${r.사용기기 || '-'}${r.기기번호 ? ' ' + r.기기번호 : ''}</td>
            <td style="padding:8px 10px;">${r.결제수단 || '-'}</td>
            <td style="padding:8px 10px;white-space:nowrap;">${r.환불방법 || '-'}</td>
            <td style="padding:8px 10px;">${r.최종취소금액 || r.최종환불금액 || '-'}</td>
            <td style="padding:8px 10px;">${r.고객번호 || '-'}</td>
            <td style="padding:8px 10px;"><span class="tt" data-tt="${(r.취소사유 || '').replace(/"/g, '&quot;')}"><span style="display:inline-block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">${r.취소사유 || '-'}</span></span></td>
            <td style="padding:8px 10px;white-space:nowrap;">${r.상신예정일 || '-'}</td>
            <td style="padding:8px 10px;text-align:center;white-space:nowrap;" onclick="event.stopPropagation()">
              ${r.처리완료 ? '<span style="font-size:11px;background:#dcfce7;color:#166534;padding:2px 6px;border-radius:999px;font-weight:700;">완료</span>' : ''}
              <input type="checkbox" ${r.처리완료 ? 'checked' : ''} onchange="toggleShinsin('${r.id}', this.checked)" style="width:16px;height:16px;cursor:pointer;margin-left:4px;vertical-align:middle;">
            </td>
          </tr>`;
        });
      }
    });
    tbody.innerHTML = html;
  }
  document.getElementById('refund-list-loading').style.display = 'none';
  document.getElementById('refund-list-wrap').style.display = 'block';
}

function toggleMonth(month) {
  if (collapsedMonths.has(month)) collapsedMonths.delete(month);
  else collapsedMonths.add(month);
  renderRefundList();
}

let currentDetailId = null;

function openRefundDetail(id) {
  currentDetailId = id;
  const r = refundList.find(x => x.id === id);
  if (!r) return;

  document.getElementById('refund-detail-subtitle').textContent = `${r.매장명 || ''} · ${r.접수일자 || ''} · ${r.담당자명 || ''}`;

  const section = (title, rows) => `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:var(--accent);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">${title}</div>
      <div style="background:var(--bg);border-radius:10px;overflow:hidden;">
        ${rows.filter(Boolean).join('')}
      </div>
    </div>`;

  const row = (label, val, highlight) => (!val || val === '-') ? '' :
    `<div style="display:flex;gap:12px;padding:9px 14px;border-bottom:1px solid var(--border);font-size:13px;${highlight ? 'background:#e6f7f5;' : ''}">
      <span style="color:var(--text3);min-width:90px;flex-shrink:0;font-weight:500;">${label}</span>
      <span style="color:var(--text);font-weight:600;">${val}</span>
    </div>`;

  const shinsinBadge = r.처리완료
    ? `<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;">✅ 완료</span>`
    : `<span style="background:#fef9c3;color:#854d0e;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;">⏳ 미완료</span>`;

  const content = `
    ${section('기본 정보', [
      row('접수일자', r.접수일자),
      row('담당자명', r.담당자명),
      row('매장명', r.매장명, true),
      row('사용기기', r.사용기기 + (r.기기번호 ? ' ' + r.기기번호 : '')),
      row('결제수단', r.결제수단),
      row('환불방법', r.환불방법, true),
      row('고객번호', r.고객번호),
      row('회원여부', r.회원여부),
    ])}
    ${section('접수 내용', [
      row('문의유형', r.문의유형),
      row('상세원인', r.상세원인),
      row('취소사유', r.취소사유),
      row('이용일시', r.이용일시),
    ])}
    ${(r.카드사명 || r.카드번호) ? section('카드 취소 정보', [
      row('카드사명', r.카드사명),
      row('카드번호', r.카드번호),
      row('승인번호', r.승인번호),
      row('승인일시', r.승인일시),
      row('최종취소금액', r.최종취소금액 ? r.최종취소금액 + '원' : ''),
    ]) : ''}
    ${(r.은행명 || r.계좌번호) ? section('계좌 환불 정보', [
      row('은행명', r.은행명),
      row('계좌번호', r.계좌번호),
      row('예금주', r.예금주),
      row('최종환불금액', r.최종환불금액 ? r.최종환불금액 + '원' : ''),
    ]) : ''}
    ${section('상신 정보', [
      row('입금예정일', r.상신예정일),
      `<div style="display:flex;gap:12px;padding:9px 14px;font-size:13px;align-items:center;">
        <span style="color:var(--text3);min-width:90px;flex-shrink:0;font-weight:500;">처리완료</span>
        ${shinsinBadge}
      </div>`,
    ])}
  `;
  document.getElementById('refund-detail-content').innerHTML = content;
  const tmplWrap = document.getElementById('refund-detail-template-wrap');
  if (r.템플릿) {
    document.getElementById('refund-detail-template').textContent = r.템플릿;
    tmplWrap.style.display = 'block';
  } else {
    tmplWrap.style.display = 'none';
  }
  document.getElementById('detail-copy-btn').textContent = '복사하기';
  document.getElementById('refund-detail-actions-view').style.display = 'flex';
  document.getElementById('refund-detail-actions-edit').style.display = 'none';
  document.getElementById('refund-detail-overlay').style.display = 'flex';
}

function efield(label, id, value, opts) {
  opts = opts || {};
  const val = (value ?? '').toString().replace(/"/g, '&quot;');
  let input;
  if (opts.select) {
    input = `<select id="${id}" style="flex:1;padding:7px 10px;border:1.5px solid var(--border2);border-radius:8px;font-size:13px;font-family:inherit;">
      ${opts.select.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o || '선택 안 함'}</option>`).join('')}
    </select>`;
  } else if (opts.textarea) {
    input = `<textarea id="${id}" rows="2" style="flex:1;padding:7px 10px;border:1.5px solid var(--border2);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;">${val}</textarea>`;
  } else if (opts.date) {
    input = `<input type="date" id="${id}" value="${val}" style="flex:1;padding:7px 10px;border:1.5px solid var(--border2);border-radius:8px;font-size:13px;font-family:inherit;">`;
  } else {
    input = `<input type="text" id="${id}" value="${val}" style="flex:1;padding:7px 10px;border:1.5px solid var(--border2);border-radius:8px;font-size:13px;font-family:inherit;">`;
  }
  return `<div style="display:flex;gap:12px;padding:8px 14px;border-bottom:1px solid var(--border);font-size:13px;align-items:center;">
    <span style="color:var(--text3);min-width:90px;flex-shrink:0;font-weight:500;">${label}</span>
    ${input}
  </div>`;
}

function enterRefundEditMode() {
  const r = refundList.find(x => x.id === currentDetailId);
  if (!r) return;

  const esection = (title, rows) => `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:var(--accent);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">${title}</div>
      <div style="background:var(--bg);border-radius:10px;overflow:hidden;">
        ${rows.join('')}
      </div>
    </div>`;

  const typeOptions = ['', '이용 불만족', '매장환경', '고객환경'];
  const causeOptions = ['', '오결제','이중결제','품목오등록','세탁불만족','세탁물손상','세탁물지연','수선불만족','장비오류','단순변심','이사','분실','폐점','기타'];

  const content = `
    ${esection('기본 정보', [
      efield('접수일자', 'redit-접수일자', r.접수일자),
      efield('담당자명', 'redit-담당자명', r.담당자명),
      efield('매장명', 'redit-매장명', r.매장명),
      efield('사용기기', 'redit-사용기기', r.사용기기),
      efield('기기번호', 'redit-기기번호', r.기기번호),
      efield('결제수단', 'redit-결제수단', r.결제수단),
      efield('환불방법', 'redit-환불방법', r.환불방법),
      efield('고객번호', 'redit-고객번호', r.고객번호),
      efield('회원여부', 'redit-회원여부', r.회원여부, { select: ['', '회원', '비회원'] }),
    ])}
    ${esection('접수 내용', [
      efield('문의유형', 'redit-문의유형', r.문의유형, { select: typeOptions }),
      efield('상세원인', 'redit-상세원인', r.상세원인, { select: causeOptions }),
      efield('취소사유', 'redit-취소사유', r.취소사유, { textarea: true }),
      efield('이용일시', 'redit-이용일시', r.이용일시),
    ])}
    ${esection('카드 취소 정보', [
      efield('카드사명', 'redit-카드사명', r.카드사명),
      efield('카드번호', 'redit-카드번호', r.카드번호),
      efield('승인번호', 'redit-승인번호', r.승인번호),
      efield('승인일시', 'redit-승인일시', r.승인일시),
      efield('최종취소금액', 'redit-최종취소금액', r.최종취소금액),
    ])}
    ${esection('계좌 환불 정보', [
      efield('은행명', 'redit-은행명', r.은행명),
      efield('계좌번호', 'redit-계좌번호', r.계좌번호),
      efield('예금주', 'redit-예금주', r.예금주),
      efield('최종환불금액', 'redit-최종환불금액', r.최종환불금액),
    ])}
    ${esection('상신 정보', [
      efield('입금예정일', 'redit-상신예정일', r.상신예정일, { date: true }),
    ])}
  `;
  document.getElementById('refund-detail-content').innerHTML = content;
  document.getElementById('refund-detail-template-wrap').style.display = 'none';
  document.getElementById('refund-detail-actions-view').style.display = 'none';
  document.getElementById('refund-detail-actions-edit').style.display = 'flex';
}

function cancelRefundEdit() {
  openRefundDetail(currentDetailId);
}

async function saveRefundEdit() {
  const fields = ['접수일자','담당자명','매장명','사용기기','기기번호','결제수단','환불방법','고객번호','회원여부',
    '문의유형','상세원인','취소사유','이용일시','카드사명','카드번호','승인번호','승인일시','최종취소금액',
    '은행명','계좌번호','예금주','최종환불금액','상신예정일'];
  const updates = {};
  fields.forEach(f => {
    const el = document.getElementById('redit-' + f);
    if (!el) return;
    const v = el.value.trim();
    updates[f] = v === '' ? null : v;
  });

  try {
    await sbFetch(`refund_requests?id=eq.${currentDetailId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify(updates),
    });
    const item = refundList.find(x => x.id === currentDetailId);
    if (item) Object.assign(item, updates);
    renderRefundList();
    openRefundDetail(currentDetailId);
    showToast('수정되었습니다');
  } catch(e) {
    showToast('저장 실패: ' + e.message);
  }
}

function closeRondiCardAlert() {
  document.getElementById('rondi-card-alert-overlay').style.display = 'none';
  document.getElementById('rondi-card-exception-check').checked = false;
  document.getElementById('rondi-card-proceed-btn').disabled = true;
  document.getElementById('rondi-card-proceed-btn').style.background = 'var(--border2)';
  document.getElementById('rondi-card-proceed-btn').style.cursor = 'not-allowed';
}

function onRondiCardExceptionChange() {
  const checked = document.getElementById('rondi-card-exception-check').checked;
  const btn = document.getElementById('rondi-card-proceed-btn');
  btn.disabled = !checked;
  btn.style.background = checked ? 'var(--accent)' : 'var(--border2)';
  btn.style.cursor = checked ? 'pointer' : 'not-allowed';
}

async function proceedRondiCardException() {
  closeRondiCardAlert();
  // 절차 확인용 체크박스일 뿐, 본사/점주 분류에는 영향 없음 (론디원+카드는 항상 본사 계좌입금)
  await _openRefundFormCore();
}

function showConfirmModal(title, desc, onConfirm) {
  document.getElementById('custom-confirm-title').textContent = title;
  document.getElementById('custom-confirm-desc').textContent = desc;
  const okBtn = document.getElementById('custom-confirm-ok');
  okBtn.onclick = () => {
    document.getElementById('custom-confirm-overlay').style.display = 'none';
    onConfirm();
  };
  document.getElementById('custom-confirm-overlay').style.display = 'flex';
}

async function deleteRefundDetail() {
  if (!currentDetailId) return;
  const r = refundList.find(x => x.id === currentDetailId);
  showConfirmModal(
    '접수건 삭제',
    `"${r?.매장명 || ''}" 접수건을 삭제할까요?\n삭제 후 복구가 불가능합니다.`,
    async () => {
      try {
        await sbFetch(`refund_requests?id=eq.${currentDetailId}`, {
          method: 'DELETE', prefer: 'return=minimal',
        });
        document.getElementById('refund-detail-overlay').style.display = 'none';
        refundList = refundList.filter(x => x.id !== currentDetailId);
        currentDetailId = null;
        renderRefundList();
        showToast('접수건이 삭제되었습니다');
      } catch(e) { showToast('삭제 실패: ' + e.message); }
    }
  );
}

function copyDetailTemplate() {
  const text = document.getElementById('refund-detail-template').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('detail-copy-btn');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = '복사하기', 2000);
  });
}

async function toggleShinsin(id, checked) {
  try {
    await sbFetch(`refund_requests?id=eq.${id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ 처리완료: checked }),
    });
    const item = refundList.find(r => r.id === id);
    if (item) item.처리완료 = checked;
    renderRefundList();
    showToast(checked ? '✅ 처리 완료됨' : '↩ 처리 미완료로 변경됨');
  } catch(e) {
    showToast('저장 실패: ' + e.message);
  }
}

const GEMINI_ENC_PASSPHRASE = 'L24RefundKey2024!';

async function decryptGeminiKey(encStr) {
  const [ivHex, encHex] = encStr.split(':');
  const iv = new Uint8Array(ivHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const enc = new Uint8Array(encHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(GEMINI_ENC_PASSPHRASE), 'PBKDF2', false, ['deriveKey']
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('salt'), iterations: 1, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-CBC', length: 256 }, false, ['decrypt']
  );
  const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, enc);
  return new TextDecoder().decode(dec);
}

let cachedGeminiKey = null;
async function getGeminiKey() {
  if (cachedGeminiKey) return cachedGeminiKey;
  try {
    const result = await sbFetch('settings?key=eq.geminiApiKeyEnc&select=value');
    const encVal = result?.[0]?.value;
    if (!encVal) return null;
    cachedGeminiKey = await decryptGeminiKey(encVal);
    return cachedGeminiKey;
  } catch(e) { return null; }
}

function saveGeminiKey() {
  showToast('API 키는 Supabase에 암호화 저장되어 있어요');
}

function loadGeminiKey() {
  const statusEl = document.getElementById('gemini-key-status');
  const inputEl = document.getElementById('gemini-api-key-input');
  if (statusEl) statusEl.textContent = '✓ Supabase에 암호화 저장됨';
  if (inputEl) inputEl.value = '••••••••••••••••••••';
}

async function generateShinsinContent() {
  const geminiKey = await getGeminiKey();
  if (!geminiKey) {
    showToast('Gemini API 키를 불러오지 못했습니다');
    return;
  }
  const payDate = await getNextPaymentDate();
  if (!payDate) {
    showToast('입금일을 먼저 등록해 주세요');
    return;
  }

  const target = refundList.filter(r =>
    !r.처리완료 &&
    (r.환불방법 === '계좌입금' || r.환불방법 === '계좌 입금') && r.상신예정일
  );

  if (!target.length) {
    showToast('상신 대상 접수건이 없습니다');
    return;
  }

  const totalAmt = target.reduce((sum, r) => {
    const amt = parseInt((r.최종환불금액 || '0').toString().replace(/[,원]/g, '')) || 0;
    return sum + amt;
  }, 0);

  // 모달 열기
  const overlay = document.getElementById('shinsin-content-overlay');
  document.getElementById('shinsin-content-subtitle').textContent =
    `입금일 ${payDate} 기준 ${target.length}건 · 총 ${totalAmt.toLocaleString()}원`;
  document.getElementById('shinsin-content-loading').style.display = 'block';
  document.getElementById('shinsin-content-result').style.display = 'none';
  document.getElementById('shinsin-content-error').style.display = 'none';
  overlay.style.display = 'flex';

  // Gemini에 보낼 데이터 정리
  const cases = target.map((r, i) => {
    const store = STORES.find(s => s.name === r.매장명);
    const isRondi = store?.rondiOne === '론디원';
    const isDirect = store?.type === '직영' || store?.type === '일반/직영';
    return (i+1) + '. 매장: ' + r.매장명 + '(' + (isRondi ? '론디원' : '비론디원') + (isDirect ? '/직영' : '') + '), 기기: ' + r.사용기기 + (r.기기번호 ? ' ' + r.기기번호 : '') + ', 결제수단: ' + r.결제수단 + ', 상세원인: ' + r.상세원인 + ', 취소사유: ' + r.취소사유 + ', 금액: ' + r.최종환불금액 + '원';
  }).join('\n');
  _lastShinsinCasesText = cases;

  // 관리자가 과거에 직접 다듬어 저장한 예시 (few-shot) 불러오기
  const learnedExamples = await getShinsinExamples();
  let exampleBlock = '';
  if (learnedExamples.length) {
    exampleBlock = '\n\n다음은 과거에 관리자가 직접 다듬어 최종 확정한 예시입니다. 그룹을 나누는 기준과 label 문구 스타일을 최대한 이 예시들에 맞춰주세요.\n\n' +
      learnedExamples.map((ex, idx) => `[예시 ${idx + 1} - 접수 목록]\n${ex.cases}\n[예시 ${idx + 1} - 관리자가 확정한 결과]\n${ex.output}`).join('\n\n') +
      '\n\n이제 아래의 실제 접수 목록에 대해 위 예시들의 스타일을 참고하여 답변하세요.\n';
  }

  const promptText = '아래는 런드리24 고객 환불 접수 목록입니다. 각 건을 적절한 크기로 묶어주세요.' + exampleBlock + '\n\n환불 접수 목록:\n' + cases + '\n\n응답 형식 (JSON만, 다른 설명 없이):\n{"groups": [{"label": "사유 설명", "indices": [1, 2]}, {"label": "사유 설명", "indices": [3]}]}\n\n그룹핑 규칙 (반드시 지켜주세요):\n1) 오결제, 이중결제는 반드시 하나로 합쳐서 label: "오결제로 인한 환불"\n2) 세탁물 손상/보상은 label: "세탁물 손상으로 인한 보상 처리 세탁비 환불"\n3) 세탁 불만족은 label: "세탁 불만족으로 인한 환불"\n4) 재케어 오과금은 label: "재케어 오과금으로 인한 환불"\n5) 잔여 론디페이 환불은 사유 무관하게 전부 label: "이사로 인한 론디페이 환불 요청" (반드시 이 label 사용)\n6) 기기 장비 오류(론디페이 아닌 경우)는 label: "장비 오류로 인한 환불"\n7) 품목 오등록은 label: "품목 오등록으로 인한 차액 환불"\n- 직영 매장 건은 label 앞에 "직영매장 " 추가\n- 매장명은 label에 절대 포함하지 말 것\n- 그룹 수는 4~8개\n- 모든 건이 반드시 하나의 그룹에 포함\n- JSON 외 다른 텍스트 절대 금지';

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + geminiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error('API 오류 ' + res.status + ': ' + (data.error?.message || JSON.stringify(data)));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('응답 내용이 비어있습니다: ' + JSON.stringify(data));

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const lineArr = parsed.groups.map(g => {
      const items = g.indices.map(idx => target[idx - 1]).filter(Boolean);
      const count = items.length;
      const amt = items.reduce((sum, r) => sum + (parseInt((r.최종환불금액 || '0').toString().replace(/[,원]/g, '')) || 0), 0);
      return '   * ' + g.label + ': ' + count + '건 (' + amt.toLocaleString() + '원)';
    });
    const result = '1. 목적: 런드리24 고객환불금 지급\n2. 금액: ' + totalAmt.toLocaleString() + '원\n3. 환불 상세사유 (총 ' + target.length + '건)\n' + lineArr.join('\n');

    document.getElementById('shinsin-content-text').value = result;
    document.getElementById('shinsin-content-loading').style.display = 'none';
    document.getElementById('shinsin-content-result').style.display = 'block';
    document.getElementById('shinsin-copy-btn').textContent = '복사하기';
  } catch(e) {
    document.getElementById('shinsin-content-loading').style.display = 'none';
    const errEl = document.getElementById('shinsin-content-error');
    errEl.textContent = '생성 실패: ' + e.message;
    errEl.style.display = 'block';
  }
}

function copyShinsinContent() {
  const text = document.getElementById('shinsin-content-text').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('shinsin-copy-btn');
    btn.textContent = '복사됨!';
    setTimeout(() => btn.textContent = '복사하기', 2000);
  });
}

async function exportRefundExcel() {
  const payDate = await getNextPaymentDate();
  if (!payDate) {
    showToast('입금일을 먼저 등록해 주세요');
    return;
  }
  const target = refundList.filter(r =>
    !r.처리완료 &&
    (r.환불방법 === '계좌입금' || r.환불방법 === '계좌 입금') && r.상신예정일
  );
  if (!target.length) {
    showToast('상신 대상 접수건이 없습니다');
    return;
  }

  const header = ['No','매장명','직영\n유무','고객번호','회원여부','론디원\n여부','환불 요청 항목','문의유형','상세사유','부담주체','은행명','계좌번호','예금주','최종\n환불\n금액','입금일자'];
  const rows = target.map((r, i) => {
    const store = STORES.find(s => s.name === r.매장명);
    const itemLabel = r.사용기기 + (r.기기번호 ? ' ' + r.기기번호 + '번' : '');
    const owner = (r.환불방법 === '계좌입금' || r.환불방법 === '계좌 입금') ? '본사' : '점주';
    return [
      i + 1,
      r.매장명 || '',
      store?.type || '',
      r.고객번호 || '',
      r.회원여부 || '',
      store?.rondiOne || '',
      itemLabel,
      r.문의유형 || '',
      (r.결제수단 || '') + '결제',
      owner,
      r.은행명 || '',
      r.계좌번호 || '',
      r.예금주 || '',
      r.최종환불금액 || '',
      payDate,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();

  const thinBorder = { style: 'thin', color: { rgb: 'CCCCCC' } };
  const allBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const specialCols = new Set(['직영\n유무','론디원\n여부','부담주체','입금일자']); // 베이지+빨강 헤더
  const ownerColIdx = header.indexOf('부담주체');
  const baseFont = { name: 'Google Sans', sz: 10 };

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      const isHeader = R === 0;
      const isOwnerCol = C === ownerColIdx;
      let font, fill;
      if (isHeader) {
        if (specialCols.has(header[C])) {
          font = { ...baseFont, bold: true, color: { rgb: 'FF0000' } };
          fill = { fgColor: { rgb: 'EEECE1' } };
        } else {
          font = { ...baseFont, bold: true, color: { rgb: 'FFFFFF' } };
          fill = { fgColor: { rgb: '31869B' } };
        }
      } else {
        if (isOwnerCol) {
          font = { ...baseFont, color: { rgb: 'FF0000' } };
          fill = { fgColor: { rgb: 'DCE6F1' } };
        } else {
          font = { ...baseFont, color: { rgb: '1A1D23' } };
        }
      }
      ws[addr].s = {
        border: allBorder,
        alignment: { vertical: 'center', horizontal: 'center', wrapText: isHeader },
        font,
        fill,
      };
    }
  }

  // 컬럼 너비
  ws['!cols'] = header.map(h => ({ wch: Math.max(10, h.length * 1.6) }));

  XLSX.utils.book_append_sheet(wb, ws, '상신리스트');

  const ymd = payDate.replace(/-/g, '').slice(2); // YYMMDD
  const filename = `(런드리24) 현금환불 계좌이체 필요 리스트_${ymd}.xlsx`;
  XLSX.writeFile(wb, filename);
}

async function deleteOldRefunds() {
  showConfirmModal(
    '6개월 이상 데이터 삭제',
    '6개월 이상 된 환불 접수 건을 삭제할까요?\n삭제 후 복구가 불가능합니다.',
    async () => {
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        await sbFetch(`refund_requests?created_at=lt.${sixMonthsAgo.toISOString()}`, {
          method: 'DELETE', prefer: 'return=minimal',
        });
        showToast(' 6개월 이상 데이터가 삭제되었습니다');
        loadRefundList();
      } catch(e) { showToast('삭제 실패: ' + e.message); }
    }
  );
}

// 환불 접수 버튼 표시 (rfShowResult에서 호출)
function showRefundApplyBtn() {
  const wrap = document.getElementById('rf-apply-wrap');
  const notice = document.getElementById('rf-apply-notice');
  const devLabel = rfDevice === '잔여론디페이' ? '잔여 론디페이' : rfDevice;
  const payLabel = rfPayment ? ' · ' + rfPayment : '';
  notice.textContent = `현재 입력된 매장(${rfSelected?.name}) 및 선택된 내용(${devLabel}${payLabel})을 기준으로 환불됩니다.`;
  wrap.style.display = 'block';

  const showPartial = !rfIsRondi(rfSelected) && rfDevice !== '잔여론디페이';
  document.getElementById('rf-partial-btn').style.display = showPartial ? 'block' : 'none';
}
