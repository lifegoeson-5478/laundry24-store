// ============================================================
// SCHEDULE DISPLAY
// ============================================================
function renderSchedDisplay() {
  document.getElementById('sched-tbody').innerHTML = schedData.map(sd => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="sched-dot-circle" style="background:${sd.color}"></div>
          <span class="freq ${freqCls(sd.label)}">${sd.label}</span>
        </div>
      </td>
      <td style="color:var(--text2);font-size:13px">${sd.lines}</td>
      <td style="font-weight:600">${sd.days}</td>
      <td>${sd.note ? `<span class="sched-note-badge"> ${sd.note}</span>` : '<span style="color:var(--text3);font-size:13px">—</span>'}</td>
    </tr>
  `).join('');
}
