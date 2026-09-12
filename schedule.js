// ============================================================
// SCHEDULE DISPLAY
// ============================================================
function renderSchedDisplay() {
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById('sched-tbody').innerHTML = schedData.map(sd => {
    const currentPattern = resolveDaysForDate(sd, today);
    const eff = sd.effectiveDate ? new Date(sd.effectiveDate + 'T00:00:00') : null;
    const pendingBadge = (sd.pendingDays && eff && eff > today)
      ? `<div class="sched-note-badge" style="margin-top:4px;background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;"> ${sd.effectiveDate}부터: ${sd.pendingDays}</div>`
      : '';
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="sched-dot-circle" style="background:${sd.color}"></div>
          <span class="freq ${freqCls(sd.label)}">${sd.label}</span>
        </div>
      </td>
      <td style="color:var(--text2);font-size:13px">${sd.lines}</td>
      <td style="font-weight:600">${currentPattern}${pendingBadge}</td>
      <td>${sd.note ? `<span class="sched-note-badge"> ${sd.note}</span>` : '<span style="color:var(--text3);font-size:13px">—</span>'}</td>
    </tr>`;
  }).join('');
}
