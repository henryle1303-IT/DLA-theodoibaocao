/**
 * HÀM TIỆN ÍCH dùng chung: file tổng hợp, sheet, ngày tháng, chuỗi, mảng, nhật ký.
 */

/* ============================ FILE & SHEET ============================ */

/** File tổng hợp (file chứa script này). */
function ssTongHop_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function layHoacTaoSheet_(ss, ten) {
  return ss.getSheetByName(ten) || ss.insertSheet(ten);
}

/** Lấy sheet trong file đơn vị; thiếu thì báo lỗi rõ tên sheet. */
function laySheetBatBuoc_(ss, ten) {
  const sh = ss.getSheetByName(ten);
  if (!sh) throw new Error('Thiếu sheet [' + ten + ']');
  return sh;
}

/** Nhận link Google Sheet hoặc ID, trả về ID. */
function layFileId_(linkHoacId) {
  const s = chuoi_(linkHoacId);
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

/**
 * Duyệt các dòng dữ liệu nằm DƯỚI dòng tiêu đề (dòng có ô bằng `tieuDe`).
 * xuLy(row, chiSoDong) được gọi cho từng dòng.
 */
function duyetDuLieu_(values, tieuDe, xuLy) {
  const dongTieuDe = values.findIndex(row => row.some(o => chuoi_(o) === tieuDe));
  if (dongTieuDe < 0) throw new Error('Không tìm thấy dòng tiêu đề có ô "' + tieuDe + '"');
  for (let r = dongTieuDe + 1; r < values.length; r++) xuLy(values[r], r);
}

/* ============================== NGÀY THÁNG ==============================
 * Mọi ngày đều được đưa về 00:00 theo giờ Việt Nam để so sánh trực tiếp bằng < > getTime().
 */

/** Hôm nay 00:00 (giờ Việt Nam). */
function homNay_() {
  return docNgay_(new Date());
}

/** Thứ Hai của tuần hiện tại. */
function layThuHaiTuanNay_() {
  const thu = Number(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'u')); // 1 = thứ Hai ... 7 = CN
  return themNgay_(homNay_(), 1 - thu);
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

/** Định dạng ngày theo giờ Việt Nam, mặc định dd/MM/yyyy. */
function ngayVN_(ngay, mau) {
  return Utilities.formatDate(ngay, CONFIG.TIMEZONE, mau || 'dd/MM/yyyy');
}

/* ============================== CHUỖI & SỐ ============================== */

/** Giá trị ô -> chuỗi đã bỏ khoảng trắng đầu/cuối (null/undefined -> ''). */
function chuoi_(giaTri) {
  return giaTri == null ? '' : String(giaTri).trim();
}

/** Chuẩn hóa phần trăm về số nguyên 0-100: nhận 0.2, 20 hoặc "20%". */
function phanTram_(giaTri) {
  if (typeof giaTri === 'number') return Math.round(giaTri <= 1 ? giaTri * 100 : giaTri);
  const so = parseFloat(chuoi_(giaTri).replace('%', '').replace(',', '.'));
  return isNaN(so) ? 0 : Math.round(so);
}

function trungBinh_(dsSo) {
  return dsSo.length ? Math.round(dsSo.reduce((a, b) => a + b, 0) / dsSo.length) : 0;
}

/** Thoát ký tự đặc biệt khi chèn vào HTML. */
function esc_(giaTri) {
  return chuoi_(giaTri)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ================================ MẢNG ================================ */

function duyNhat_(ds) {
  return Array.from(new Set(ds));
}

/** Gom phần tử theo khóa: gomTheo_([...], x => x.nguoiTH) -> { 'Tên': [...] }. */
function gomTheo_(ds, layKhoa) {
  return ds.reduce((nhom, x) => {
    const khoa = layKhoa(x);
    (nhom[khoa] = nhom[khoa] || []).push(x);
    return nhom;
  }, {});
}

/* ================================ NHẬT KÝ ================================
 * Gom nhật ký trong bộ nhớ, cuối mỗi lượt chạy ghi một lần vào sheet [Nhật ký].
 */

const BO_DEM_NHAT_KY = [];

function ghiNhatKy_(loai, donVi, nguoiNhan, tieuDe, ketQua) {
  Logger.log('[%s] %s | %s | %s | %s', loai, donVi, nguoiNhan, tieuDe, ketQua);
  BO_DEM_NHAT_KY.push([new Date(), loai, donVi, nguoiNhan, tieuDe, ketQua]);
}

function luuNhatKy_() {
  if (!BO_DEM_NHAT_KY.length) return;
  const sh = ssTongHop_().getSheetByName(SHEET.NHAT_KY);
  if (sh) {
    sh.getRange(sh.getLastRow() + 1, 1, BO_DEM_NHAT_KY.length, BO_DEM_NHAT_KY[0].length)
      .setValues(BO_DEM_NHAT_KY);
  }
  BO_DEM_NHAT_KY.length = 0;
}
