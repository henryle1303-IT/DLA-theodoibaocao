/**
 * GHI DASHBOARD vào file tổng hợp:
 *   [Dashboard Toàn trường]  mỗi đơn vị 1 dòng, tô màu theo mức độ
 *   [Chi tiết mục tiêu]      mọi mục tiêu phải báo cáo tuần này, có bộ lọc
 * Mỗi lần chạy xóa và ghi lại toàn bộ 2 sheet này.
 */

function ghiDashboard_(dsKetQua, tuan) {
  const dsSapXep = sapXepTheoMucDo_(dsKetQua);
  ghiSheetTongQuan_(dsSapXep, tuan);
  ghiSheetChiTiet_(dsSapXep);
}

/* ======================== DASHBOARD TOÀN TRƯỜNG ======================== */

/**
 * Các cột của sheet tổng quan: tiêu đề + cách lấy giá trị từ KetQuaDonVi.
 * Viết dạng hàm (không phải hằng) vì tiêu đề dùng CONFIG ở file khác.
 */
function cotTongQuan_() {
  return [
    { ten: 'Đơn vị', lay: kq => kq.donVi.ten },
    { ten: 'Trưởng đơn vị', lay: kq => kq.donVi.truong },
    { ten: 'Mức độ', lay: kq => kq.thongKe.mucDo },
    { ten: 'Số MT phải BC', lay: kq => kq.thongKe.soMT },
    { ten: 'MT TRỄ', lay: kq => kq.thongKe.tre },
    { ten: 'MT CẢNH BÁO', lay: kq => kq.thongKe.canhBao },
    { ten: 'Chưa BC tuần này', lay: kq => kq.thongKe.chuaBC },
    { ten: 'Mốc quá hạn', lay: kq => kq.thongKe.mocQuaHan },
    { ten: 'Mốc đến hạn trong ' + CONFIG.SO_NGAY_DEN_HAN + ' ngày', lay: kq => kq.thongKe.mocDenHan },
    { ten: 'Vướng mắc chờ HT', lay: kq => kq.thongKe.vuongMac },
    { ten: '% hoàn thành TB', lay: kq => kq.thongKe.pctHT / 100, dinhDang: '0%' },
    { ten: '% thời gian TB', lay: kq => kq.thongKe.pctTG / 100, dinhDang: '0%' },
    { ten: 'Link / Lỗi', lay: kq => kq.loi || '=HYPERLINK("' + kq.url + '","Mở file")' }
  ];
}

function ghiSheetTongQuan_(dsSapXep, tuan) {
  const sh = layHoacTaoSheet_(ssTongHop_(), SHEET.DASHBOARD);
  const tong = tongHopToanTruong_(dsSapXep);
  const DONG_TIEU_DE = 4;
  sh.clear();

  sh.getRange(1, 1).setValue('DASHBOARD TIẾN ĐỘ TOÀN TRƯỜNG - TUẦN ' + ngayVN_(tuan))
    .setFontSize(14).setFontWeight('bold').setFontColor(MAU.TIEU_DE);
  sh.getRange(2, 1).setValue([
    'Cập nhật ' + ngayVN_(new Date(), 'HH:mm dd/MM/yyyy'),
    dsSapXep.length + ' đơn vị', tong.soMT + ' mục tiêu',
    'TRỄ: ' + tong.tre, 'CẢNH BÁO: ' + tong.canhBao, 'Chưa BC: ' + tong.chuaBC,
    'Mốc quá hạn: ' + tong.mocQuaHan, 'Vướng mắc chờ HT: ' + tong.vuongMac
  ].join(' | '));

  ghiBang_(sh, DONG_TIEU_DE, cotTongQuan_(), dsSapXep, kq => MAU[kq.thongKe.mucDo]);
  sh.setFrozenRows(DONG_TIEU_DE);
  sh.setColumnWidth(1, 220);
}

/* ========================== CHI TIẾT MỤC TIÊU ========================== */

