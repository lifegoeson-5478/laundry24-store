// ============================================================
// ADMIN: 사용 통계 (usage_summary 뷰 집계)
// ============================================================
const USAGE_EVENT_LABELS = {
  page_view: '페이지 이동',
  store_view: '매장 상세 조회',
  refund_check: '환불 주체 확인',
  refund_submit: '환불 접수',
};

function usageTableHtml(headers, rows) {
  const th = headers.map(h => `<th style="padding:8px 10px;text-align:left;white-space:nowrap;">${h}</th>`).join('');
  const body = rows.length
    ? rows.map(r => `<tr style="border-bottom:1px solid var(--border);">${r.map(c => `<td style="padding:8px 10px;">${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" style="padding:16px;color:var(--text3);text-align:center;">데이터가 없습니다</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--border);">${th}</tr></thead><tbody>${body}</tbody></table>`;
}

async function loadUsageStats() {
  const wrap = document.getElementById('usage-stats-content');
  const days = Number(document.getElementById('usage-period').value);
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  wrap.innerHTML = '<div style="color:var(--text3);padding:12px;">불러오는 중...</div>';
  try {
    const rows = await sbFetch(`usage_summary?select=day,event,user_email,cnt&day=gte.${since}&limit=10000`) || [];

    const byEvent = {}, byUser = {}, byDay = {};
    rows.forEach(r => {
      const e = byEvent[r.event] ||= { cnt: 0, users: new Set() };
      e.cnt += r.cnt; e.users.add(r.user_email);
      const u = byUser[r.user_email] ||= {};
      u[r.event] = (u[r.event] || 0) + r.cnt;
      byDay[r.day] = (byDay[r.day] || 0) + r.cnt;
    });

    const activeUsers = Object.keys(byUser).length;
    const eventRows = Object.entries(byEvent).sort((a, b) => b[1].cnt - a[1].cnt)
      .map(([ev, v]) => [USAGE_EVENT_LABELS[ev] || ev, v.cnt.toLocaleString(), v.users.size]);
    const userRows = Object.entries(byUser)
      .map(([email, ev]) => [email || '-', (ev.store_view || 0), (ev.refund_check || 0), (ev.refund_submit || 0), Object.values(ev).reduce((a, b) => a + b, 0)])
      .sort((a, b) => b[4] - a[4]);
    const dayRows = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([d, c]) => [d, c.toLocaleString()]);

    wrap.innerHTML = `
      <div style="font-size:13px;color:var(--text2);margin-bottom:14px;">최근 ${days}일 · 활성 사용자 <strong>${activeUsers}</strong>명 · 기록 시작 이후 집계</div>
      <div class="panel-title" style="margin-top:6px;">기능별 사용량</div>
      ${usageTableHtml(['기능', '횟수', '사용자 수'], eventRows)}
      <div class="panel-title" style="margin-top:22px;">사용자별</div>
      ${usageTableHtml(['사용자', '매장 조회', '환불 확인', '환불 접수', '전체'], userRows)}
      <div class="panel-title" style="margin-top:22px;">일별 전체 사용량</div>
      ${usageTableHtml(['날짜', '횟수'], dayRows)}`;
  } catch (e) {
    wrap.innerHTML = `<div style="color:var(--danger);padding:12px;">불러오기 실패: ${e.message}<br><small style="color:var(--text3);">usage_logs 테이블/뷰가 생성됐는지 확인해주세요.</small></div>`;
  }
}
