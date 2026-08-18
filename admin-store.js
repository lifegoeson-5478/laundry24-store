// ============================================================
// ADMIN: STORE LIST
// ============================================================
function renderAlist() {
  const q = document.getElementById('asearch').value.trim().toLowerCase();
  const items = STORES
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !q || s.name.toLowerCase().includes(q));

  document.getElementById('alist').innerHTML = items.map(({ s, i }) => `
    <li onclick="selectStore(${i})" id="ali-${i}" style="${s.isClosed ? 'opacity:.55' : ''}">
      <span class="ali-no">${s.no}</span>
      <span style="flex:1;font-weight:500">${s.name}${s.isClosed ? '<span class="closed-tag">폐점</span>' : ''}</span>
      <span class="b-line ${getLineClass(s.line, s.frequency)}" style="margin-right:6px;font-size:11px">${s.line || '—'}</span>
      <span style="font-size:11px;color:var(--text3);margin-right:8px">${s.frequency || ''}</span>
      <button class="ali-del" onclick="event.stopPropagation();askToggleClosed(${i})" title="${s.isClosed ? '폐점 해제' : '폐점 처리'}" style="margin-left:auto;${s.isClosed ? 'color:var(--accent2)' : ''}">${s.isClosed ? '↺' : '🔒'}</button>
      <button class="ali-del" onclick="event.stopPropagation();askDelete(${i})" title="삭제"></button>
    </li>
  `).join('') || '<li style="color:var(--text3);cursor:default;font-size:13px;font-weight:500">결과 없음</li>';
}

// ============================================================
// ADMIN: SELECT / NEW / SAVE / DELETE
// ============================================================
function selectStore(i) {
  editingIdx = i;
  highlightListItem(i);
  const s = STORES[i];
  document.getElementById('edit-card-title').innerHTML = `<span style="color:var(--accent)">[${s.no}] ${s.name} 수정</span>`;
  document.getElementById('btn-form-save').className = 'btn-save';
  document.getElementById('btn-form-save').textContent = '저장하기';
  document.getElementById('edit-card').className = 'edit-card';
  fillForm(s);
  switchEtab('store');
  showEditCard();
}

function openNewStoreForm() {
  editingIdx = -2;
  document.querySelectorAll('.astore-list li').forEach(el => el.classList.remove('selected'));
  document.getElementById('edit-card-title').innerHTML = `<span style="color:var(--accent2)">새 매장 추가</span>`;
  document.getElementById('btn-form-save').className = 'btn-save btn-save-new';
  document.getElementById('btn-form-save').textContent = '매장 추가';
  document.getElementById('edit-card').className = 'edit-card is-new';
  // 빈 폼
  fillForm({ name:'', type:'일반', rondiOne:'론디원', storeType:'복합형', line:'', frequency:'격일', openDate:'', selfWarranty:'', dryWarranty:'', selfAS:'', dryStation:'발생', kiosk:'', parking:'', parkingUrl:'', cctv:'', cctvUrl:'', storeNote:'', ownerNote:'', cardCancelPossible:true, localCurrencyAvailable:true, selfDeviceManaged:true, refundNote:'', isClosed:false, closedDate:'' });
  switchEtab('store');
  showEditCard();
}