/** Các cột của sheet chi tiết. Mỗi dòng là { kq: KetQuaDonVi, mt: MucTieu }. */
const COT_CHI_TIET = [
  { ten: 'Đơn vị', lay: d => d.kq.donVi.ten },
  { ten: 'Mã MT', lay: d => d.mt.maMT },
  { ten: 'Mục tiêu', lay: d => d.mt.ten, rong: 320 },
  { ten: 'Người thực hiện', lay: d => d.mt.nguoiTH },
  { ten: 'Người kiểm', lay: d => d.mt.nguoiKiem },
  { ten: 'Mốc xong/tổng', lay: d => d.mt.tienDo },
  { ten: '% hoàn thành', lay: d => d.mt.pctHT / 100, dinhDang: '0%' },
  { ten: '% thời gian', lay: d => d.mt.pctTG / 100, dinhDang: '0%' },
  { ten: 'Mốc quá hạn', lay: d => d.mt.mocQuaHan },
  { ten: 'Tuần liên tiếp không BC', lay: d => d.mt.tuanKhongBC },
  { ten: 'Trạng thái', lay: d => d.mt.trangThai },
  { ten: 'Đã BC tuần này', lay: d => d.mt.daBC ? 'Có' : 'CHƯA' },
  { ten: 'Vướng mắc cần HT quyết', lay: d => d.mt.vuongMac }
];

function ghiSheetChiTiet_(dsSapXep) {
  const sh = layHoacTaoSheet_(ssTongHop_(), SHEET.CHI_TIET);
  sh.clear();
  if (sh.getFilter()) sh.getFilter().remove();

  // Trải phẳng: mỗi mục tiêu của mỗi đơn vị thành 1 dòng
  const dong = [];
  dsSapXep.forEach(kq => kq.mucTieu.forEach(mt => dong.push({ kq: kq, mt: mt })));

  ghiBang_(sh, 1, COT_CHI_TIET, dong, d => mauMucTieu_(d.mt));
  sh.setFrozenRows(1);
  sh.getRange(1, 1, Math.max(dong.length + 1, 2), COT_CHI_TIET.length).createFilter();
}

/* ============================== DÙNG CHUNG ============================== */

/**
 * Ghi 1 bảng vào sheet bắt đầu từ dòng `dongTieuDe`:
 *   cot:    [{ ten, lay(dong), dinhDang?, rong? }]
 *   dsDong: dữ liệu nguồn, mỗi phần tử thành 1 dòng
 *   layMau: hàm trả về màu nền cho từng dòng
 * Ghi theo khối (setValues/setBackgrounds một lần) để chạy nhanh.
 */
function ghiBang_(sh, dongTieuDe, cot, dsDong, layMau) {
  dinhDangTieuDe_(sh.getRange(dongTieuDe, 1, 1, cot.length).setValues([cot.map(c => c.ten)]));
  cot.forEach((c, i) => c.rong && sh.setColumnWidth(i + 1, c.rong));
  if (!dsDong.length) return;

  const dongDau = dongTieuDe + 1;
  const vung = sh.getRange(dongDau, 1, dsDong.length, cot.length);
  vung.setValues(dsDong.map(d => cot.map(c => c.lay(d))));
  vung.setBackgrounds(dsDong.map(d => new Array(cot.length).fill(layMau(d))));
  vung.setVerticalAlignment('top').setWrap(true);

  cot.forEach((c, i) => {
    if (c.dinhDang) sh.getRange(dongDau, i + 1, dsDong.length, 1).setNumberFormat(c.dinhDang);
  });
}

/** Màu 1 mục tiêu: TRỄ đỏ, CẢNH BÁO vàng, chưa báo cáo cam, còn lại trắng. */
function mauMucTieu_(mt) {
  if (laTre_(mt)) return MAU[MUC_DO.DO];
  if (laCanhBao_(mt)) return MAU[MUC_DO.VANG];
  if (!mt.daBC) return MAU.CHUA_BAO_CAO;
  return MAU.TRANG;
}

function dinhDangTieuDe_(range) {
  return range.setFontWeight('bold').setBackground(MAU.TIEU_DE).setFontColor('#ffffff').setWrap(true);
}
