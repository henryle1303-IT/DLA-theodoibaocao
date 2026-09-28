/**
 * ============================================================================
 *  KIỂM TRA HÀNG TUẦN - 1 ĐƠN VỊ (mặc định: P.QLKH-ĐBCL)
 *  File: TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027
 * ============================================================================
 *
 *  Việc 1: Tìm mục tiêu chưa nhập [Báo cáo tuần] -> email nhắc Người thực hiện
 *          (CC Người kiểm + Trưởng đơn vị).
 *  Việc 2: Đọc sheet [Dashboard HT] -> email cho Hiệu trưởng, kèm danh sách chưa báo cáo.
 *
 *  Dùng cho 1 đơn vị. Nếu theo dõi nhiều đơn vị, dùng bản apps-script-toan-truong.
 *
 *  CÀI ĐẶT
 *    1. Sheet [DS_ChuyenVien] thêm cột C "Email" (A: Họ và tên, B: Chức vụ, C: Email).
 *    2. Mở Google Sheet > Tiện ích mở rộng > Apps Script, dán file này, sửa CONFIG.
 *    3. Chạy chayThu(): mọi email gửi về chính bạn để kiểm tra.
 *    4. Đặt TEST_MODE = false, chạy caiDatTrigger() một lần.
 *
 *  Hàm kết thúc bằng "_" là hàm nội bộ.
 */

/* ================================ CẤU HÌNH ================================ */

const CONFIG = {
  // Để trống nếu script gắn trực tiếp vào file Sheet
  SPREADSHEET_ID: '1V0i8iCyzv3XWexdE8rZkgWYliu7-gmpQoUTXz6n1s1I',
  TEN_DON_VI: 'P.QLKH-ĐBCL',
  TIMEZONE: 'Asia/Ho_Chi_Minh',

  EMAIL_HIEU_TRUONG: ['hieutruong@daihoclongan.edu.vn'],
  CC_HIEU_TRUONG: [],

  // CC trong email nhắc nhở; nhận thay khi Người thực hiện chưa khai email
  EMAIL_TRUONG_DON_VI: '',

  GIO_CHAY_THU_HAI: 10, // sau hạn nộp báo cáo 10h thứ Hai

  // true: mọi email gửi về tài khoản đang chạy script, đầu email ghi người nhận thật
  TEST_MODE: true
};

const SHEET = {
  DASHBOARD: 'Dashboard HT',
  BAO_CAO: 'Báo cáo tuần',
  MUC_TIEU: 'Mục tiêu học kỳ',
  CHUYEN_VIEN: 'DS_ChuyenVien'
};

/** Vị trí cột (bắt đầu từ 0). Nếu file mẫu đổi cột, chỉ sửa ở đây. */
const COT = {
  MUC_TIEU: { TIEU_DE: 'Mã MT', MA: 0, TEN: 1, NGUOI_TH: 2, NGUOI_KIEM: 3, BAT_DAU: 4, DEADLINE: 5,
    TUAN_KHONG_BC: 10, TRANG_THAI: 11 },
  BAO_CAO: { TIEU_DE: 'Mã MT', TUAN: 0, MA: 1, DA_XONG: 4, MA_MOC: 5, KE_HOACH: 6 },
  // Sheet Dashboard HT: mục 1 là các cặp (nhãn, giá trị, ghi chú) ở cột A-C và E-G
  DASHBOARD: { TIEU_DE_BANG: 'Mã', TRANG_THAI: 9, CAP_CHI_SO: [[0, 1, 2], [4, 5, 6]] }
};

const MAU = {
  TIEU_DE: '#1f4e79', CHU_DO: '#c00000', CHU_XANH: '#006100',
  TRE: '#f4cccc', CANH_BAO: '#fff2cc', CHUA_BAO_CAO: '#fce5cd', DAT: '#d9ead3', TRANG: '#ffffff'
};

/* ================================ HÀM CHẠY ================================ */

/** Hàm lịch tự động gọi mỗi thứ Hai. */
function kiemTraHangTuan() {
  const ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const tuan = layThuHaiTuanNay_();
  const dsChuaBaoCao = timMucTieuChuaBaoCao_(ss, tuan);

  guiEmailNhacNho_(ss, dsChuaBaoCao, tuan);
  guiEmailDashboard_(ss, dsChuaBaoCao, tuan);
}

/** Chạy thử: mọi email gửi về tài khoản đang chạy. */
function chayThu() {
  CONFIG.TEST_MODE = true;
  kiemTraHangTuan();
}

