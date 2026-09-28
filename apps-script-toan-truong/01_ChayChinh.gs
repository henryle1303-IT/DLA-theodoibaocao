/**
 * HÀM CHẠY CHÍNH - được gọi từ menu hoặc lịch tự động (trigger).
 * Mỗi hàm chính kết thúc bằng luuNhatKy_() để ghi nhật ký một lần (nhanh hơn ghi từng dòng).
 */

/* =============================== MENU =============================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Theo dõi tiến độ')
    .addItem('Cập nhật Dashboard (không gửi mail)', 'capNhatDashboard')
    .addItem('Chạy thử - mọi email gửi về tôi', 'chayThu')
    .addSeparator()
    .addItem('Chạy kiểm tra thứ Hai (gửi mail thật)', 'kiemTraHangTuan')
    .addItem('Chạy nhắc thứ Sáu (gửi mail thật)', 'nhacTruocHan')
    .addSeparator()
    .addItem('Khởi tạo các sheet', 'khoiTao')
    .addItem('Cài lịch tự động', 'caiDatTrigger')
    .addToUi();
}

/* ============================ THỨ HAI 10H ============================ */

/**
 * Kiểm tra hằng tuần:
 *   1. Nhắc Người thực hiện chưa nhập Báo cáo tuần.
 *   2. Ghi dashboard toàn trường.
 *   3. Gửi email tổng hợp cho Hiệu trưởng.
 *   4. Gửi email tóm tắt cho từng Trưởng đơn vị (nếu bật).
 */
function kiemTraHangTuan() {
  try {
    const tuan = layThuHaiTuanNay_();
    const dsKetQua = docTatCaDonVi_(tuan);
    const dsDocDuoc = dsKetQua.filter(kq => !kq.loi);

    dsDocDuoc.forEach(kq => guiNhacChuaBaoCao_(kq, tuan));
    ghiDashboard_(dsKetQua, tuan);
    guiEmailHieuTruong_(dsKetQua, tuan);
    if (CONFIG.GUI_TOM_TAT_DON_VI) dsDocDuoc.forEach(kq => guiTomTatDonVi_(kq, tuan));
  } finally {
    luuNhatKy_();
  }
}

/** Như kiemTraHangTuan nhưng mọi email gửi về tài khoản đang chạy. */
function chayThu() {
  CONFIG.TEST_MODE = true;
  kiemTraHangTuan();
}

/** Chỉ cập nhật dashboard, không gửi email. */
function capNhatDashboard() {
  try {
    const tuan = layThuHaiTuanNay_();
    ghiDashboard_(docTatCaDonVi_(tuan), tuan);
  } finally {
    luuNhatKy_();
  }
}

/* ============================ THỨ SÁU 15H ============================ */

/**
 * Nhắc trước hạn: mỗi Người thực hiện nhận 1 email gồm
 *   - các mốc chưa xong sẽ đến hạn trong CONFIG.SO_NGAY_NHAC_TRUOC ngày tới;
 *   - lời nhắc hạn nộp Báo cáo tuần vào 10h thứ Hai tới.
 */
function nhacTruocHan() {
  try {
    const tuanToi = themNgay_(layThuHaiTuanNay_(), 7);
    docTatCaDonVi_(tuanToi)
      .filter(kq => !kq.loi)
      .forEach(kq => guiNhacTruocHan_(kq, tuanToi));
  } finally {
    luuNhatKy_();
  }
}

/* ============================ CÀI ĐẶT ============================ */

/** Cài lịch tự động (chạy 1 lần). Xóa lịch cũ của các hàm này trước khi tạo mới. */
function caiDatTrigger() {
  const lich = [
    { ham: 'kiemTraHangTuan', thu: ScriptApp.WeekDay.MONDAY, gio: CONFIG.GIO_KIEM_TRA_THU_HAI },
    { ham: 'nhacTruocHan', thu: ScriptApp.WeekDay.FRIDAY, gio: CONFIG.GIO_NHAC_THU_SAU }
  ];
  const tenHam = lich.map(l => l.ham);

  ScriptApp.getProjectTriggers()
    .filter(t => tenHam.includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  lich.forEach(l => ScriptApp.newTrigger(l.ham).timeBased()
    .onWeekDay(l.thu).atHour(l.gio).inTimezone(CONFIG.TIMEZONE).create());

  Logger.log('Đã cài lịch: %s', lich.map(l => l.ham + ' ' + l.gio + 'h').join(', '));
}

/** Tạo các sheet cần thiết trong file tổng hợp. Không xóa dữ liệu có sẵn. */
function khoiTao() {
  const ss = ssTongHop_();

  const dsDonVi = layHoacTaoSheet_(ss, SHEET.DS_DON_VI);
  if (dsDonVi.getLastRow() === 0) {
    dsDonVi.appendRow(TIEU_DE_DON_VI);
    dinhDangTieuDe_(dsDonVi.getRange(1, 1, 1, TIEU_DE_DON_VI.length));
    // Dòng mẫu: đơn vị đang dùng thử
    dsDonVi.appendRow(['QLKH-ĐBCL', 'Phòng QLKH-ĐBCL',
      'https://docs.google.com/spreadsheets/d/1V0i8iCyzv3XWexdE8rZkgWYliu7-gmpQoUTXz6n1s1I/edit',
      'Nguyễn Văn Toàn', '', '', 'x']);
    dsDonVi.setFrozenRows(1);
    dsDonVi.autoResizeColumns(1, TIEU_DE_DON_VI.length);
  }

  layHoacTaoSheet_(ss, SHEET.DASHBOARD);
  layHoacTaoSheet_(ss, SHEET.CHI_TIET);

  const nhatKy = layHoacTaoSheet_(ss, SHEET.NHAT_KY);
  if (nhatKy.getLastRow() === 0) {
    nhatKy.appendRow(['Thời gian', 'Loại', 'Đơn vị', 'Người nhận', 'Tiêu đề', 'Kết quả']);
    dinhDangTieuDe_(nhatKy.getRange(1, 1, 1, 6));
    nhatKy.setFrozenRows(1);
  }
}
