/**
 * ĐỌC DỮ LIỆU
 *
 * Kết quả đọc 1 đơn vị ("KetQuaDonVi"):
 * {
 *   donVi:    { ma, ten, fileId, truong, emailTruong, cc[] }   // từ [DS_DonVi]
 *   loi:      chuỗi lỗi nếu không đọc được file, ngược lại không có
 *   url:      link file đơn vị
 *   mucTieu:  [MucTieu]  - CHỈ các mục tiêu phải báo cáo tuần này (xem laMucTieuPhaiBaoCao_)
 *   moc:      [Moc]      - mọi mốc công việc
 *   email:    { 'Họ tên': 'email' }  - từ [DS_ChuyenVien]
 *   thongKe:  { soMT, tre, canhBao, chuaBC, mocQuaHan, mocDenHan, vuongMac, pctHT, pctTG, mucDo }
 * }
 */

/* ============================ DANH SÁCH ĐƠN VỊ ============================ */

/** Đọc [DS_DonVi]: chỉ lấy dòng có link file và cột "Theo dõi" ghi x. */
function docDanhSachDonVi_() {
  const sh = ssTongHop_().getSheetByName(SHEET.DS_DON_VI);
  if (!sh) throw new Error('Chưa có sheet [' + SHEET.DS_DON_VI + ']. Hãy chạy "Khởi tạo các sheet".');

  const c = COT_DON_VI;
  return sh.getDataRange().getValues()
    .slice(1) // bỏ dòng tiêu đề
    .filter(r => chuoi_(r[c.FILE]) && /x/i.test(chuoi_(r[c.THEO_DOI])))
    .map(r => ({
      ma: chuoi_(r[c.MA]),
      ten: chuoi_(r[c.TEN]),
      fileId: layFileId_(r[c.FILE]),
      truong: chuoi_(r[c.TRUONG]),
      emailTruong: chuoi_(r[c.EMAIL_TRUONG]),
      cc: chuoi_(r[c.CC]).split(/[,;\s]+/).filter(Boolean)
    }));
}

/**
 * Đọc mọi đơn vị. Đơn vị lỗi (không mở được file, thiếu sheet...) không làm dừng cả lượt:
 * được ghi nhật ký và trả về với thuộc tính `loi` để hiện trên dashboard.
 */
function docTatCaDonVi_(tuan) {
  return docDanhSachDonVi_().map(donVi => {
    try {
      return docDonVi_(donVi, tuan);
    } catch (e) {
      ghiNhatKy_('LỖI', donVi.ten, '', 'Không đọc được file đơn vị', e.message);
      return { donVi: donVi, loi: e.message, url: '', mucTieu: [], moc: [], email: {},
        thongKe: thongKeRong_(MUC_DO.LOI) };
    }
  });
}

/* ============================ 1 ĐƠN VỊ ============================ */

/** Đọc 1 file đơn vị cho tuần `tuan` (ngày thứ Hai). */
function docDonVi_(donVi, tuan) {
  const ss = SpreadsheetApp.openById(donVi.fileId);
  const layGiaTri = ten => laySheetBatBuoc_(ss, ten).getDataRange();

  const baoCao = docBaoCaoTuan_(layGiaTri(SHEET_DON_VI.BAO_CAO).getValues(), tuan);
  const mucTieu = docMucTieu_(layGiaTri(SHEET_DON_VI.MUC_TIEU), tuan, baoCao);
  const moc = docMocCongViec_(layGiaTri(SHEET_DON_VI.MOC).getValues());

  return {
    donVi: donVi,
    url: ss.getUrl(),
    mucTieu: mucTieu,
    moc: moc,
    email: docEmailChuyenVien_(ss),
    thongKe: tinhThongKe_(mucTieu, moc)
  };
}

/**
 * Sheet [Báo cáo tuần]: tìm các dòng của tuần `tuan`.
 * Trả về { daBaoCao: {maMT: true}, vuongMac: {maMT: 'nội dung'} }.
 * Một mục tiêu được tính là ĐÃ BÁO CÁO khi có dòng đúng tuần, đúng Mã MT và có ghi
 * ít nhất một trong các cột: Đã xong tuần này / Mã mốc đã xong / Kế hoạch tuần tới.
 */
