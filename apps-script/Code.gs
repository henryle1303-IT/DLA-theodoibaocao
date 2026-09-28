/**
 * KIỂM TRA HÀNG TUẦN - P.QLKH-ĐBCL - HK1 2026-2027
 * File: TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027
 *
 * Việc 1: Đọc sheet [Dashboard HT] -> gửi email tổng hợp cho Hiệu trưởng.
 * Việc 2: Xem sheet [Báo cáo tuần] -> mục tiêu nào tuần này chưa nhập
 *         -> gửi email nhắc Người thực hiện (CC Người kiểm).
 *
 * Cài đặt:
 *   1. Mở Google Sheet > Tiện ích mở rộng > Apps Script, dán file này vào.
 *   2. Sửa CONFIG bên dưới (email Hiệu trưởng, email chuyên viên...).
 *      Hoặc thêm cột "Email" vào sheet [DS_ChuyenVien] (A: Họ và tên, B: Chức vụ, C: Email).
 *   3. Chạy thử hàm chayThu() (TEST_MODE = true: mọi email gửi về chính bạn).
 *   4. Chạy hàm caiDatTrigger() một lần để tự chạy hằng tuần.
 */

const CONFIG = {
  // Để trống nếu script gắn trực tiếp vào file Sheet (container-bound)
  SPREADSHEET_ID: '1V0i8iCyzv3XWexdE8rZkgWYliu7-gmpQoUTXz6n1s1I',
  TIMEZONE: 'Asia/Ho_Chi_Minh',

  SHEET_DASHBOARD: 'Dashboard HT',
  SHEET_BAO_CAO: 'Báo cáo tuần',
  SHEET_MUC_TIEU: 'Mục tiêu học kỳ',
  SHEET_CHUYEN_VIEN: 'DS_ChuyenVien',

  // Người nhận email Dashboard
  EMAIL_HIEU_TRUONG: ['hieutruong@daihoclongan.edu.vn'],
  CC_DASHBOARD: [], // ví dụ email Trưởng phòng

  // CC thêm trong email nhắc nhở (ngoài Người kiểm), ví dụ Trưởng phòng
  CC_NHAC_NHO: [],

  // Dùng khi sheet [DS_ChuyenVien] chưa có cột Email
  EMAIL_CHUYEN_VIEN: {
    'Nguyễn Văn Toàn': '',
    'Nguyễn Thụy Hoài Khanh': '',
    'Đỗ Quốc Dũng': '',
    'Nguyễn Tiến Hùng': '',
    'Phạm Thị Hồng Nhung': '',
    'Đặng Công Danh': ''
  },

  // true: không gửi cho người thật, mọi email gửi về tài khoản đang chạy script
  TEST_MODE: true,

  // Giờ chạy trigger hằng tuần (thứ Hai, sau hạn 10h nhập báo cáo)
  TRIGGER_HOUR: 10
};

/* ======================= HÀM CHÍNH ======================= */

/** Hàm được trigger gọi hằng tuần. */
function kiemTraHangTuan() {
  const ss = getSpreadsheet_();
  const monday = getCurrentMonday_();
  const chuaBaoCao = timMucTieuChuaBaoCao_(ss, monday);

  guiEmailNhacNho_(ss, chuaBaoCao, monday);
  guiEmailDashboard_(ss, chuaBaoCao, monday);
}

/** Chạy thử với TEST_MODE = true. */
function chayThu() {
  CONFIG.TEST_MODE = true;
  kiemTraHangTuan();
}

/** Tạo trigger chạy mỗi thứ Hai lúc TRIGGER_HOUR giờ. Chạy một lần. */
function caiDatTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kiemTraHangTuan')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('kiemTraHangTuan')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(CONFIG.TRIGGER_HOUR)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  Logger.log('Đã cài trigger: thứ Hai hằng tuần lúc %s giờ.', CONFIG.TRIGGER_HOUR);
}

/* ================= VIỆC 2: KIỂM TRA BÁO CÁO TUẦN ================= */

/**
 * Trả về danh sách mục tiêu đang trong kỳ nhưng chưa có dòng báo cáo
 * (có Mã MT và có nội dung) cho tuần `monday`.
 */