/** Cài lịch chạy mỗi thứ Hai (chạy 1 lần). */
function caiDatTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kiemTraHangTuan')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('kiemTraHangTuan').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(CONFIG.GIO_CHAY_THU_HAI)
    .inTimezone(CONFIG.TIMEZONE).create();
  Logger.log('Đã cài lịch: thứ Hai hằng tuần lúc %sh.', CONFIG.GIO_CHAY_THU_HAI);
}

/* ======================== VIỆC 1: NHẮC CHƯA BÁO CÁO ======================== */

/** Danh sách mục tiêu phải báo cáo tuần `tuan` nhưng chưa có dòng báo cáo. */
function timMucTieuChuaBaoCao_(ss, tuan) {
  const daBaoCao = docMaDaBaoCao_(ss.getSheetByName(SHEET.BAO_CAO).getDataRange().getValues(), tuan);
  const c = COT.MUC_TIEU;
  const ds = [];

  duyetDuLieu_(ss.getSheetByName(SHEET.MUC_TIEU).getDataRange().getValues(), c.TIEU_DE, row => {
    const ma = chuoi_(row[c.MA]);
    if (!ma || !chuoi_(row[c.TEN]) || daBaoCao.has(ma)) return;
    if (!laMucTieuPhaiBaoCao_(docNgay_(row[c.BAT_DAU]), docNgay_(row[c.DEADLINE]), tuan)) return;
    ds.push({
      maMT: ma,
      ten: chuoi_(row[c.TEN]),
      nguoiTH: chuoi_(row[c.NGUOI_TH]),
      nguoiKiem: chuoi_(row[c.NGUOI_KIEM]),
      trangThai: chuoi_(row[c.TRANG_THAI]),
      tuanKhongBC: row[c.TUAN_KHONG_BC]
    });
  });
  return ds;
}

/**
 * Mã các mục tiêu ĐÃ BÁO CÁO tuần `tuan`: có dòng đúng tuần, có Mã MT và có ghi ít nhất
 * một trong các cột Đã xong tuần này / Mã mốc đã xong / Kế hoạch tuần tới.
 */
function docMaDaBaoCao_(values, tuan) {
  const c = COT.BAO_CAO;
  const daBaoCao = new Set();
  duyetDuLieu_(values, c.TIEU_DE, row => {
    const ngay = docNgay_(row[c.TUAN]);
    const ma = chuoi_(row[c.MA]);
    const coNoiDung = [row[c.DA_XONG], row[c.MA_MOC], row[c.KE_HOACH]].some(chuoi_);
    if (ma && coNoiDung && ngay && ngay.getTime() === tuan.getTime()) daBaoCao.add(ma);
  });
  return daBaoCao;
}

/**
 * Báo cáo nộp thứ Hai là cho TUẦN TRƯỚC, nên mục tiêu phải báo cáo khi đã bắt đầu trước
 * thứ Hai này và deadline chưa quá 7 ngày trước thứ Hai này.
 */
function laMucTieuPhaiBaoCao_(batDau, deadline, tuan) {
  if (batDau && batDau >= tuan) return false;
  if (deadline && deadline < themNgay_(tuan, -7)) return false;
  return true;
}

/** Mỗi Người thực hiện nhận 1 email liệt kê các mục tiêu chưa báo cáo. */
function guiEmailNhacNho_(ss, dsChuaBaoCao, tuan) {
  if (!dsChuaBaoCao.length) {
    Logger.log('Tất cả mục tiêu đã báo cáo tuần %s.', ngayVN_(tuan));
    return;
  }
  const email = docEmailChuyenVien_(ss);
  const url = ss.getUrl() + '#gid=' + ss.getSheetByName(SHEET.BAO_CAO).getSheetId();
  const theoNguoi = gomTheo_(dsChuaBaoCao, mt => mt.nguoiTH);

  Object.keys(theoNguoi).forEach(nguoi => {
    const dsMT = theoNguoi[nguoi];
    const html =
      doan_('Kính gửi Anh/Chị <b>' + esc_(nguoi) + '</b>' +
        (email[nguoi] ? '' : ' (chưa có email - nhờ Trưởng đơn vị chuyển giúp)') + ',') +
      doan_('Đến ' + ngayVN_(new Date(), 'HH:mm dd/MM/yyyy') + ', sheet <b>[Báo cáo tuần]</b> chưa có ' +
        'báo cáo tuần <b>' + ngayVN_(tuan) + '</b> cho ' + dsMT.length + ' mục tiêu Anh/Chị phụ trách:') +
      bangHtml_(['Mã MT', 'Mục tiêu', 'Trạng thái', 'Tuần liên tiếp không BC'],
        dsMT.map(mt => [mt.maMT, mt.ten, mt.trangThai, mt.tuanKhongBC])) +
      doan_('Đề nghị cập nhật ngay: mỗi mục tiêu ghi <b>một dòng mới</b> ở cuối bảng (Tuần = ' +
        ngayVN_(tuan) + ', Mã MT, Kết quả đã xong, Kế hoạch tuần tới, Vướng mắc, Link minh chứng).') +
      doan_('<a href="' + url + '">Mở sheet Báo cáo tuần</a>') + chanTrang_();

    guiMail_(email[nguoi] || CONFIG.EMAIL_TRUONG_DON_VI,
      dsMT.map(mt => email[mt.nguoiKiem]).concat(CONFIG.EMAIL_TRUONG_DON_VI),
      '[Nhắc nhở] Chưa nhập Báo cáo tuần ' + ngayVN_(tuan) + ' - ' + CONFIG.TEN_DON_VI, html);
  });
}

