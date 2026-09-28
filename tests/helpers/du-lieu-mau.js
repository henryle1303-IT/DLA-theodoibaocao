/**
 * Dữ liệu mẫu có bố cục giống file thật TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027:
 * vài dòng tiêu đề/ghi chú phía trên, rồi dòng tiêu đề cột, rồi dữ liệu.
 */
const { Spreadsheet, Sheet } = require('./gas-mock');

/* ------------------------------ FILE ĐƠN VỊ ------------------------------ */

function dongMucTieu(mt) {
  const x = Object.assign({
    ten: 'Mục tiêu ' + mt.ma, nguoiTH: 'Nguyễn Tiến Hùng', nguoiKiem: 'Nguyễn Văn Toàn',
    batDau: '01/09/2026', deadline: '31/12/2026', tienDo: '0/5', pctHT: 0, pctTG: 0.21,
    mocQuaHan: 0, tuanKhongBC: 0, trangThai: 'ĐÚNG TIẾN ĐỘ'
  }, mt);
  return [x.ma, x.ten, x.nguoiTH, x.nguoiKiem, x.batDau, x.deadline, x.tienDo, x.pctHT, x.pctTG,
    x.mocQuaHan, x.tuanKhongBC, x.trangThai, ''];
}

function dongBaoCao(bc) {
  const x = Object.assign({ daXong: '', maMoc: '', keHoach: '', vuongMac: '', link: '' }, bc);
  return [x.tuan, x.ma || '', '', '', x.daXong, x.maMoc, x.keHoach, x.vuongMac, x.link];
}

function dongMoc(m) {
  const x = Object.assign({ sanPham: 'Sản phẩm ' + m.maCV, xong: '' }, m);
  return [x.maMT, x.maCV, x.sanPham, x.han, x.xong, '', '', '', '', ''];
}

/**
 * Tạo file đơn vị.
 * noiDung: { mucTieu: [..], baoCao: [..], moc: [..], chuyenVien: [[ten, chucVu, email]], boSheet: ['tên'] }
 */
function taoFileDonVi(id, noiDung) {
  const n = noiDung || {};
  const sheets = {
    'Mục tiêu học kỳ': [
      ['DANH MỤC MỤC TIÊU HỌC KỲ I'],
      ['Ô tô vàng: nhập tay đầu học kỳ...'],
      ['Mã MT', 'Mục tiêu học kỳ', 'Người thực hiện', 'Người kiểm', 'Ngày bắt đầu', 'Deadline',
        'Công việc xong / tổng', '% hoàn thành', '% thời gian đã trôi', 'Mốc quá hạn',
        'Số tuần liên tiếp không báo cáo', 'Trạng thái', 'Tuần cập nhật gần nhất (ẩn)']
    ].concat((n.mucTieu || []).map(dongMucTieu)),
    'Báo cáo tuần': [
      ['BÁO CÁO TUẦN - P.QLKH-ĐBCL'],
      ['Mỗi tuần, mỗi mục tiêu ghi MỘT DÒNG MỚI...'],
      ['Tuần (ngày thứ Hai)', 'Mã MT', 'Tên mục tiêu (tự điền)', 'Kết quả tuần trước đạt?',
        'Đã xong tuần này', 'Mã mốc CV đã hoàn thành', 'Kế hoạch công việc tuần tới',
        'Vướng mắc cần Hiệu trưởng quyết', 'Link kết quả/minh chứng'],
      ['', '', '', '', '', '', '', '', '']
    ].concat((n.baoCao || []).map(dongBaoCao)),
    'Mốc công việc': [
      ['DANH SÁCH CÔNG VIỆC - HỌC KỲ I'],
      ['đánh dấu x vào cột [Đã xong]...'],
      ['Mã MT', 'Mã CV', 'Sản phẩm bàn giao (kết quả cụ thể)', 'Hạn', 'Đã xong (x)',
        'Ngày hoàn thành', 'Link kết quả', 'Trạng thái mốc', 'Khóa sắp xếp', '']
    ].concat((n.moc || []).map(dongMoc)),
    'DS_ChuyenVien': [['Họ và tên', 'Chức vụ', 'Email']].concat(n.chuyenVien || [
      ['Nguyễn Văn Toàn', 'Trưởng phòng', 'toan@dla.vn'],
      ['Nguyễn Tiến Hùng', 'Trợ lý', 'hung@dla.vn'],
      ['Đỗ Quốc Dũng', 'Phó trưởng phòng', 'dung@dla.vn']
    ])
  };
  (n.boSheet || []).forEach(ten => delete sheets[ten]);
  if (n.dashboardHT) sheets['Dashboard HT'] = n.dashboardHT;
  return new Spreadsheet(id, sheets);
}