function timMucTieuChuaBaoCao_(ss, monday) {
  const mondayKey = dateKey_(monday);
  const sunday = addDays_(monday, 6);

  // Mục tiêu đã báo cáo tuần này
  const bc = ss.getSheetByName(CONFIG.SHEET_BAO_CAO).getDataRange().getValues();
  const hdrBc = findHeaderRow_(bc, 'Mã MT');
  const daBaoCao = new Set();
  for (let r = hdrBc + 1; r < bc.length; r++) {
    const row = bc[r];
    const tuan = parseDate_(row[0]);
    const maMT = String(row[1]).trim();
    // Có nội dung: Đã xong tuần này (E) hoặc Kế hoạch tuần tới (G) hoặc Mã mốc (F)
    const coNoiDung = [row[4], row[5], row[6]].some(v => String(v).trim() !== '');
    if (tuan && dateKey_(tuan) === mondayKey && maMT && coNoiDung) {
      daBaoCao.add(maMT);
    }
  }

  // Danh sách mục tiêu cần báo cáo
  const mt = ss.getSheetByName(CONFIG.SHEET_MUC_TIEU).getDataRange().getValues();
  const hdrMt = findHeaderRow_(mt, 'Mã MT');
  const ketQua = [];
  for (let r = hdrMt + 1; r < mt.length; r++) {
    const [ma, ten, nguoiTH, nguoiKiem, batDau, deadline] = mt[r];
    const maMT = String(ma).trim();
    if (!/^HK\d/i.test(maMT)) continue;

    const dStart = parseDate_(batDau);
    const dEnd = parseDate_(deadline);
    if (dStart && dStart > sunday) continue; // chưa đến kỳ
    if (dEnd && dEnd < monday) continue;     // đã kết thúc

    if (!daBaoCao.has(maMT)) {
      ketQua.push({
        maMT: maMT,
        ten: String(ten).trim(),
        nguoiTH: String(nguoiTH).trim(),
        nguoiKiem: String(nguoiKiem).trim(),
        trangThai: String(mt[r][11] || '').trim(),
        tuanKhongBC: mt[r][10]
      });
    }
  }
  return ketQua;
}

function guiEmailNhacNho_(ss, chuaBaoCao, monday) {
  if (chuaBaoCao.length === 0) {
    Logger.log('Tất cả mục tiêu đã báo cáo tuần %s.', fmt_(monday));
    return;
  }
  const emails = getEmailMap_(ss);
  const url = ss.getUrl() + '#gid=' + ss.getSheetByName(CONFIG.SHEET_BAO_CAO).getSheetId();

  // Gom theo Người thực hiện
  const theoNguoi = {};
  chuaBaoCao.forEach(m => (theoNguoi[m.nguoiTH] = theoNguoi[m.nguoiTH] || []).push(m));

  Object.keys(theoNguoi).forEach(nguoi => {
    const ds = theoNguoi[nguoi];
    const to = emails[nguoi];
    if (!to) {
      Logger.log('Không tìm thấy email của "%s" - bỏ qua.', nguoi);
      return;
    }
    const cc = uniq_(ds.map(m => emails[m.nguoiKiem]).concat(CONFIG.CC_NHAC_NHO))
      .filter(e => e && e !== to);

    const rows = ds.map(m =>
      '<tr>' + td_(m.maMT) + td_(m.ten) + td_(m.trangThai) +
      td_(m.tuanKhongBC === '' ? '' : m.tuanKhongBC, 'center') + '</tr>').join('');

    const subject = '[Nhắc nhở] Chưa nhập Báo cáo tuần ' + fmt_(monday) + ' - P.QLKH-ĐBCL';
    const html =
      '<p>Kính gửi Anh/Chị <b>' + esc_(nguoi) + '</b>,</p>' +
      '<p>Đến thời điểm kiểm tra (' + fmt_(new Date(), 'HH:mm dd/MM/yyyy') + '), sheet ' +
      '<b>[Báo cáo tuần]</b> chưa có báo cáo tuần <b>' + fmt_(monday) + '</b> cho ' +
      ds.length + ' mục tiêu Anh/Chị phụ trách:</p>' +
      '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:13px">' +
      '<tr style="background:#f2f2f2">' + th_('Mã MT') + th_('Mục tiêu') + th_('Trạng thái') +
      th_('Tuần liên tiếp không BC') + '</tr>' + rows + '</table>' +
      '<p>Đề nghị Anh/Chị cập nhật ngay: mỗi mục tiêu ghi <b>một dòng mới</b> ở cuối bảng ' +
      '(Tuần = ' + fmt_(monday) + ', Mã MT, Kết quả đã xong, Kế hoạch tuần tới, Vướng mắc, Link minh chứng).</p>' +
      '<p><a href="' + url + '">Mở sheet Báo cáo tuần</a></p>' +
      '<p>Trân trọng.</p>' +
      '<p style="color:#888;font-size:11px">Email gửi tự động từ hệ thống theo dõi tiến độ P.QLKH-ĐBCL.</p>';

    sendMail_(to, cc, subject, html);
  });
}