/* ========================= VIỆC 2: EMAIL DASHBOARD HT ========================= */

/**
 * Dựng email từ sheet [Dashboard HT] (đọc chữ hiển thị để giữ nguyên định dạng %):
 *   Mục 1  các chỉ số "Cần xử lý ngay"
 *   Mục 2  bảng trạng thái mục tiêu + các phần phía dưới (nếu có)
 *   Mục 3  danh sách mục tiêu chưa báo cáo tuần này
 */
function guiEmailDashboard_(ss, dsChuaBaoCao, tuan) {
  const sh = ss.getSheetByName(SHEET.DASHBOARD);
  const v = sh.getDataRange().getDisplayValues();
  const tieuDe = chuoi_(v[0][0]) || chuoi_(v[1][0]) || 'DASHBOARD HIỆU TRƯỞNG';

  const html = '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    doan_('Kính gửi Thầy Hiệu trưởng,') +
    doan_(esc_(CONFIG.TEN_DON_VI) + ' xin gửi tình hình thực hiện mục tiêu học kỳ, tuần <b>' +
      ngayVN_(tuan) + '</b> (trích từ sheet Dashboard HT):') +
    '<h3 style="color:' + MAU.TIEU_DE + '">' + esc_(tieuDe) + '</h3>' +
    htmlMucCanXuLy_(v) +
    htmlBangMucTieu_(v) +
    htmlTinhHinhBaoCao_(dsChuaBaoCao, tuan) +
    doan_('<a href="' + ss.getUrl() + '#gid=' + sh.getSheetId() + '">Mở Dashboard HT</a>') +
    chanTrang_() + '</div>';

  guiMail_(CONFIG.EMAIL_HIEU_TRUONG.join(','), CONFIG.CC_HIEU_TRUONG,
    '[Dashboard HT] ' + CONFIG.TEN_DON_VI + ' - Tuần ' + ngayVN_(tuan), html);
}

/** Mục 1: các dòng giữa tiêu đề "1." và "2.", mỗi dòng có tối đa 2 cặp chỉ số. */
function htmlMucCanXuLy_(v) {
  const batDau = timDongBatDauBang_(v, '1.');
  if (batDau < 0) return '';
  const ketThuc = timDongBatDauBang_(v, '2.');

  const dong = [];
  for (let r = batDau + 1; r < (ketThuc > 0 ? ketThuc : v.length); r++) {
    COT.DASHBOARD.CAP_CHI_SO.forEach(([cotNhan, cotGiaTri, cotGhiChu]) => {
      const nhan = motDong_(v[r][cotNhan]);
      if (nhan) dong.push([nhan, v[r][cotGiaTri], motDong_(v[r][cotGhiChu])]);
    });
  }

  // Chỉ số cảnh báo (TRỄ, QUÁ HẠN...) có giá trị > 0 thì tô chữ đỏ
  const laCanhBao = (nhan, giaTri) => Number(giaTri) > 0 &&
    /TRỄ|QUÁ HẠN|CẢNH BÁO|CHƯA BÁO CÁO|Vướng mắc|không đạt|chưa khai/i.test(nhan);

  return '<h4>' + esc_(v[batDau][0]) + '</h4>' +
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">' +
    dong.map(([nhan, giaTri, ghiChu]) => '<tr><td>' + esc_(nhan) + '</td>' +
      '<td align="center" style="font-weight:bold;color:' + (laCanhBao(nhan, giaTri) ? MAU.CHU_DO : 'inherit') + '">' +
      esc_(giaTri) + '</td><td>' + esc_(ghiChu) + '</td></tr>').join('') +
    '</table>';
}

