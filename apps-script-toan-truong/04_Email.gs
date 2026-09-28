/**
 * EMAIL
 *   guiNhacChuaBaoCao_  thứ Hai - Người thực hiện chưa nhập Báo cáo tuần
 *   guiEmailHieuTruong_ thứ Hai - tổng hợp toàn trường
 *   guiTomTatDonVi_     thứ Hai - tóm tắt cho Trưởng đơn vị
 *   guiNhacTruocHan_    thứ Sáu - mốc sắp đến hạn + nhắc hạn nộp báo cáo
 *   guiMail_            gửi thật / gửi thử + ghi nhật ký
 *
 * Người thực hiện chưa khai email trong [DS_ChuyenVien] -> gửi cho Trưởng đơn vị.
 */

/* ======================= NHẮC CHƯA BÁO CÁO (THỨ HAI) ======================= */

function guiNhacChuaBaoCao_(kq, tuan) {
  const theoNguoi = gomTheo_(kq.mucTieu.filter(mt => !mt.daBC), mt => mt.nguoiTH);

  Object.keys(theoNguoi).forEach(nguoi => {
    const dsMT = theoNguoi[nguoi];
    const nguoiNhan = emailNguoiThucHien_(kq, nguoi);
    const cc = dsMT.map(mt => kq.email[mt.nguoiKiem]).concat(kq.donVi.emailTruong, kq.donVi.cc);

    const html = loiChao_(nguoi, !kq.email[nguoi]) +
      doan_('Đến ' + ngayVN_(new Date(), 'HH:mm dd/MM/yyyy') + ', sheet <b>[Báo cáo tuần]</b> của ' +
        esc_(kq.donVi.ten) + ' chưa có báo cáo tuần <b>' + ngayVN_(tuan) + '</b> cho các mục tiêu:') +
      bangHtml_(['Mã MT', 'Mục tiêu', 'Trạng thái', 'Tuần liên tiếp không BC'],
        dsMT.map(mt => [mt.maMT, mt.ten, mt.trangThai, mt.tuanKhongBC])) +
      doan_('Đề nghị cập nhật ngay: mỗi mục tiêu ghi <b>một dòng mới</b> ở cuối bảng (Tuần = ' +
        ngayVN_(tuan) + ', Mã MT, Kết quả đã xong, Kế hoạch tuần tới, Vướng mắc, Link minh chứng).') +
      lienKet_(kq.url, 'Mở file theo dõi của ' + kq.donVi.ten) + chanTrang_();

    guiMail_({
      den: nguoiNhan, cc: cc, loai: 'Nhắc chưa BC', donVi: kq.donVi.ten, html: html,
      tieuDe: '[Nhắc nhở] Chưa nhập Báo cáo tuần ' + ngayVN_(tuan) + ' - ' + kq.donVi.ten
    });
  });
}

/* ========================= EMAIL HIỆU TRƯỞNG (THỨ HAI) ========================= */