/* ------------------------------ FILE TỔNG HỢP ------------------------------ */

/** dsDonVi: [{ ma, ten, file, truong, email, cc, theoDoi }] */
function taoFileTongHop(dsDonVi) {
  return new Spreadsheet('TONGHOP', {
    'DS_DonVi': [['Mã ĐV', 'Tên đơn vị', 'Link file', 'Trưởng đơn vị', 'Email Trưởng đơn vị', 'Email CC', 'Theo dõi (x)']]
      .concat(dsDonVi.map(d => [d.ma, d.ten, d.file, d.truong || '', d.email || '', d.cc || '',
        d.theoDoi === undefined ? 'x' : d.theoDoi])),
    'Nhật ký': [['Thời gian', 'Loại', 'Đơn vị', 'Người nhận', 'Tiêu đề', 'Kết quả']]
  });
}

/* ------------------------------ DASHBOARD HT (bản 1 đơn vị) ------------------------------ */

function taoDashboardHT(dsMucTieu, chiSo) {
  const c = Object.assign({ tre: '0', quaHan: '0', canhBao: '6', denHan: '8', chuaBC: '8', vuongMac: '0' }, chiSo);
  const trong = () => new Array(11).fill('');
  const dong = cac => cac.concat(new Array(11 - cac.length).fill(''));
  return new Sheet('Dashboard HT', [
    dong(['DASHBOARD HIỆU TRƯỞNG - PHÒNG QLKH-ĐBCL - HỌC KỲ I NĂM HỌC 2026-2027']),
    dong(['Tự động cập nhật từ [Mốc sản phẩm] và [Báo cáo tuần].']),
    trong(),
    dong(['1. CẦN XỬ LÝ NGAY']),
    dong(['Mục tiêu TRỄ', c.tre, 'TRỄ = có mốc sản phẩm quá hạn', '', 'Mốc công việc \nQUÁ HẠN', c.quaHan]),
    dong(['Mục tiêu CẢNH BÁO', c.canhBao, 'Chậm 20-35 điểm %', '', 'Mốc công việc \nđến hạn trong 14 ngày', c.denHan, 'Việc phải đóng trong 2 tuần tới']),
    dong(['CHƯA BÁO CÁO tuần này', c.chuaBC, 'Tính từ 10h thứ Hai hằng tuần', '', 'Vướng mắc chờ \nHT quyết', c.vuongMac]),
    dong(['', '', '', '', 'Tuần đang theo dõi (thứ Hai):', '9/21/2026']),
    trong(),
    dong(['2. TRẠNG THÁI 9 MỤC TIÊU HỌC KỲ']),
    ['Mã', 'Mục tiêu', 'Người thực hiện', 'Mốc xong / tổng', '% hoàn thành', '% thời gian', 'Mốc quá hạn',
      'Tuần liên tiếp không BC', 'Cam kết không đạt', 'Trạng thái', 'Vướng mắc cần Hiệu trưởng quyết']
  ].concat(dsMucTieu.map(m => [m.ma, m.ten, m.nguoi, '0/5', '0%', '21%', '0', '2', '0', m.trangThai, '-'])));
}

module.exports = { taoFileDonVi, taoFileTongHop, taoDashboardHT };