/** Mục 2: bảng từ dòng tiêu đề "Mã" đến dòng trống đầu tiên, sau đó là các phần còn lại. */
function htmlBangMucTieu_(v) {
  const dongTieuDe = v.findIndex(row => row.some(o => chuoi_(o) === COT.DASHBOARD.TIEU_DE_BANG));
  if (dongTieuDe < 0) return '';
  const muc2 = timDongBatDauBang_(v, '2.');
  const soCot = viTriCuoiCoDuLieu_(v[dongTieuDe]) + 1;

  let r = dongTieuDe + 1;
  const dsDong = [];
  for (; r < v.length && chuoi_(v[r][0]); r++) dsDong.push(v[r].slice(0, soCot));

  const phanConLai = v.slice(r).filter(row => row.some(chuoi_))
    .map(row => row.slice(0, viTriCuoiCoDuLieu_(row) + 1));

  return '<h4>' + esc_(muc2 >= 0 ? v[muc2][0] : 'TRẠNG THÁI MỤC TIÊU') + '</h4>' +
    bangHtml_(v[dongTieuDe].slice(0, soCot), dsDong,
      dsDong.map(row => mauTrangThai_(row[COT.DASHBOARD.TRANG_THAI]))) +
    (phanConLai.length ? '<br>' + bangHtml_([], phanConLai) : '');
}

/** Mục 3: tình hình nhập báo cáo tuần. */
function htmlTinhHinhBaoCao_(dsChuaBaoCao, tuan) {
  const tieuDe = '<h4>3. TÌNH HÌNH NHẬP BÁO CÁO TUẦN ' + ngayVN_(tuan) + '</h4>';
  if (!dsChuaBaoCao.length) {
    return tieuDe + '<p style="color:' + MAU.CHU_XANH + '">Tất cả mục tiêu đã nhập báo cáo tuần.</p>';
  }
  return tieuDe +
    '<p style="color:' + MAU.CHU_DO + '">Còn <b>' + dsChuaBaoCao.length +
    '</b> mục tiêu chưa nhập báo cáo (đã gửi email nhắc nhở):</p>' +
    '<ul>' + dsChuaBaoCao.map(mt => '<li>' + esc_(mt.maMT + ' - ' + mt.ten + ' (' + mt.nguoiTH + ')') +
      '</li>').join('') + '</ul>';
}

/* ================================ GỬI MAIL ================================ */

/** Gửi email. TEST_MODE: gửi về tài khoản đang chạy, đầu thư ghi người nhận thật. */
function guiMail_(den, dsCC, tieuDe, html) {
  if (!den) {
    Logger.log('BỎ QUA (không có email người nhận): %s', tieuDe);
    return;
  }
  const cc = Array.from(new Set(dsCC.filter(e => e && e !== den)));

  if (CONFIG.TEST_MODE) {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: '[TEST] ' + tieuDe,
      htmlBody: '<p style="background:#fff2cc;padding:6px">[TEST] To: ' + esc_(den) +
        (cc.length ? ' | CC: ' + esc_(cc.join(', ')) : '') + '</p>' + html
    });
  } else {
    MailApp.sendEmail({ to: den, cc: cc.join(','), subject: tieuDe, htmlBody: html });
  }
  Logger.log('Đã gửi: %s -> %s', tieuDe, den);
}

/** [DS_ChuyenVien]: { 'Họ tên': 'email' }, cột email tìm theo tiêu đề có chữ "Email". */
function docEmailChuyenVien_(ss) {
  const sh = ss.getSheetByName(SHEET.CHUYEN_VIEN);
  if (!sh) return {};
  const [tieuDe, ...dong] = sh.getDataRange().getValues();
  const cotEmail = tieuDe.findIndex(h => /email/i.test(chuoi_(h)));
  if (cotEmail < 0) return {};

  const email = {};
  dong.forEach(r => {
    if (chuoi_(r[0]) && chuoi_(r[cotEmail])) email[chuoi_(r[0])] = chuoi_(r[cotEmail]);
  });
  return email;
}

/* ================================ TIỆN ÍCH ================================ */