function fillForm(s) {
  document.getElementById('f-name').value = s.name || '';
  document.getElementById('f-type').value = s.type || '일반';
  document.getElementById('f-rondi').value = s.rondiOne || '론디원';
  document.getElementById('f-stype').value = s.storeType || '복합형';
  document.getElementById('f-line').value = s.line || '';
  document.getElementById('f-freq').value = s.frequency || '격일';
  document.getElementById('f-open').value = s.openDate || '';
  document.getElementById('f-sw').value = s.selfWarranty || '';
  document.getElementById('f-dw').value = s.dryWarranty || '';
  document.getElementById('f-as').value = s.selfAS || '';
  document.getElementById('f-dry').value = s.dryStation || '발생';
  document.getElementById('f-kiosk').value = s.kiosk || '';
  document.getElementById('f-closed').value = s.isClosed ? 'true' : 'false';
  document.getElementById('f-closed-date').value = s.closedDate || '';
  document.getElementById('f-parking').value = s.parking || '';
  document.getElementById('f-parking-url').value = s.parkingUrl || '';
  document.getElementById('f-cctv').value = s.cctv || '';
  document.getElementById('f-cctv-url').value = s.cctvUrl || '';
  document.getElementById('f-sn').value = s.storeNote || '';
  document.getElementById('f-on').value = s.ownerNote || '';
  document.getElementById('f-card-cancel').value = s.cardCancelPossible === false ? 'false' : 'true';
  document.getElementById('f-local-currency').value = s.localCurrencyAvailable === false ? 'false' : 'true';
  document.getElementById('f-self-managed').value = s.selfDeviceManaged === false ? 'false' : 'true';
  document.getElementById('f-refund-note').value = s.refundNote || '';
  document.getElementById('save-msg').classList.remove('show');
}

// 폐점일을 입력하면 자동으로 "폐점"으로, 지우면 자동으로 "영업중"으로 동기화
function onClosedDateInput() {
  const val = document.getElementById('f-closed-date').value;
  document.getElementById('f-closed').value = val ? 'true' : 'false';
}

