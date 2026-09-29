/**
 * 환불 목록 → 구글 스프레드시트 백업 (Apps Script 웹앱)
 *
 * 설치
 *  1. 백업 스프레드시트 > 확장 프로그램 > Apps Script 에 이 파일 내용을 붙여넣고 저장
 *     (SPREADSHEET_ID로 대상 시트를 지정하므로 독립 Apps Script 프로젝트에서도 동작)
 *  2. 프로젝트 설정(톱니) > 스크립트 속성 > TOKEN = 임의의 긴 비밀값 추가
 *  3. 배포 > 새 배포 > 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 > 배포
 *  4. 나온 웹앱 URL 끝에 ?token=비밀값 을 붙여 사이트 "스프레드시트 백업" 버튼 최초 클릭 시 입력
 *
 * 동작: 헤더(1행)는 필드명. 새 필드가 생기면 헤더 오른쪽에 추가.
 *       모든 칸이 동일한 행이 이미 있으면 건너뛰고, 나머지는 마지막 행 아래에 붙여넣음.
 */
// 백업 대상 스프레드시트 (주소의 /d/ 와 /edit 사이 값)
const SPREADSHEET_ID = '1r3JrK80zGndYuK2k8st0_j3S1LDhnV7uiqivkRgYWtA';
const SHEET_NAME = '환불목록';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // 동시에 두 명이 눌러도 중복 저장되지 않도록
  try {
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || e.parameter.token !== token) return json({ ok: false, error: 'unauthorized' });

    const rows = JSON.parse(e.postData.contents).rows || [];
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // 헤더 정리 (없던 필드는 오른쪽에 추가)
    let header = sh.getLastRow() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0] : [];
    const newKeys = [];
    rows.forEach(r => Object.keys(r).forEach(k => { if (!header.includes(k) && !newKeys.includes(k)) newKeys.push(k); }));
    if (newKeys.length) {
      header = header.concat(newKeys);
      sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    if (!header.length) return json({ ok: true, added: 0, skipped: 0 });

    // 기존 행 서명 (모든 칸 문자열 비교)
    const lastRow = sh.getLastRow();
    const existing = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, header.length).getDisplayValues() : [];
    const seen = new Set(existing.map(sig));

    const toAdd = [];
    rows.forEach(r => {
      const arr = header.map(k => toCell(r[k]));
      const s = sig(arr);
      if (seen.has(s)) return;
      seen.add(s);
      toAdd.push(arr.map(safeText));
    });

    if (toAdd.length) {
      // 일반 텍스트 서식: 날짜/숫자 자동 변환을 막아 다음 백업 때 중복 비교가 정확하도록
      sh.getRange(lastRow + 1, 1, toAdd.length, header.length).setNumberFormat('@').setValues(toAdd);
    }
    return json({ ok: true, added: toAdd.length, skipped: rows.length - toAdd.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function toCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function sig(arr) { return JSON.stringify(arr.map(v => String(v))); }
// =, +, -, @ 로 시작하면 수식으로 해석되지 않도록 ' 접두 (표시값은 그대로라 중복 비교에 영향 없음)
function safeText(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