/** Duyệt các dòng nằm dưới dòng tiêu đề (dòng có ô bằng `tieuDe`). */
function duyetDuLieu_(values, tieuDe, xuLy) {
  const dongTieuDe = values.findIndex(row => row.some(o => chuoi_(o) === tieuDe));
  if (dongTieuDe < 0) throw new Error('Không tìm thấy dòng tiêu đề có ô "' + tieuDe + '"');
  for (let r = dongTieuDe + 1; r < values.length; r++) xuLy(values[r], r);
}

/** Dòng đầu tiên có ô A bắt đầu bằng `tienTo` (ví dụ "1.", "2."). */
function timDongBatDauBang_(values, tienTo) {
  return values.findIndex(row => chuoi_(row[0]).startsWith(tienTo));
}

function viTriCuoiCoDuLieu_(row) {
  for (let i = row.length - 1; i >= 0; i--) if (chuoi_(row[i])) return i;
  return -1;
}

function gomTheo_(ds, layKhoa) {
  return ds.reduce((nhom, x) => {
    (nhom[layKhoa(x)] = nhom[layKhoa(x)] || []).push(x);
    return nhom;
  }, {});
}

/* --- Ngày tháng: mọi ngày đưa về 00:00 giờ Việt Nam để so sánh trực tiếp --- */

function layThuHaiTuanNay_() {
  const thu = Number(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'u')); // 1 = thứ Hai ... 7 = CN
  return themNgay_(docNgay_(new Date()), 1 - thu);
}

/** Nhận ô ngày (Date) hoặc chuỗi "dd/MM/yyyy", trả về Date 00:00 hoặc null. */
function docNgay_(giaTri) {
  if (giaTri instanceof Date && !isNaN(giaTri)) {
    const [y, m, d] = Utilities.formatDate(giaTri, CONFIG.TIMEZONE, 'yyyy-MM-dd').split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const khop = chuoi_(giaTri).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  return khop ? new Date(Number(khop[3]), Number(khop[2]) - 1, Number(khop[1])) : null;
}

function themNgay_(ngay, soNgay) {
  return new Date(ngay.getFullYear(), ngay.getMonth(), ngay.getDate() + soNgay);
}

function ngayVN_(ngay, mau) {
  return Utilities.formatDate(ngay, CONFIG.TIMEZONE, mau || 'dd/MM/yyyy');
}

/* --- Chuỗi & HTML --- */

function chuoi_(giaTri) {
  return giaTri == null ? '' : String(giaTri).trim();
}

/** Gộp chữ nhiều dòng trong ô thành 1 dòng. */
function motDong_(giaTri) {
  return chuoi_(giaTri).replace(/\s*\n\s*/g, ' ');
}

function esc_(giaTri) {
  return chuoi_(giaTri)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function doan_(html) {
  return '<p>' + html + '</p>';
}

function chanTrang_() {
  return '<p>Trân trọng.</p><p style="color:#888;font-size:11px">Email gửi tự động lúc ' +
    ngayVN_(new Date(), 'HH:mm dd/MM/yyyy') + ' từ hệ thống theo dõi tiến độ ' +
    esc_(CONFIG.TEN_DON_VI) + '.</p>';
}

function mauTrangThai_(trangThai) {
  if (/TRỄ|QUÁ HẠN/i.test(trangThai)) return MAU.TRE;
  if (/CẢNH BÁO/i.test(trangThai)) return MAU.CANH_BAO;
  if (/CHƯA BÁO CÁO/i.test(trangThai)) return MAU.CHUA_BAO_CAO;
  if (/ĐÚNG|HOÀN THÀNH|ĐẠT/i.test(trangThai)) return MAU.DAT;
  return MAU.TRANG;
}

/** Bảng HTML. tieuDe rỗng thì không có dòng tiêu đề; mauDong: màu nền từng dòng (tùy chọn). */
function bangHtml_(tieuDe, dsDong, mauDong) {
  const o = (the, giaTri) => '<' + the + '>' + esc_(motDong_(giaTri)) + '</' + the + '>';
  return '<table cellpadding="5" cellspacing="0" border="1" style="border-collapse:collapse;font-size:12px">' +
    (tieuDe.length
      ? '<tr style="background:' + MAU.TIEU_DE + ';color:#fff">' + tieuDe.map(h => o('th', h)).join('') + '</tr>'
      : '') +
    dsDong.map((dong, i) => '<tr' + (mauDong ? ' style="background:' + mauDong[i] + '"' : '') + '>' +
      dong.map(giaTri => o('td', giaTri)).join('') + '</tr>').join('') +
    '</table>';
}