function docBaoCaoTuan_(values, tuan) {
  const c = COT.BAO_CAO;
  const ketQua = { daBaoCao: {}, vuongMac: {} };

  duyetDuLieu_(values, c.TIEU_DE, row => {
    const ngay = docNgay_(row[c.TUAN]);
    const ma = chuoi_(row[c.MA]);
    if (!ma || !ngay || ngay.getTime() !== tuan.getTime()) return;

    if ([row[c.DA_XONG], row[c.MA_MOC], row[c.KE_HOACH]].some(chuoi_)) ketQua.daBaoCao[ma] = true;

    const vuongMac = chuoi_(row[c.VUONG_MAC]);
    if (vuongMac && vuongMac !== '-') ketQua.vuongMac[ma] = vuongMac;
  });
  return ketQua;
}

/** Sheet [Mục tiêu học kỳ]: chỉ trả về mục tiêu phải báo cáo trong tuần `tuan`. */
function docMucTieu_(range, tuan, baoCao) {
  const c = COT.MUC_TIEU;
  const values = range.getValues();
  const hienThi = range.getDisplayValues(); // lấy nguyên chữ hiển thị, ví dụ "3/4"
  const ds = [];

  duyetDuLieu_(values, c.TIEU_DE, (row, r) => {
    const ma = chuoi_(row[c.MA]);
    if (!ma || !chuoi_(row[c.TEN])) return;
    if (!laMucTieuPhaiBaoCao_(docNgay_(row[c.BAT_DAU]), docNgay_(row[c.DEADLINE]), tuan)) return;

    ds.push({
      maMT: ma,
      ten: chuoi_(row[c.TEN]),
      nguoiTH: chuoi_(row[c.NGUOI_TH]),
      nguoiKiem: chuoi_(row[c.NGUOI_KIEM]),
      tienDo: hienThi[r][c.TIEN_DO],
      pctHT: phanTram_(row[c.PCT_HT]),
      pctTG: phanTram_(row[c.PCT_TG]),
      mocQuaHan: Number(row[c.MOC_QUA_HAN]) || 0,
      tuanKhongBC: Number(row[c.TUAN_KHONG_BC]) || 0,
      trangThai: chuoi_(hienThi[r][c.TRANG_THAI]),
      daBC: !!baoCao.daBaoCao[ma],
      vuongMac: baoCao.vuongMac[ma] || ''
    });
  });
  return ds;
}

/**
 * Báo cáo nộp thứ Hai là báo cáo cho TUẦN TRƯỚC, nên mục tiêu phải báo cáo khi:
 *   - đã bắt đầu trước thứ Hai này, và
 *   - deadline chưa quá 7 ngày trước thứ Hai này (vẫn báo cáo tuần cuối sau deadline).
 */
function laMucTieuPhaiBaoCao_(batDau, deadline, tuan) {
  if (batDau && batDau >= tuan) return false;
  if (deadline && deadline < themNgay_(tuan, -7)) return false;
  return true;
}

/** Sheet [Mốc công việc]. */
function docMocCongViec_(values) {
  const c = COT.MOC;
  const ds = [];
  duyetDuLieu_(values, c.TIEU_DE, row => {
    const maMT = chuoi_(row[c.MA_MT]);
    const maCV = chuoi_(row[c.MA_CV]);
    if (!maMT || !maCV) return;
    ds.push({
      maMT: maMT,
      maCV: maCV,
      sanPham: chuoi_(row[c.SAN_PHAM]),
      han: docNgay_(row[c.HAN]),
      xong: chuoi_(row[c.DA_XONG]) !== ''
    });
  });
  return ds;
}

