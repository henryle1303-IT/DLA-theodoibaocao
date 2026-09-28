/**
 * Kiểm thử bản TOÀN TRƯỜNG (apps-script-toan-truong).
 * Chạy: npm test   (hoặc: node --test tests/)
 *
 * Mốc thời gian mặc định: thứ Hai 28/09/2026 10:00 giờ Việt Nam
 *   -> tuần báo cáo = 28/09/2026, hạn "1 tuần sau deadline" = 21/09/2026.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { taoMoiTruong } = require('./helpers/gas-mock');
const { taoFileDonVi, taoFileTongHop } = require('./helpers/du-lieu-mau');

const THU_MUC = path.join(__dirname, '..', 'apps-script-toan-truong');
const THU_HAI_10H = new Date('2026-09-28T10:00:00+07:00');
const THU_SAU_15H = new Date('2026-10-02T15:00:00+07:00');

/** Đơn vị mẫu: 1 mục tiêu đã báo cáo (có vướng mắc), 1 chưa báo cáo, 1 chưa đến kỳ, 1 TRỄ. */
function donViMau(id, ghiDe) {
  return taoFileDonVi(id, Object.assign({
    mucTieu: [
      { ma: 'HK1-1', ten: 'Đo lường CĐR', nguoiTH: 'Nguyễn Tiến Hùng', trangThai: 'CẢNH BÁO', tuanKhongBC: 2 },
      { ma: 'HK1-6', ten: 'NCKH giảng viên', nguoiTH: 'Đỗ Quốc Dũng', pctHT: 0.75 },
      { ma: 'HK1-8', ten: 'Giám sát NCKH', nguoiTH: 'Phạm Thị Hồng Nhung', batDau: '01/10/2026', trangThai: 'CHƯA ĐẾN KỲ' }
    ],
    baoCao: [
      { tuan: '28/09/2026', ma: 'HK1-6', daXong: 'Đã duyệt danh mục', vuongMac: 'Cần HT duyệt kinh phí' },
      { tuan: '28/09/2026' },                               // dòng kẻ sẵn, chưa nhập
      { tuan: '21/09/2026', ma: 'HK1-1', daXong: 'Tuần trước' }  // tuần trước, không tính
    ],
    moc: [
      { maMT: 'HK1-1', maCV: 'HK1-1.1', han: '30/09/2026' },
      { maMT: 'HK1-1', maCV: 'HK1-1.2', han: '10/10/2026' },
      { maMT: 'HK1-6', maCV: 'HK1-6.1', han: new Date(2026, 8, 10), xong: 'x' }
    ]
  }, ghiDe));
}

/** Tạo môi trường với danh sách đơn vị; mặc định 1 đơn vị QLKH. */
function moiTruong(tuyChon) {
  const t = tuyChon || {};
  const fileDonVi = t.fileDonVi || { QLKH: donViMau('QLKH') };
  const dsDonVi = t.dsDonVi || [
    { ma: 'QLKH', ten: 'Phòng QLKH-ĐBCL', file: 'https://docs.google.com/spreadsheets/d/QLKH/edit',
      truong: 'Nguyễn Văn Toàn', email: 'toan@dla.vn' }
  ];
  const env = taoMoiTruong({
    thuMuc: THU_MUC, bayGio: t.bayGio || THU_HAI_10H,
    fileTongHop: taoFileTongHop(dsDonVi), fileDonVi: fileDonVi
  });
  env.chay('CONFIG.TEST_MODE = ' + (t.testMode ? 'true' : 'false'));
  env.chay('CONFIG.EMAIL_HIEU_TRUONG = ["ht@dla.vn"]');
  return env;
}

const timMail = (env, tuKhoa) => env.mail.filter(m => m.subject.includes(tuKhoa));
const nhatKy = env => env.fileTongHop.sheet('Nhật ký').ghi;

/* =============================== TIỆN ÍCH =============================== */

test('docNgay_: nhận chuỗi dd/MM/yyyy, ô Date; trả null khi không hợp lệ', () => {
  const env = moiTruong();
  const doc = s => { const d = env.chay(`docNgay_(${JSON.stringify(s)})`); return d && d.toDateString(); };
  assert.equal(doc('28/09/2026'), new Date(2026, 8, 28).toDateString());
  assert.equal(doc('8/9/2026'), new Date(2026, 8, 8).toDateString());
  assert.equal(doc('28-09-2026'), new Date(2026, 8, 28).toDateString());
  assert.equal(doc(''), null);
  assert.equal(doc('abc'), null);
  assert.equal(doc('2026-09-28'), null);
  env.ctx.o = new Date(2026, 8, 28, 15, 30);
  assert.equal(env.chay('docNgay_(o).getHours()'), 0, 'giờ bị cắt về 00:00');
});