/* ================= VIỆC 1: EMAIL DASHBOARD HT ================= */

function guiEmailDashboard_(ss, chuaBaoCao, monday) {
  const sh = ss.getSheetByName(CONFIG.SHEET_DASHBOARD);
  const v = sh.getDataRange().getDisplayValues();

  const iSec1 = findRowStartsWith_(v, '1.');
  const iSec2 = findRowStartsWith_(v, '2.');
  const iHdr = findHeaderRow_(v, 'Mã');
  const title = (v[0][0] || v[1][0] || 'DASHBOARD HIỆU TRƯỞNG').trim();

  let html = '<div style="font-family:Arial,sans-serif;font-size:13px">';
  html += '<p>Kính gửi Thầy Hiệu trưởng,</p>';
  html += '<p>Phòng QLKH-ĐBCL xin gửi tình hình thực hiện mục tiêu học kỳ, tuần <b>' +
    fmt_(monday) + '</b> (trích từ sheet Dashboard HT):</p>';
  html += '<h3 style="color:#1f4e79">' + esc_(title) + '</h3>';

  // Mục 1: các chỉ số cần xử lý (cặp nhãn - giá trị ở cột A/B và E/F)
  if (iSec1 >= 0) {
    html += '<h4>' + esc_(v[iSec1][0]) + '</h4>';
    html += '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">';
    const end = iSec2 > 0 ? iSec2 : iSec1 + 8;
    for (let r = iSec1 + 1; r < end; r++) {
      [[0, 1, 2], [4, 5, 6]].forEach(([l, val, note]) => {
        const label = clean_(v[r][l]);
        if (!label) return;
        const value = v[r][val];
        const canhBao = /^\d+$/.test(value) && Number(value) > 0 &&
          /TRỄ|QUÁ HẠN|CẢNH BÁO|CHƯA BÁO CÁO|Vướng mắc|không đạt|chưa khai/i.test(label);
        html += '<tr>' + td_(label) +
          '<td align="center" style="font-weight:bold;' + (canhBao ? 'color:#c00000' : '') + '">' +
          esc_(value) + '</td>' + td_(clean_(v[r][note])) + '</tr>';
      });
    }
    html += '</table>';
  }

  // Mục 2: bảng trạng thái mục tiêu
  if (iHdr >= 0) {
    html += '<h4>' + esc_(iSec2 >= 0 ? v[iSec2][0] : 'TRẠNG THÁI MỤC TIÊU') + '</h4>';
    const hdr = v[iHdr].map(clean_);
    const nCol = lastNonEmpty_(hdr) + 1;
    html += '<table cellpadding="5" cellspacing="0" border="1" style="border-collapse:collapse;font-size:12px">';
    html += '<tr style="background:#1f4e79;color:#fff">' +
      hdr.slice(0, nCol).map(h => th_(h)).join('') + '</tr>';
    let r = iHdr + 1;
    for (; r < v.length && String(v[r][0]).trim() !== ''; r++) {
      const trangThai = v[r][9] || '';
      html += '<tr style="background:' + mauTrangThai_(trangThai) + '">' +
        v[r].slice(0, nCol).map(c => td_(c)).join('') + '</tr>';
    }
    html += '</table>';

    // Các phần còn lại phía dưới (nếu có)
    const conLai = v.slice(r).filter(row => row.some(c => String(c).trim() !== ''));
    if (conLai.length) {
      html += '<table cellpadding="5" cellspacing="0" border="1" style="border-collapse:collapse;font-size:12px;margin-top:12px">';
      conLai.forEach(row => {
        const n = lastNonEmpty_(row) + 1;
        html += '<tr>' + row.slice(0, n).map(c => td_(c)).join('') + '</tr>';
      });
      html += '</table>';
    }
  }

  // Tình hình nhập báo cáo tuần
  html += '<h4>3. TÌNH HÌNH NHẬP BÁO CÁO TUẦN ' + fmt_(monday) + '</h4>';
  if (chuaBaoCao.length === 0) {
    html += '<p style="color:#006100">Tất cả mục tiêu đã nhập báo cáo tuần.</p>';
  } else {
    html += '<p style="color:#c00000">Còn <b>' + chuaBaoCao.length +
      '</b> mục tiêu chưa nhập báo cáo (đã gửi email nhắc nhở):</p><ul>' +
      chuaBaoCao.map(m => '<li>' + esc_(m.maMT) + ' - ' + esc_(m.ten) +
        ' (' + esc_(m.nguoiTH) + ')</li>').join('') + '</ul>';
  }

  html += '<p><a href="' + ss.getUrl() + '#gid=' + sh.getSheetId() + '">Mở Dashboard HT</a></p>';
  html += '<p>Trân trọng.</p>';
  html += '<p style="color:#888;font-size:11px">Email gửi tự động lúc ' +
    fmt_(new Date(), 'HH:mm dd/MM/yyyy') + '.</p></div>';

  const subject = '[Dashboard HT] P.QLKH-ĐBCL - Tuần ' + fmt_(monday);
  sendMail_(CONFIG.EMAIL_HIEU_TRUONG.join(','), CONFIG.CC_DASHBOARD, subject, html);
}