function guiEmailHieuTruong_(dsKetQua, tuan) {
  const tong = tongHopToanTruong_(dsKetQua);
  const dsSapXep = sapXepTheoMucDo_(dsKetQua);

  // Gom các mục tiêu cần HT chú ý từ mọi đơn vị
  const dsVuongMac = [];
  const dsTre = [];
  dsSapXep.forEach(kq => kq.mucTieu.forEach(mt => {
    const tenMT = mt.maMT + ' - ' + mt.ten;
    if (mt.vuongMac) dsVuongMac.push([kq.donVi.ten, tenMT, mt.nguoiTH, mt.vuongMac]);
    if (laTre_(mt)) dsTre.push([kq.donVi.ten, tenMT, mt.nguoiTH, mt.pctHT + '% / ' + mt.pctTG + '%', mt.mocQuaHan]);
  }));
  const dsChuaBC = dsSapXep.filter(kq => kq.thongKe.chuaBC > 0);

  const html = '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    doan_('Kính gửi Thầy Hiệu trưởng,') +
    doan_('Tình hình thực hiện mục tiêu học kỳ của các đơn vị, tuần <b>' + ngayVN_(tuan) + '</b>:') +

    tieuDeMuc_('1. TỔNG QUAN TOÀN TRƯỜNG') +
    bangHtml_(['Đơn vị', 'Mục tiêu', 'TRỄ', 'CẢNH BÁO', 'Chưa BC tuần', 'Mốc quá hạn', 'Vướng mắc chờ HT'],
      [[dsKetQua.length, tong.soMT, tong.tre, tong.canhBao, tong.chuaBC, tong.mocQuaHan, tong.vuongMac]],
      { canGiua: true }) +

    tieuDeMuc_('2. THEO ĐƠN VỊ') +
    bangHtml_(['Đơn vị', 'Mức độ', 'Số MT', 'TRỄ', 'CẢNH BÁO', 'Chưa BC', 'Mốc quá hạn',
      'Vướng mắc', '% HT TB', '% TG TB'],
      dsSapXep.map(kq => kq.loi
        ? [kq.donVi.ten, 'LỖI: ' + kq.loi, '', '', '', '', '', '', '', '']
        : [kq.donVi.ten, kq.thongKe.mucDo, kq.thongKe.soMT, kq.thongKe.tre, kq.thongKe.canhBao,
          kq.thongKe.chuaBC, kq.thongKe.mocQuaHan, kq.thongKe.vuongMac,
          kq.thongKe.pctHT + '%', kq.thongKe.pctTG + '%']),
      { mauDong: dsSapXep.map(kq => MAU[kq.thongKe.mucDo]) }) +

    tieuDeMuc_('3. VƯỚNG MẮC CẦN HIỆU TRƯỞNG QUYẾT (' + dsVuongMac.length + ')', MAU.CHU_DO) +
    bangHoacKhongCo_(['Đơn vị', 'Mục tiêu', 'Người thực hiện', 'Nội dung'], dsVuongMac) +

    tieuDeMuc_('4. MỤC TIÊU TRỄ (' + dsTre.length + ')', MAU.CHU_DO) +
    bangHoacKhongCo_(['Đơn vị', 'Mục tiêu', 'Người thực hiện', '% HT / % TG', 'Mốc quá hạn'], dsTre) +

    tieuDeMuc_('5. ĐƠN VỊ CHƯA NHẬP ĐỦ BÁO CÁO TUẦN (' + dsChuaBC.length + ')') +
    (dsChuaBC.length
      ? '<ul>' + dsChuaBC.map(kq => '<li>' + esc_(kq.donVi.ten) + ': ' + kq.thongKe.chuaBC + '/' +
        kq.thongKe.soMT + ' mục tiêu (' +
        esc_(duyNhat_(kq.mucTieu.filter(mt => !mt.daBC).map(mt => mt.nguoiTH)).join(', ')) +
        ')</li>').join('') + '</ul>' +
        doan_('Đã gửi email nhắc nhở cho người thực hiện và Trưởng đơn vị.')
      : doan_('<span style="color:' + MAU.CHU_XANH + '">Tất cả đơn vị đã nhập đủ.</span>')) +

    lienKet_(ssTongHop_().getUrl(), 'Mở Dashboard toàn trường') + chanTrang_() + '</div>';

  guiMail_({
    den: CONFIG.EMAIL_HIEU_TRUONG.join(','), cc: CONFIG.CC_HIEU_TRUONG,
    loai: 'Dashboard HT', donVi: 'Toàn trường', html: html,
    tieuDe: '[Dashboard toàn trường] Tuần ' + ngayVN_(tuan) + ' - TRỄ ' + tong.tre +
      ', CẢNH BÁO ' + tong.canhBao + ', chưa BC ' + tong.chuaBC
  });
}

/* ======================= TÓM TẮT TRƯỞNG ĐƠN VỊ (THỨ HAI) ======================= */

