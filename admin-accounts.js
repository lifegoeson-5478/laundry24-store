// ============================================================
// 계정 관리 (Edge Function 'admin-users' 호출 — 관리자만 성공함)
// ============================================================
async function callAdminUsers(payload) {
  const { data, error } = await sbClient.functions.invoke('admin-users', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadAccountsList() {
  const wrap = document.getElementById('accounts-list');
  wrap.innerHTML = '<span style="font-size:13px;color:var(--text3);">불러오는 중...</span>';
  try {
    const { users } = await callAdminUsers({ action: 'list' });
    renderAccountsList(users);
  } catch (e) {
    wrap.innerHTML = `<span style="font-size:13px;color:var(--danger);">목록을 불러오지 못했습니다: ${e.message}</span>`;
  }
}

function renderAccountsList(users) {
  const wrap = document.getElementById('accounts-list');
  if (!users.length) { wrap.innerHTML = '<span style="font-size:13px;color:var(--text3);">등록된 계정이 없습니다</span>'; return; }
  wrap.innerHTML = `
    <div class="acct-list">
      ${users.map(u => `
        <div class="acct-row">
          <span class="acct-email">${u.email}</span>
          <span class="acct-date mono">${(u.createdAt || '').slice(0, 10)}</span>
          ${u.isAdmin
            ? `<span class="acct-admin">관리자</span>`
            : ''}
          <button onclick="toggleAccountAdmin('${u.id}', ${!u.isAdmin})" class="btn btn-sm">${u.isAdmin ? '관리자 해제' : '관리자로 지정'}</button>
          <button onclick="deleteAccount('${u.id}', '${u.email.replace(/'/g, "\\'")}')" class="btn btn-sm btn-danger-ghost">삭제</button>
        </div>
      `).join('')}
    </div>`;
}

async function createAccount() {
  const email = document.getElementById('new-account-email').value.trim();
  const password = document.getElementById('new-account-password').value;
  const makeAdmin = document.getElementById('new-account-admin').checked;
  if (!email || !password) { showToast('이메일과 비밀번호를 입력해주세요', 'warn'); return; }
  const btn = document.getElementById('new-account-btn');
  btn.disabled = true; btn.textContent = '추가 중...';
  try {
    await callAdminUsers({ action: 'create', email, password, makeAdmin });
    document.getElementById('new-account-email').value = '';
    document.getElementById('new-account-password').value = '';
    document.getElementById('new-account-admin').checked = false;
    showToast('계정이 추가되었습니다', 'success');
    await loadAccountsList();
  } catch (e) {
    showToast('추가 실패: ' + e.message, 'error', 4000);
  } finally {
    btn.disabled = false; btn.textContent = '+ 추가';
  }
}

async function toggleAccountAdmin(userId, makeAdmin) {
  try {
    await callAdminUsers({ action: 'setAdmin', userId, makeAdmin });
    showToast(makeAdmin ? '관리자로 지정되었습니다' : '관리자 권한이 해제되었습니다', 'success');
    await loadAccountsList();
  } catch (e) {
    showToast('처리 실패: ' + e.message, 'error', 4000);
  }
}

function deleteAccount(userId, email) {
  showConfirmModal(
    '계정 삭제',
    `"${email}" 계정을 삭제할까요?\n삭제 후 복구가 불가능합니다.`,
    async () => {
      try {
        await callAdminUsers({ action: 'delete', userId });
        showToast('계정이 삭제되었습니다', 'success');
        await loadAccountsList();
      } catch (e) {
        showToast('삭제 실패: ' + e.message, 'error', 4000);
      }
    }
  );
}