/* ======================= TIỆN ÍCH ======================= */

function getSpreadsheet_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Email: ưu tiên cột "Email" trong [DS_ChuyenVien], sau đó CONFIG.EMAIL_CHUYEN_VIEN. */
function getEmailMap_(ss) {
  const map = {};
  Object.keys(CONFIG.EMAIL_CHUYEN_VIEN).forEach(k => {
    if (CONFIG.EMAIL_CHUYEN_VIEN[k]) map[k.trim()] = CONFIG.EMAIL_CHUYEN_VIEN[k].trim();
  });
  const sh = ss.getSheetByName(CONFIG.SHEET_CHUYEN_VIEN);
  if (sh) {
    const v = sh.getDataRange().getValues();
    const iEmail = v[0].findIndex(h => /email/i.test(String(h)));
    if (iEmail >= 0) {
      for (let r = 1; r < v.length; r++) {
        const ten = String(v[r][0]).trim();
        const email = String(v[r][iEmail]).trim();
        if (ten && email) map[ten] = email;
      }
    }
  }
  return map;
}

function sendMail_(to, cc, subject, html) {
  const ccList = (cc || []).filter(Boolean);
  if (CONFIG.TEST_MODE) {
    const me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
    html = '<p style="background:#fff2cc;padding:6px">[TEST] To: ' + esc_(to) +
      (ccList.length ? ' | CC: ' + esc_(ccList.join(', ')) : '') + '</p>' + html;
    to = me;
    subject = '[TEST] ' + subject;
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
  } else {
    MailApp.sendEmail({ to: to, cc: ccList.join(','), subject: subject, htmlBody: html });
  }
  Logger.log('Đã gửi: %s -> %s', subject, to);
}

/** Thứ Hai của tuần hiện tại (theo giờ Việt Nam), 00:00. */
function getCurrentMonday_() {
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, CONFIG.TIMEZONE, 'u')); // 1=Thứ Hai..7=CN
  const [y, m, d] = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd').split('-').map(Number);
  return new Date(y, m - 1, d - (dow - 1));
}

/** Nhận Date hoặc chuỗi dd/MM/yyyy, trả về Date (00:00) hoặc null. */
function parseDate_(val) {
  if (val instanceof Date && !isNaN(val)) {
    const [y, m, d] = Utilities.formatDate(val, CONFIG.TIMEZONE, 'yyyy-MM-dd').split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const s = String(val || '').trim();
  const mt = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  return mt ? new Date(Number(mt[3]), Number(mt[2]) - 1, Number(mt[1])) : null;
}

function dateKey_(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function addDays_(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function fmt_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern || 'dd/MM/yyyy');
}

function findHeaderRow_(values, firstHeader) {
  return values.findIndex(row => String(row[0]).trim() === firstHeader);
}

function findRowStartsWith_(values, prefix) {
  return values.findIndex(row => String(row[0]).trim().indexOf(prefix) === 0);
}

function lastNonEmpty_(row) {
  for (let i = row.length - 1; i >= 0; i--) if (String(row[i]).trim() !== '') return i;
  return -1;
}

function mauTrangThai_(s) {
  if (/TRỄ|QUÁ HẠN/i.test(s)) return '#f4cccc';
  if (/CẢNH BÁO/i.test(s)) return '#fff2cc';
  if (/CHƯA BÁO CÁO/i.test(s)) return '#fce5cd';
  if (/ĐÚNG|HOÀN THÀNH|ĐẠT/i.test(s)) return '#d9ead3';
  return '#ffffff';
}

function clean_(s) {
  return String(s == null ? '' : s).replace(/\s*\n\s*/g, ' ').trim();
}

function uniq_(arr) {
  return Array.from(new Set(arr));
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function td_(s, align) {
  return '<td' + (align ? ' align="' + align + '"' : '') + '>' + esc_(clean_(s)) + '</td>';
}

function th_(s) {
  return '<th>' + esc_(clean_(s)) + '</th>';
}