test('layThuHaiTuanNay_: đúng thứ Hai theo giờ Việt Nam, kể cả Chủ nhật và 0h thứ Hai', () => {
  const thuHai = bayGio => moiTruong({ bayGio }).chay('ngayVN_(layThuHaiTuanNay_())');
  assert.equal(thuHai(THU_HAI_10H), '28/09/2026');
  assert.equal(thuHai(new Date('2026-10-04T23:59:00+07:00')), '28/09/2026'); // Chủ nhật
  assert.equal(thuHai(new Date('2026-09-28T00:30:00+07:00')), '28/09/2026'); // UTC vẫn là Chủ nhật
  assert.equal(thuHai(new Date('2026-09-27T23:30:00+07:00')), '21/09/2026');
});

test('phanTram_: 0.2 / 20 / "20%" / rỗng', () => {
  const env = moiTruong();
  assert.equal(env.chay('phanTram_(0.2)'), 20);
  assert.equal(env.chay('phanTram_(1)'), 100);
  assert.equal(env.chay('phanTram_(75)'), 75);
  assert.equal(env.chay('phanTram_("21%")'), 21);
  assert.equal(env.chay('phanTram_("12,5%")'), 13);
  assert.equal(env.chay('phanTram_("")'), 0);
});

test('layFileId_: nhận link hoặc ID', () => {
  const env = moiTruong();
  assert.equal(env.chay('layFileId_("https://docs.google.com/spreadsheets/d/1AbC-_x/edit#gid=0")'), '1AbC-_x');
  assert.equal(env.chay('layFileId_(" 1AbC ")'), '1AbC');
});