// 영업 상태를 직접 바꾸면 폐점일도 그에 맞게 동기화
function onClosedSelectChange() {
  const closed = document.getElementById('f-closed').value === 'true';
  const dateInput = document.getElementById('f-closed-date');
  if (!closed) {
    dateInput.value = '';
  } else if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

function showEditCard() {
  const card = document.getElementById('edit-card');
  card.style.display = 'block';
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function closeEditForm() {
  document.getElementById('edit-card').style.display = 'none';
  editingIdx = -1;
  document.querySelectorAll('.astore-list li').forEach(el => el.classList.remove('selected'));
}

function highlightListItem(i) {
  document.querySelectorAll('.astore-list li').forEach(el => el.classList.remove('selected'));
  document.getElementById('ali-' + i)?.classList.add('selected');
}

async function saveStore() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('매장명을 입력해주세요.', 'warn'); return; }

  const btn = document.getElementById('btn-form-save');
  btn.disabled = true; btn.textContent = '저장 중...';

  const data = {
    name,
    type: document.getElementById('f-type').value,
    rondiOne: document.getElementById('f-rondi').value,
    storeType: document.getElementById('f-stype').value,
    line: document.getElementById('f-line').value.trim(),
    frequency: document.getElementById('f-freq').value,
    openDate: document.getElementById('f-open').value,
    selfWarranty: document.getElementById('f-sw').value,
    dryWarranty: document.getElementById('f-dw').value,
    selfAS: document.getElementById('f-as').value.trim(),
    dryStation: document.getElementById('f-dry').value,
    kiosk: document.getElementById('f-kiosk').value,
    parking: document.getElementById('f-parking').value.trim(),
    parkingUrl: document.getElementById('f-parking-url').value.trim(),
    cctv: document.getElementById('f-cctv').value.trim(),
    cctvUrl: document.getElementById('f-cctv-url').value.trim(),
    storeNote: document.getElementById('f-sn').value.trim(),
    ownerNote: document.getElementById('f-on').value.trim(),
    cardCancelPossible: document.getElementById('f-card-cancel').value !== 'false',
    localCurrencyAvailable: document.getElementById('f-local-currency').value !== 'false',
    selfDeviceManaged: document.getElementById('f-self-managed').value !== 'false',
    refundNote: document.getElementById('f-refund-note').value.trim(),
    isClosed: document.getElementById('f-closed').value === 'true',
    closedDate: document.getElementById('f-closed-date').value || null,
  };

  try {
    if (editingIdx === -2) {
      // 새 매장 추가
      const maxNo = STORES.reduce((m, s) => Math.max(m, s.no || 0), 0);
      data.no = maxNo + 1;
      const result = await sbFetch('stores?select=*', {
        method: 'POST', prefer: 'return=representation',
        body: JSON.stringify(storeToRow(data)),
      });
      data._id = result[0].id;
      STORES.push(data);
      editingIdx = STORES.length - 1;
      document.getElementById('edit-card-title').innerHTML = `<span style="color:var(--accent)">[${data.no}] ${data.name} 수정</span>`;
      document.getElementById('btn-form-save').className = 'btn-save';
      document.getElementById('edit-card').className = 'edit-card';
    } else {
      // 기존 매장 수정
      data.no = STORES[editingIdx].no;
      data._id = STORES[editingIdx]._id;
      await sbFetch(`stores?id=eq.${data._id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify(storeToRow(data)),
      });
      STORES[editingIdx] = data;
    }
    showToast(editingIdx === -2 ? '매장이 추가되었습니다.' : '저장되었습니다.', 'success');
    renderList(); renderAlist();
    setTimeout(() => highlightListItem(STORES.findIndex(s => s.no === data.no)), 100);
  } catch(e) {
    showToast('저장 실패: ' + e.message, 'error', 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = editingIdx === -2 ? '매장 추가' : '저장하기';
  }
}

function askDelete(i) {
  deleteTargetIdx = i;
  const s = STORES[i];
  document.getElementById('confirm-desc').textContent = `"${s.name}" 매장을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?`;
  document.getElementById('confirm-overlay').classList.add('open');
}

function askToggleClosed(i) {
  const s = STORES[i];
  if (!s.isClosed) {
    // 폐점 처리는 편집 폼의 "폐점일" 입력을 통해서만 이루어지도록 유도
    selectStore(i);
    switchEtab('store');
    showToast('편집 폼에서 "폐점일"을 입력하면 자동으로 폐점 처리됩니다', 'warn', 3500);
    setTimeout(() => {
      const dateInput = document.getElementById('f-closed-date');
      if (dateInput) {
        dateInput.focus();
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  } else {
    showConfirmModal(
      '폐점 해제',
      `"${s.name}" 매장의 폐점 상태를 해제할까요?\n다시 정상 매장으로 돌아가 방문 일정 계산에 포함됩니다.`,
      () => setClosedStatus(i, false)
    );
  }
}

async function setClosedStatus(i, closed) {
  const s = STORES[i];
  const closedDate = closed ? new Date().toISOString().split('T')[0] : null;
  try {
    await sbFetch(`stores?id=eq.${s._id}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ is_closed: closed, closed_date: closedDate, updated_at: new Date().toISOString() }),
    });
    s.isClosed = closed;
    s.closedDate = closedDate || '';
    renderList(); renderAlist();
    if (editingIdx === i) fillForm(s);
    showToast(closed ? '폐점 처리되었습니다' : '폐점이 해제되었습니다', 'success');
  } catch(e) {
    showToast('처리 실패: ' + e.message, 'error', 4000);
  }
}

async function confirmDelete() {
  if (deleteTargetIdx < 0) return;
  const s = STORES[deleteTargetIdx];
  try {
    await sbFetch(`stores?id=eq.${s._id}`, { method: 'DELETE', prefer: 'return=minimal' });
    STORES.splice(deleteTargetIdx, 1);
    document.getElementById('confirm-overlay').classList.remove('open');
    if (editingIdx === deleteTargetIdx || editingIdx >= STORES.length) closeEditForm();
    deleteTargetIdx = -1;
    renderList(); renderAlist();
  } catch(e) {
    showToast('삭제 실패: ' + e.message, 'error', 4000);
    document.getElementById('confirm-overlay').classList.remove('open');
  }
}

