/**
 * Kiểm thử bản 1 ĐƠN VỊ (apps-script/Code.gs).
 * Mốc thời gian: thứ Hai 28/09/2026 10:00 giờ Việt Nam.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { taoMoiTruong } = require('./helpers/gas-mock');
const { taoFileDonVi, taoDashboardHT } = require('./helpers/du-lieu-mau');

const THU_MUC = path.join(__dirname, '..', 'apps-script');
const THU_HAI_10H = new Date('2026-09-28T10:00:00+07:00');

function fileMau(ghiDe) {
  return taoFileDonVi('QLKH', Object.assign({
    mucTieu: [
      { ma: 'HK1-1', ten: 'Đo lường CĐR', nguoiTH: 'Nguyễn Tiến Hùng', nguoiKiem: 'Đỗ Quốc Dũng', trangThai: 'CẢNH BÁO', tuanKhongBC: 2 },
      { ma: 'HK1-6', ten: 'NCKH giảng viên', nguoiTH: 'Đỗ Quốc Dũng' },
      { ma: 'HK1-8', ten: 'Giám sát NCKH', nguoiTH: 'Phạm Thị Hồng Nhung', batDau: '01/10/2026' }
    ],
    baoCao: [{ tuan: '28/09/2026', ma: 'HK1-6', daXong: 'xong' }, { tuan: '28/09/2026' }],
    dashboardHT: taoDashboardHT([
      { ma: 'HK1-1', ten: 'Đo lường CĐR', nguoi: 'Nguyễn Tiến Hùng', trangThai: 'CẢNH BÁO' },
      { ma: 'HK1-6', ten: 'NCKH giảng viên', nguoi: 'Đỗ Quốc Dũng', trangThai: 'TRỄ' }
    ], { quaHan: '2' })
  }, ghiDe));
}

function moiTruong(file, cauHinh) {
  const env = taoMoiTruong({ thuMuc: THU_MUC, bayGio: THU_HAI_10H, fileTongHop: file || fileMau() });
  env.chay(`CONFIG.SPREADSHEET_ID = ''; CONFIG.TEST_MODE = false;
    CONFIG.EMAIL_HIEU_TRUONG = ['ht@dla.vn']; CONFIG.EMAIL_TRUONG_DON_VI = 'toan@dla.vn';` + (cauHinh || ''));
  return env;
}

const timMail = (env, tuKhoa) => env.mail.filter(m => m.subject.includes(tuKhoa));

test('Nhắc Người thực hiện chưa báo cáo, CC Người kiểm và Trưởng đơn vị', () => {
  const env = moiTruong();
  env.chay('kiemTraHangTuan()');
  const nhac = timMail(env, '[Nhắc nhở]');
  assert.equal(nhac.length, 1, 'HK1-6 đã báo cáo, HK1-8 chưa đến kỳ');
  assert.equal(nhac[0].to, 'hung@dla.vn');
  assert.equal(nhac[0].cc, 'dung@dla.vn,toan@dla.vn');
  assert.match(nhac[0].htmlBody, /cho 1 mục tiêu Anh\/Chị phụ trách/);
  assert.match(nhac[0].htmlBody, /#gid=1000/, 'link mở thẳng sheet Báo cáo tuần');
});

test('Email Dashboard HT: đủ 3 mục, tô đỏ chỉ số > 0, tô màu theo trạng thái', () => {
  const env = moiTruong();
  env.chay('kiemTraHangTuan()');
  const ht = timMail(env, '[Dashboard HT]');
  assert.equal(ht.length, 1);
  assert.equal(ht[0].to, 'ht@dla.vn');
  const body = ht[0].htmlBody;

  assert.match(body, /DASHBOARD HIỆU TRƯỞNG - PHÒNG QLKH-ĐBCL/);
  assert.match(body, /<h4>1\. CẦN XỬ LÝ NGAY<\/h4>/);
  assert.match(body, /Mốc công việc QUÁ HẠN<\/td><td[^>]*color:#c00000[^>]*>2</, 'QUÁ HẠN = 2 tô đỏ');
  assert.match(body, /Mục tiêu TRỄ<\/td><td[^>]*color:inherit[^>]*>0</, 'TRỄ = 0 không tô đỏ');
  assert.match(body, /<h4>2\. TRẠNG THÁI 9 MỤC TIÊU HỌC KỲ<\/h4>/);
  assert.match(body, /background:#fff2cc"><td>HK1-1/, 'CẢNH BÁO nền vàng');
  assert.match(body, /background:#f4cccc"><td>HK1-6/, 'TRỄ nền đỏ');
  assert.match(body, /3\. TÌNH HÌNH NHẬP BÁO CÁO TUẦN 28\/09\/2026/);
  assert.match(body, /Còn <b>1<\/b> mục tiêu chưa nhập/);
});

test('Tất cả đã báo cáo: không gửi nhắc, Dashboard ghi đã nhập đủ', () => {
  const env = moiTruong(fileMau({ baoCao: [
    { tuan: '28/09/2026', ma: 'HK1-1', keHoach: 'kh' },
    { tuan: '28/09/2026', ma: 'HK1-6', daXong: 'x' }
  ] }));
  env.chay('kiemTraHangTuan()');
  assert.equal(timMail(env, '[Nhắc nhở]').length, 0);
  assert.match(timMail(env, '[Dashboard HT]')[0].htmlBody, /Tất cả mục tiêu đã nhập báo cáo tuần/);
});

test('Sheet DS_ChuyenVien chưa có cột Email: gửi Trưởng đơn vị; không có cả Trưởng đơn vị thì bỏ qua', () => {
  const khongEmail = () => fileMau({ chuyenVien: [] });
  let env = moiTruong(khongEmail());
  env.chay('kiemTraHangTuan()');
  const nhac = timMail(env, '[Nhắc nhở]')[0];
  assert.equal(nhac.to, 'toan@dla.vn');
  assert.match(nhac.htmlBody, /nhờ Trưởng đơn vị chuyển giúp/);

  env = moiTruong(khongEmail(), "CONFIG.EMAIL_TRUONG_DON_VI = '';");
  env.chay('kiemTraHangTuan()');
  assert.equal(timMail(env, '[Nhắc nhở]').length, 0);
  assert.ok(env.logs.some(l => /BỎ QUA/.test(l)));
});

test('chayThu: bật TEST_MODE, mọi email về tài khoản đang chạy', () => {
  const env = moiTruong();
  env.chay('chayThu()');
  assert.equal(env.mail.length, 2);
  env.mail.forEach(m => {
    assert.equal(m.to, 'toi@daihoclongan.edu.vn');
    assert.match(m.subject, /^\[TEST\]/);
  });
  assert.match(env.mail[0].htmlBody, /\[TEST\] To: hung@dla.vn \| CC: dung@dla.vn, toan@dla.vn/);
});

test('caiDatTrigger: 1 lịch thứ Hai 10h, chạy lại không trùng', () => {
  const env = moiTruong();
  env.chay('caiDatTrigger(); caiDatTrigger();');
  assert.deepEqual(env.triggers.map(t => [t.ham, t.thu, t.gio]), [['kiemTraHangTuan', 'MONDAY', 10]]);
});

test('Đọc file theo SPREADSHEET_ID khi chạy độc lập', () => {
  const file = fileMau();
  const env = taoMoiTruong({ thuMuc: THU_MUC, bayGio: THU_HAI_10H, fileTongHop: null, fileDonVi: { QLKH: file } });
  env.chay("CONFIG.SPREADSHEET_ID = 'QLKH'; CONFIG.TEST_MODE = false; kiemTraHangTuan()");
  assert.equal(env.mail.length, 2);
});

test('Ranh giới: MT bắt đầu đúng thứ Hai chưa phải báo cáo; dòng chỉ có mã, bỏ trống nội dung vẫn là chưa báo cáo', () => {
  const env = moiTruong(fileMau({
    mucTieu: [
      { ma: 'HK1-1', nguoiTH: 'Nguyễn Tiến Hùng' },
      { ma: 'HK1-2', nguoiTH: 'Nguyễn Tiến Hùng', batDau: '28/09/2026' }
    ],
    baoCao: [{ tuan: '28/09/2026', ma: 'HK1-1', vuongMac: 'chỉ ghi vướng mắc' }]
  }));
  env.chay('kiemTraHangTuan()');
  const body = timMail(env, '[Nhắc nhở]')[0].htmlBody;
  assert.match(body, /HK1-1/);
  assert.doesNotMatch(body, /HK1-2/);
});