test('esc_: thoát ký tự HTML', () => {
  assert.equal(moiTruong().chay('esc_(\'<b>"A&B"</b>\')'), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
});

/* ============================== QUY TẮC NGHIỆP VỤ ============================== */

test('laMucTieuPhaiBaoCao_: bắt đầu trước thứ Hai và deadline chưa quá 7 ngày', () => {
  const env = moiTruong();
  const xet = (batDau, deadline) =>
    env.chay(`laMucTieuPhaiBaoCao_(docNgay_("${batDau}"), docNgay_("${deadline}"), docNgay_("28/09/2026"))`);
  assert.equal(xet('01/09/2026', '31/12/2026'), true);
  assert.equal(xet('27/09/2026', '31/12/2026'), true, 'bắt đầu Chủ nhật tuần trước');
  assert.equal(xet('28/09/2026', '31/12/2026'), false, 'bắt đầu đúng thứ Hai này: chưa phải báo cáo');
  assert.equal(xet('01/10/2026', '31/12/2026'), false);
  assert.equal(xet('01/09/2026', '21/09/2026'), true, 'deadline tuần trước: báo cáo tuần cuối');
  assert.equal(xet('01/09/2026', '20/09/2026'), false, 'deadline quá 7 ngày: thôi báo cáo');
  assert.equal(xet('', ''), true, 'thiếu ngày: vẫn theo dõi');
});

test('docBaoCaoTuan_: chỉ tính dòng đúng tuần, đúng mã, có nội dung', () => {
  const env = moiTruong();
  const file = taoFileDonVi('X', {
    baoCao: [
      { tuan: '28/09/2026', ma: 'A', daXong: 'kết quả' },
      { tuan: '28/09/2026', ma: 'B', keHoach: 'kế hoạch' },
      { tuan: '28/09/2026', ma: 'C', maMoc: 'C.1' },
      { tuan: '28/09/2026', ma: 'D' },                                 // không nội dung
      { tuan: '21/09/2026', ma: 'E', daXong: 'x' },                    // tuần khác
      { tuan: new Date(2026, 8, 28), ma: 'F', daXong: 'x', vuongMac: 'Cần HT' }, // ô Date
      { tuan: '28/09/2026', ma: 'G', daXong: 'x', vuongMac: '-' }      // "-" không phải vướng mắc
    ]
  });
  env.ctx.values = file.sheet('Báo cáo tuần').giaTri;
  const kq = env.chay('docBaoCaoTuan_(values, docNgay_("28/09/2026"))');
  assert.deepEqual(Object.keys(kq.daBaoCao).sort(), ['A', 'B', 'C', 'F', 'G']);
  assert.deepEqual({ ...kq.vuongMac }, { F: 'Cần HT' });
});

test('tinhThongKe_: mức độ ĐỎ / VÀNG / XANH', () => {
  const env = moiTruong();
  const mucDo = (mucTieu, moc) => {
    env.ctx.mt = mucTieu; env.ctx.moc = moc || [];
    return env.chay('tinhThongKe_(mt, moc).mucDo');
  };
  const tot = { trangThai: 'ĐÚNG TIẾN ĐỘ', daBC: true, pctHT: 50, pctTG: 20 };
  assert.equal(mucDo([tot]), 'XANH');
  assert.equal(mucDo([{ ...tot, daBC: false }]), 'VÀNG', 'chưa báo cáo');
  assert.equal(mucDo([{ ...tot, trangThai: 'CẢNH BÁO' }]), 'VÀNG');
  assert.equal(mucDo([{ ...tot, trangThai: 'TRỄ' }]), 'ĐỎ');
  assert.equal(mucDo([tot], [{ xong: false, han: new Date(2026, 8, 1) }]), 'ĐỎ', 'có mốc quá hạn');
  assert.equal(mucDo([tot], [{ xong: true, han: new Date(2026, 8, 1) }]), 'XANH', 'mốc quá hạn nhưng đã xong');
  assert.equal(mucDo([]), 'XANH');
});

test('sapXepTheoMucDo_: LỖI > ĐỎ > VÀNG > XANH, cùng mức thì nhiều TRỄ lên trước', () => {
  const env = moiTruong();
  const kq = (ten, mucDo, tre) => ({ donVi: { ten }, thongKe: { mucDo, tre: tre || 0, chuaBC: 0 } });
  env.ctx.ds = [kq('xanh', 'XANH'), kq('do1', 'ĐỎ', 1), kq('vang', 'VÀNG'), kq('loi', 'LỖI'), kq('do3', 'ĐỎ', 3)];
  assert.deepEqual(env.chay('sapXepTheoMucDo_(ds).map(k => k.donVi.ten)'), ['loi', 'do3', 'do1', 'vang', 'xanh']);
});

/* ============================== LUỒNG THỨ HAI ============================== */

test('kiemTraHangTuan: nhắc đúng người chưa báo cáo, CC Người kiểm + Trưởng đơn vị', () => {
  const env = moiTruong();
  env.chay('kiemTraHangTuan()');

  const nhac = timMail(env, '[Nhắc nhở]');
  assert.equal(nhac.length, 1, 'chỉ HK1-1 chưa báo cáo (HK1-8 chưa đến kỳ, HK1-6 đã báo cáo)');
  assert.equal(nhac[0].to, 'hung@dla.vn');
  assert.equal(nhac[0].cc, 'toan@dla.vn', 'Người kiểm trùng Trưởng đơn vị -> chỉ 1 lần');
  assert.match(nhac[0].subject, /Báo cáo tuần 28\/09\/2026 - Phòng QLKH-ĐBCL/);
  assert.match(nhac[0].htmlBody, /HK1-1/);
  assert.doesNotMatch(nhac[0].htmlBody, /HK1-8|HK1-6/);
});

test('kiemTraHangTuan: email Hiệu trưởng có tổng quan, vướng mắc, mục tiêu TRỄ', () => {
  const env = moiTruong({
    fileDonVi: { QLKH: donViMau('QLKH', {
      mucTieu: [
        { ma: 'HK1-1', ten: 'Đo lường CĐR', trangThai: 'TRỄ' },
        { ma: 'HK1-6', ten: 'NCKH giảng viên', nguoiTH: 'Đỗ Quốc Dũng' }
      ]
    }) }
  });
  env.chay('kiemTraHangTuan()');

  const ht = timMail(env, '[Dashboard toàn trường]');
  assert.equal(ht.length, 1);
  assert.equal(ht[0].to, 'ht@dla.vn');
  assert.match(ht[0].subject, /TRỄ 1, CẢNH BÁO 0, chưa BC 1/);
  assert.match(ht[0].htmlBody, /VƯỚNG MẮC CẦN HIỆU TRƯỞNG QUYẾT \(1\)/);
  assert.match(ht[0].htmlBody, /Cần HT duyệt kinh phí/);
  assert.match(ht[0].htmlBody, /MỤC TIÊU TRỄ \(1\)/);
  assert.match(ht[0].htmlBody, /ĐƠN VỊ CHƯA NHẬP ĐỦ BÁO CÁO TUẦN \(1\)/);
});

test('kiemTraHangTuan: gửi tóm tắt cho Trưởng đơn vị; tắt được bằng CONFIG', () => {
  let env = moiTruong();
  env.chay('kiemTraHangTuan()');
  const tt = timMail(env, '[Tóm tắt tuần]');
  assert.equal(tt.length, 1);
  assert.equal(tt[0].to, 'toan@dla.vn');
  assert.match(tt[0].subject, /VÀNG$/, 'HK1-1 CẢNH BÁO, chưa có mốc quá hạn');

  env = moiTruong();
  env.chay('CONFIG.GUI_TOM_TAT_DON_VI = false; kiemTraHangTuan()');
  assert.equal(timMail(env, '[Tóm tắt tuần]').length, 0);
});

test('Người thực hiện chưa khai email: gửi Trưởng đơn vị, ghi chú nhờ chuyển giúp', () => {
  const env = moiTruong({
    fileDonVi: { QLKH: donViMau('QLKH', { chuyenVien: [['Nguyễn Văn Toàn', 'TP', 'toan@dla.vn']] }) }
  });
  env.chay('kiemTraHangTuan()');
  const nhac = timMail(env, '[Nhắc nhở]')[0];
  assert.equal(nhac.to, 'toan@dla.vn');
  assert.equal(nhac.cc, '', 'không CC trùng người nhận');
  assert.match(nhac.htmlBody, /nhờ Trưởng đơn vị chuyển giúp/);
});

test('Không có email nào để gửi: bỏ qua và ghi nhật ký', () => {
  const env = moiTruong({
    dsDonVi: [{ ma: 'QLKH', ten: 'Phòng QLKH', file: 'QLKH', truong: 'A', email: '' }],
    fileDonVi: { QLKH: donViMau('QLKH', { chuyenVien: [] }) }
  });
  env.chay('kiemTraHangTuan()');
  assert.equal(timMail(env, '[Nhắc nhở]').length, 0);
  assert.ok(nhatKy(env).some(r => r[1] === 'Nhắc chưa BC' && /BỎ QUA/.test(r[5])));
});

test('Mọi mục tiêu đã báo cáo: không nhắc, email HT báo đã nhập đủ', () => {
  const env = moiTruong({
    fileDonVi: { QLKH: donViMau('QLKH', {
      baoCao: [
        { tuan: '28/09/2026', ma: 'HK1-1', daXong: 'x' },
        { tuan: '28/09/2026', ma: 'HK1-6', keHoach: 'y' }
      ]
    }) }
  });
  env.chay('kiemTraHangTuan()');
  assert.equal(timMail(env, '[Nhắc nhở]').length, 0);
  assert.match(timMail(env, '[Dashboard toàn trường]')[0].htmlBody, /Tất cả đơn vị đã nhập đủ/);
});

test('File đơn vị lỗi: không dừng, hiện LỖI trên dashboard và email HT', () => {
  const env = moiTruong({
    dsDonVi: [
      { ma: 'QLKH', ten: 'Phòng QLKH', file: 'QLKH', truong: 'Toàn', email: 'toan@dla.vn' },
      { ma: 'LUAT', ten: 'Khoa Luật', file: 'KHONG_CO_QUYEN', truong: 'A', email: 'a@dla.vn' },
      { ma: 'CNTT', ten: 'Khoa CNTT', file: 'THIEU_SHEET', truong: 'B', email: 'b@dla.vn' }
    ],
    fileDonVi: { QLKH: donViMau('QLKH'), THIEU_SHEET: donViMau('THIEU_SHEET', { boSheet: ['Mốc công việc'] }) }
  });
  env.chay('kiemTraHangTuan()');

  assert.equal(timMail(env, '[Nhắc nhở]').length, 1, 'đơn vị đọc được vẫn được xử lý');
  assert.equal(timMail(env, '[Tóm tắt tuần]').length, 1, 'không gửi tóm tắt cho đơn vị lỗi');

  const dash = env.fileTongHop.sheet('Dashboard Toàn trường').ghi;
  const dongDonVi = dash.filter(r => r.length > 5);
  assert.equal(dongDonVi[1][2], 'LỖI', 'đơn vị lỗi xếp đầu');
  assert.equal(dongDonVi[2][2], 'LỖI');
  assert.ok(dongDonVi.some(r => /Thiếu sheet \[Mốc công việc\]/.test(r[12])));

  const ht = timMail(env, '[Dashboard toàn trường]')[0].htmlBody;
  assert.match(ht, /Khoa Luật<\/td><td>LỖI: Bạn không có quyền/);
  assert.equal(nhatKy(env).filter(r => r[1] === 'LỖI').length, 2);
});

test('Đơn vị không đánh x ở cột Theo dõi: bỏ qua', () => {
  const env = moiTruong({
    dsDonVi: [
      { ma: 'QLKH', ten: 'Phòng QLKH', file: 'QLKH', truong: 'Toàn', email: 'toan@dla.vn' },
      { ma: 'TAT', ten: 'Đơn vị tạm dừng', file: 'KHONG_CO_QUYEN', theoDoi: '' }
    ]
  });
  env.chay('kiemTraHangTuan()');
  assert.equal(nhatKy(env).filter(r => r[1] === 'LỖI').length, 0);
  assert.doesNotMatch(timMail(env, '[Dashboard toàn trường]')[0].htmlBody, /tạm dừng/);
});

test('TEST_MODE: mọi email về tài khoản đang chạy, ghi người nhận thật trong thư', () => {
  const env = moiTruong({ testMode: true });
  env.chay('kiemTraHangTuan()');
  assert.ok(env.mail.length >= 3);
  env.mail.forEach(m => {
    assert.equal(m.to, 'toi@daihoclongan.edu.vn');
    assert.match(m.subject, /^\[TEST\]/);
    assert.equal(m.cc, undefined);
  });
  assert.match(timMail(env, '[Nhắc nhở]')[0].htmlBody, /\[TEST\] To: hung@dla.vn \| CC: toan@dla.vn/);
  assert.ok(nhatKy(env).every(r => r[1] === 'LỖI' || r[5] === 'TEST'));
});

test('Tên có ký tự HTML được thoát trong email', () => {
  const env = moiTruong({
    fileDonVi: { QLKH: donViMau('QLKH', { mucTieu: [{ ma: 'HK1-1', ten: '<script>x</script>' }] }) }
  });
  env.chay('kiemTraHangTuan()');
  const body = timMail(env, '[Nhắc nhở]')[0].htmlBody;
  assert.doesNotMatch(body, /<script>/);
  assert.match(body, /&lt;script&gt;/);
});

/* ============================== DASHBOARD ============================== */

test('Dashboard: đơn vị xếp theo mức độ, tô màu; Chi tiết chỉ có mục tiêu phải báo cáo', () => {
  const tot = taoFileDonVi('TOT', {
    mucTieu: [{ ma: 'A-1', nguoiTH: 'Nguyễn Tiến Hùng' }],
    baoCao: [{ tuan: '28/09/2026', ma: 'A-1', daXong: 'x' }]
  });
  const env = moiTruong({
    dsDonVi: [
      { ma: 'TOT', ten: 'Đơn vị tốt', file: 'TOT', email: 't@dla.vn' },
      { ma: 'QLKH', ten: 'Phòng QLKH', file: 'QLKH', email: 'toan@dla.vn' }
    ],
    fileDonVi: { TOT: tot, QLKH: donViMau('QLKH') }
  });
  env.chay('capNhatDashboard()');

  assert.equal(env.mail.length, 0, 'capNhatDashboard không gửi email');
  const sh = env.fileTongHop.sheet('Dashboard Toàn trường');
  const bang = sh.ghi.filter(r => r.length > 5);
  assert.equal(bang[0][0], 'Đơn vị', 'dòng tiêu đề');
  assert.deepEqual(bang.slice(1).map(r => [r[0], r[2]]), [['Phòng QLKH', 'VÀNG'], ['Đơn vị tốt', 'XANH']]);
  assert.deepEqual(sh.mau.map(r => r[0]), ['#fff2cc', '#d9ead3']);

  const ct = env.fileTongHop.sheet('Chi tiết mục tiêu').ghi;
  assert.deepEqual(ct.slice(1).map(r => r[1] + ':' + r[11]), ['HK1-1:CHƯA', 'HK1-6:Có', 'A-1:Có']);
});

/* ============================== THỨ SÁU ============================== */

test('nhacTruocHan: liệt kê mốc chưa xong đến hạn trong 7 ngày, nhắc hạn báo cáo thứ Hai tới', () => {
  const env = moiTruong({
    bayGio: THU_SAU_15H,
    fileDonVi: { QLKH: donViMau('QLKH', {
      moc: [
        { maMT: 'HK1-1', maCV: 'HK1-1.1', han: '30/09/2026' },  // đã quá hạn -> không vào "sắp đến hạn"
        { maMT: 'HK1-1', maCV: 'HK1-1.2', han: '05/10/2026' },  // trong 7 ngày
        { maMT: 'HK1-1', maCV: 'HK1-1.3', han: '09/10/2026' },  // đúng ngày thứ 7
        { maMT: 'HK1-1', maCV: 'HK1-1.4', han: '10/10/2026' },  // quá 7 ngày
        { maMT: 'HK1-1', maCV: 'HK1-1.5', han: '06/10/2026', xong: 'x' }
      ]
    }) }
  });
  env.chay('nhacTruocHan()');

  const hung = env.mail.find(m => m.to === 'hung@dla.vn');
  assert.match(hung.subject, /Báo cáo tuần 05\/10\/2026 & 2 mốc sắp đến hạn/);
  assert.match(hung.htmlBody, /HK1-1\.2/);
  assert.match(hung.htmlBody, /HK1-1\.3/);
  assert.doesNotMatch(hung.htmlBody, /HK1-1\.1|HK1-1\.4|HK1-1\.5/);

  // HK1-8 bắt đầu 01/10 -> phải báo cáo tuần 05/10 -> Phạm Thị Hồng Nhung (chưa có email) -> Trưởng đơn vị
  assert.ok(env.mail.some(m => m.to === 'toan@dla.vn' && /Phạm Thị Hồng Nhung/.test(m.htmlBody)));
  assert.ok(env.mail.every(m => !/\[Nhắc nhở\]|\[Dashboard/.test(m.subject)), 'thứ Sáu chỉ gửi nhắc lịch');
});

/* ============================== CÀI ĐẶT ============================== */

test('caiDatTrigger: tạo 2 lịch đúng thứ/giờ, chạy lại không bị trùng', () => {
  const env = moiTruong();
  env.chay('caiDatTrigger(); caiDatTrigger();');
  assert.deepEqual(env.triggers.map(t => [t.ham, t.thu, t.gio, t.tz]), [
    ['kiemTraHangTuan', 'MONDAY', 10, 'Asia/Ho_Chi_Minh'],
    ['nhacTruocHan', 'FRIDAY', 15, 'Asia/Ho_Chi_Minh']
  ]);
});

test('khoiTao: tạo sheet và tiêu đề trong file trống, không ghi đè file đã có dữ liệu', () => {
  const { Spreadsheet } = require('./helpers/gas-mock');
  const trong = new Spreadsheet('MOI', {});
  const env = taoMoiTruong({ thuMuc: THU_MUC, bayGio: THU_HAI_10H, fileTongHop: trong });
  env.chay('khoiTao()');
  ['DS_DonVi', 'Dashboard Toàn trường', 'Chi tiết mục tiêu', 'Nhật ký']
    .forEach(ten => assert.ok(trong.getSheetByName(ten), 'có sheet ' + ten));
  assert.equal(trong.sheet('DS_DonVi').ghi[0][0], 'Mã ĐV');
  assert.equal(trong.sheet('DS_DonVi').ghi.length, 2, 'tiêu đề + 1 dòng mẫu');

  const daCo = moiTruong();
  daCo.chay('khoiTao()');
  assert.equal(daCo.fileTongHop.sheet('DS_DonVi').ghi.length, 0);
});

test('Nhật ký được ghi một lần vào cuối lượt chạy', () => {
  const env = moiTruong();
  env.chay('kiemTraHangTuan()');
  const kinds = nhatKy(env).map(r => r[1]);
  assert.deepEqual(kinds, ['Nhắc chưa BC', 'Dashboard HT', 'Tóm tắt đơn vị']);
  assert.equal(env.chay('BO_DEM_NHAT_KY.length'), 0, 'bộ đệm đã được xả');
});