/** Sheet [DS_ChuyenVien]: { 'Họ tên': 'email' }. Cột email tìm theo tiêu đề có chữ "Email". */
function docEmailChuyenVien_(ss) {
  const sh = ss.getSheetByName(SHEET_DON_VI.CHUYEN_VIEN);
  if (!sh) return {};
  const [tieuDe, ...dong] = sh.getDataRange().getValues();
  const cotEmail = tieuDe.findIndex(h => /email/i.test(chuoi_(h)));
  if (cotEmail < 0) return {};

  const email = {};
  dong.forEach(r => {
    const ten = chuoi_(r[COT.CHUYEN_VIEN.TEN]);
    if (ten && chuoi_(r[cotEmail])) email[ten] = chuoi_(r[cotEmail]);
  });
  return email;
}

/* ============================ THỐNG KÊ ============================ */

/** Mốc chưa xong và đã quá hạn. */
function laMocQuaHan_(moc, homNay) {
  return !moc.xong && moc.han && moc.han < homNay;
}

/** Mốc chưa xong, đến hạn trong khoảng [hôm nay, hôm nay + soNgay]. */
function laMocSapDenHan_(moc, homNay, soNgay) {
  return !moc.xong && moc.han && moc.han >= homNay && moc.han <= themNgay_(homNay, soNgay);
}

function laTre_(mt) { return /TRỄ/i.test(mt.trangThai); }
function laCanhBao_(mt) { return /CẢNH BÁO/i.test(mt.trangThai); }

function thongKeRong_(mucDo) {
  return { soMT: 0, tre: 0, canhBao: 0, chuaBC: 0, mocQuaHan: 0, mocDenHan: 0, vuongMac: 0,
    pctHT: 0, pctTG: 0, mucDo: mucDo || MUC_DO.XANH };
}

/**
 * Số liệu của 1 đơn vị và mức độ:
 *   ĐỎ   = có mục tiêu TRỄ hoặc có mốc quá hạn
 *   VÀNG = có mục tiêu CẢNH BÁO hoặc có mục tiêu chưa báo cáo
 *   XANH = còn lại
 */
function tinhThongKe_(mucTieu, moc) {
  const homNay = homNay_();
  const tk = {
    soMT: mucTieu.length,
    tre: mucTieu.filter(laTre_).length,
    canhBao: mucTieu.filter(laCanhBao_).length,
    chuaBC: mucTieu.filter(mt => !mt.daBC).length,
    mocQuaHan: moc.filter(m => laMocQuaHan_(m, homNay)).length,
    mocDenHan: moc.filter(m => laMocSapDenHan_(m, homNay, CONFIG.SO_NGAY_DEN_HAN)).length,
    vuongMac: mucTieu.filter(mt => mt.vuongMac).length,
    pctHT: trungBinh_(mucTieu.map(mt => mt.pctHT)),
    pctTG: trungBinh_(mucTieu.map(mt => mt.pctTG))
  };
  tk.mucDo = (tk.tre || tk.mocQuaHan) ? MUC_DO.DO
    : (tk.canhBao || tk.chuaBC) ? MUC_DO.VANG
      : MUC_DO.XANH;
  return tk;
}

/** Cộng dồn số liệu của nhiều đơn vị (dùng cho dòng tổng toàn trường). */
function tongHopToanTruong_(dsKetQua) {
  const tong = thongKeRong_();
  const cacTruongCong = ['soMT', 'tre', 'canhBao', 'chuaBC', 'mocQuaHan', 'mocDenHan', 'vuongMac'];
  dsKetQua.forEach(kq => cacTruongCong.forEach(f => (tong[f] += kq.thongKe[f])));
  return tong;
}

/** Sắp xếp đơn vị: LỖI -> ĐỎ -> VÀNG -> XANH, cùng mức thì nhiều TRỄ / chưa BC lên trước. */
function sapXepTheoMucDo_(dsKetQua) {
  const hang = kq => THU_TU_MUC_DO.indexOf(kq.thongKe.mucDo);
  return dsKetQua.slice().sort((a, b) =>
    hang(a) - hang(b) ||
    b.thongKe.tre - a.thongKe.tre ||
    b.thongKe.chuaBC - a.thongKe.chuaBC);
}