function guiTomTatDonVi_(kq, tuan) {
  const tk = kq.thongKe;
  const html = loiChao_(kq.donVi.truong) +
    doan_('Tóm tắt tiến độ <b>' + esc_(kq.donVi.ten) + '</b> tuần ' + ngayVN_(tuan) +
      ' (mức độ: <b>' + tk.mucDo + '</b>):') +
    bangHtml_(['Mã MT', 'Mục tiêu', 'Người thực hiện', 'Mốc xong/tổng', '% HT', '% TG',
      'Trạng thái', 'Đã BC tuần'],
      kq.mucTieu.map(mt => [mt.maMT, mt.ten, mt.nguoiTH, mt.tienDo, mt.pctHT + '%', mt.pctTG + '%',
        mt.trangThai, mt.daBC ? 'Có' : 'CHƯA']),
      { mauDong: kq.mucTieu.map(mauMucTieu_) }) +
    doan_('Mốc quá hạn: <b>' + tk.mocQuaHan + '</b> | Mốc đến hạn trong ' + CONFIG.SO_NGAY_DEN_HAN +
      ' ngày tới: <b>' + tk.mocDenHan + '</b>') +
    doan_('Mục tiêu CẢNH BÁO: Trưởng đơn vị nêu phương án khắc phục trong Báo cáo tuần.') +
    lienKet_(kq.url, 'Mở file theo dõi') + chanTrang_();

  guiMail_({
    den: kq.donVi.emailTruong, cc: kq.donVi.cc, loai: 'Tóm tắt đơn vị', donVi: kq.donVi.ten,
    html: html, tieuDe: '[Tóm tắt tuần] ' + kq.donVi.ten + ' - ' + ngayVN_(tuan) + ' - ' + tk.mucDo
  });
}

/* ========================= NHẮC TRƯỚC HẠN (THỨ SÁU) ========================= */

function guiNhacTruocHan_(kq, tuanToi) {
  const homNay = homNay_();
  const mtTheoNguoi = gomTheo_(kq.mucTieu, mt => mt.nguoiTH);

  // Mốc sắp đến hạn, gắn với người thực hiện qua mã mục tiêu
  const nguoiCuaMT = {};
  kq.mucTieu.forEach(mt => (nguoiCuaMT[mt.maMT] = mt.nguoiTH));
  const mocTheoNguoi = gomTheo_(
    kq.moc.filter(m => nguoiCuaMT[m.maMT] && laMocSapDenHan_(m, homNay, CONFIG.SO_NGAY_NHAC_TRUOC)),
    m => nguoiCuaMT[m.maMT]);

  Object.keys(mtTheoNguoi).forEach(nguoi => {
    const dsMoc = mocTheoNguoi[nguoi] || [];
    const html = loiChao_(nguoi, !kq.email[nguoi]) +
      (dsMoc.length
        ? doan_('Các mốc công việc sau đến hạn trong ' + CONFIG.SO_NGAY_NHAC_TRUOC +
          ' ngày tới và <b>chưa đánh dấu hoàn thành</b>:') +
          bangHtml_(['Mã CV', 'Sản phẩm bàn giao', 'Hạn'], dsMoc.map(m => [m.maCV, m.sanPham, ngayVN_(m.han)]))
        : '') +
      doan_('Nhắc lịch: hạn nhập <b>Báo cáo tuần ' + ngayVN_(tuanToi) + '</b> là <b>10h thứ Hai</b> ' +
        'cho các mục tiêu: ' + esc_(mtTheoNguoi[nguoi].map(mt => mt.maMT).join(', ')) + '.') +
      lienKet_(kq.url, 'Mở file theo dõi của ' + kq.donVi.ten) + chanTrang_();

    guiMail_({
      den: emailNguoiThucHien_(kq, nguoi), loai: 'Nhắc trước hạn', donVi: kq.donVi.ten, html: html,
      tieuDe: '[Nhắc lịch] ' + kq.donVi.ten + ' - Báo cáo tuần ' + ngayVN_(tuanToi) +
        (dsMoc.length ? ' & ' + dsMoc.length + ' mốc sắp đến hạn' : '')
    });
  });
}

/* ================================ GỬI MAIL ================================ */