// ============================================================
// ADMIN: SCHEDULE EDIT TABLE
// ============================================================
function renderSchedEditTable() {
  document.getElementById('sched-edit-tbody').innerHTML = schedData.map((sd, idx) => `
    <tr>
      <td>
        <div class="sched-type-label">
          <div class="sched-dot-circle" style="background:${sd.color}"></div>
          ${sd.label}
        </div>
      </td>
      <td><input id="se-${idx}-lines" value="${sd.lines}" placeholder="해당 라인"></td>
      <td><input id="se-${idx}-days" value="${sd.days}" placeholder="예: 월, 목, 토"></td>
      <td><textarea id="se-${idx}-note" placeholder="예: 추석 연휴 휴무">${sd.note}</textarea></td>
    </tr>
  `).join('');
}

async function saveSched() {
  const btn = document.querySelector('#apanel-sched .btn-save');
  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    for (let idx = 0; idx < schedData.length; idx++) {
      const sd = schedData[idx];
      sd.lines = document.getElementById(`se-${idx}-lines`).value;
      sd.days  = document.getElementById(`se-${idx}-days`).value;
      sd.note  = document.getElementById(`se-${idx}-note`).value;
      await sbFetch(`schedules?on_conflict=key`, {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify({ key: sd.key, label: sd.label, color: sd.color, lines: sd.lines, days: sd.days, note: sd.note, updated_at: new Date().toISOString() }),
      });
    }
    renderList();
    showToast('운송 일정이 저장되었습니다. 매장 목록에 즉시 반영됩니다.', 'success');
  } catch(e) {
    showToast('저장 실패: ' + e.message, 'error', 4000);
  } finally {
    btn.disabled = false; btn.textContent = '일정 저장';
  }
}

let schedUnlocked = false;

function openPwModal() {
  document.getElementById('pw-input').value = '';
  document.getElementById('pw-error').textContent = '';
  document.getElementById('pw-overlay').classList.add('open');
  setTimeout(() => document.getElementById('pw-input').focus(), 100);
}
function closePwModal() {
  document.getElementById('pw-overlay').classList.remove('open');
}
function togglePwVisible() {
  const input = document.getElementById('pw-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}
async function checkPassword() {
  const val = document.getElementById('pw-input').value;
  const btn = document.querySelector('.btn-pw-confirm');
  btn.disabled = true;
  let ok = false;
  try {
    ok = await sbFetch('rpc/verify_sched_password', {
      method: 'POST',
      body: JSON.stringify({ pwd: val }),
    });
  } catch (e) {
    ok = false;
  }
  btn.disabled = false;

  if (ok === true) {
    schedUnlocked = true;
    closePwModal();
    // 실제 탭 전환
    document.querySelectorAll('.atab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.apanel').forEach(el => el.classList.remove('active'));
    document.querySelector(`.atab[onclick="switchAtab('sched')"]`).classList.add('active');
    document.getElementById('apanel-sched').classList.add('active');
    renderSchedEditTable();
  } else {
    const err = document.getElementById('pw-error');
    err.textContent = '비밀번호가 올바르지 않습니다.';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
    setTimeout(() => { err.textContent = ''; }, 2500);
  }
}

function switchEtab(t) {
  document.getElementById('epanel-store').style.display = t === 'store' ? 'block' : 'none';
  document.getElementById('epanel-refund').style.display = t === 'refund' ? 'block' : 'none';
  const storeTab = document.getElementById('etab-store');
  const refundTab = document.getElementById('etab-refund');
  storeTab.style.borderBottomColor = t === 'store' ? 'var(--accent)' : 'transparent';
  storeTab.style.color = t === 'store' ? 'var(--accent)' : 'var(--text3)';
  refundTab.style.borderBottomColor = t === 'refund' ? 'var(--accent)' : 'transparent';
  refundTab.style.color = t === 'refund' ? 'var(--accent)' : 'var(--text3)';
}

function switchAtab(t) {
  if (t === 'sched' && !schedUnlocked) {
    openPwModal();
    return;
  }
  document.querySelectorAll('.atab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.apanel').forEach(el => el.classList.remove('active'));
  document.querySelector(`.atab[onclick="switchAtab('${t}')"]`).classList.add('active');
  document.getElementById('apanel-' + t).classList.add('active');
}