/**
 * Gửi 1 email và ghi nhật ký.
 * thu: { den, cc?, tieuDe, html, loai, donVi }
 * TEST_MODE: gửi về tài khoản đang chạy, đầu thư ghi người nhận thật.
 */
function guiMail_(thu) {
  const cc = duyNhat_((thu.cc || []).filter(e => e && e !== thu.den));
  if (!thu.den) {
    ghiNhatKy_(thu.loai, thu.donVi, '', thu.tieuDe, 'BỎ QUA: không có email người nhận');
    return;
  }

  let email = { to: thu.den, cc: cc.join(','), subject: thu.tieuDe, htmlBody: thu.html };
  if (CONFIG.TEST_MODE) {
    email = {
      to: emailCuaToi_(),
      subject: '[TEST] ' + thu.tieuDe,
      htmlBody: '<p style="background:#fff2cc;padding:6px">[TEST] To: ' + esc_(thu.den) +
        (cc.length ? ' | CC: ' + esc_(cc.join(', ')) : '') + '</p>' + thu.html
    };
  }

  try {
    MailApp.sendEmail(email);
    ghiNhatKy_(thu.loai, thu.donVi, thu.den, thu.tieuDe, CONFIG.TEST_MODE ? 'TEST' : 'Đã gửi');
  } catch (e) {
    ghiNhatKy_(thu.loai, thu.donVi, thu.den, thu.tieuDe, 'LỖI: ' + e.message);
  }
}

/** Email người thực hiện; chưa khai email thì gửi Trưởng đơn vị. */
function emailNguoiThucHien_(kq, nguoi) {
  return kq.email[nguoi] || kq.donVi.emailTruong;
}

/** Email tài khoản đang chạy script (lưu lại để không gọi nhiều lần). */
function emailCuaToi_() {
  if (!emailCuaToi_.giaTri) emailCuaToi_.giaTri = Session.getEffectiveUser().getEmail();
  return emailCuaToi_.giaTri;
}

/* ============================ KHỐI HTML DÙNG CHUNG ============================ */

function loiChao_(ten, nhoChuyenGiup) {
  return doan_('Kính gửi Anh/Chị <b>' + esc_(ten) + '</b>' +
    (nhoChuyenGiup ? ' (chưa có email - nhờ Trưởng đơn vị chuyển giúp)' : '') + ',');
}

function doan_(html) {
  return '<p>' + html + '</p>';
}

function tieuDeMuc_(text, mau) {
  return '<h3 style="color:' + (mau || MAU.TIEU_DE) + '">' + esc_(text) + '</h3>';
}

function lienKet_(url, text) {
  return doan_('<a href="' + url + '">' + esc_(text) + '</a>');
}

function chanTrang_() {
  return '<p>Trân trọng.</p><p style="color:#888;font-size:11px">Email gửi tự động từ ' +
    'Hệ thống theo dõi tiến độ - Trường ĐH Kinh tế Công nghiệp Long An.</p>';
}

function bangHoacKhongCo_(tieuDe, dsDong) {
  return dsDong.length ? bangHtml_(tieuDe, dsDong) : doan_('Không có.');
}

/**
 * Bảng HTML cho email.
 * tuyChon: { mauDong: [màu nền từng dòng], canGiua: true/false }
 */
function bangHtml_(tieuDe, dsDong, tuyChon) {
  const tc = tuyChon || {};
  const o = (the, giaTri) => '<' + the + (tc.canGiua ? ' align="center"' : '') + '>' +
    esc_(chuoi_(giaTri).replace(/\s*\n\s*/g, ' ')) + '</' + the + '>';

  return '<table cellpadding="5" cellspacing="0" border="1" ' +
    'style="border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif">' +
    '<tr style="background:' + MAU.TIEU_DE + ';color:#fff">' + tieuDe.map(h => o('th', h)).join('') + '</tr>' +
    dsDong.map((dong, i) =>
      '<tr' + (tc.mauDong ? ' style="background:' + tc.mauDong[i] + '"' : '') + '>' +
      dong.map(giaTri => o('td', giaTri)).join('') + '</tr>').join('') +
    '</table>';
}
