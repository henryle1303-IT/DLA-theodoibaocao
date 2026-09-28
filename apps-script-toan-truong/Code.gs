/**
 * HỆ THỐNG THEO DÕI TIẾN ĐỘ TOÀN TRƯỜNG - ĐẠI HỌC KINH TẾ CÔNG NGHIỆP LONG AN
 *
 * Mô hình:
 *   - Mỗi đơn vị (Phòng/Khoa/Trung tâm) có 1 file Google Sheet riêng, copy từ file mẫu
 *     (TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027) - giữ nguyên tên sheet và thứ tự cột.
 *   - 1 file TỔNG HỢP TOÀN TRƯỜNG chứa script này:
 *       [DS_DonVi]              danh sách đơn vị + link file + trưởng đơn vị (nhập tay)
 *       [Dashboard Toàn trường] script tự ghi - mỗi đơn vị 1 dòng
 *       [Chi tiết mục tiêu]     script tự ghi - mọi mục tiêu của mọi đơn vị
 *       [Nhật ký]               script tự ghi - lịch sử gửi email / lỗi
 *
 * Lịch tự động (caiDatTrigger):
 *   - Thứ Sáu 15h : nhacTruocHan()     - nhắc mốc sắp đến hạn + hạn nộp báo cáo tuần.
 *   - Thứ Hai 10h : kiemTraHangTuan()  - nhắc người chưa nhập báo cáo tuần,
 *                                        cập nhật dashboard, gửi email Hiệu trưởng,
 *                                        gửi tóm tắt cho từng Trưởng đơn vị.
 */

const CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',

  // Sheet trong file tổng hợp
  SHEET_DS_DON_VI: 'DS_DonVi',
  SHEET_DASHBOARD: 'Dashboard Toàn trường',
  SHEET_CHI_TIET: 'Chi tiết mục tiêu',
  SHEET_NHAT_KY: 'Nhật ký',

  // Sheet trong file của từng đơn vị (theo file mẫu)
  UNIT: {
    MUC_TIEU: 'Mục tiêu học kỳ',
    BAO_CAO: 'Báo cáo tuần',
    MOC: 'Mốc công việc',
    CHUYEN_VIEN: 'DS_ChuyenVien'
  },

  EMAIL_HIEU_TRUONG: ['hieutruong@daihoclongan.edu.vn'],
  CC_HIEU_TRUONG: [],          // ví dụ: thư ký HT, Phòng TCHC

  GUI_TOM_TAT_DON_VI: true,    // gửi tóm tắt đơn vị cho Trưởng đơn vị mỗi thứ Hai
  SO_NGAY_SAP_HAN: 7,          // nhắc thứ Sáu: mốc đến hạn trong N ngày tới
  SO_NGAY_DEN_HAN_DASHBOARD: 14,

  GIO_KIEM_TRA: 10,            // thứ Hai
  GIO_NHAC_TRUOC: 15,          // thứ Sáu

  // true: mọi email gửi về tài khoản đang chạy script (đầu email ghi người nhận thật)
  TEST_MODE: true
};

// Cột trong [DS_DonVi]
const DV = { MA: 0, TEN: 1, FILE: 2, TRUONG: 3, EMAIL_TRUONG: 4, CC: 5, THEO_DOI: 6 };

/* ============================ MENU ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Theo dõi tiến độ')
    .addItem('Cập nhật Dashboard ngay (không gửi mail)', 'capNhatDashboard')
    .addItem('Chạy kiểm tra thứ Hai (gửi mail)', 'kiemTraHangTuan')
    .addItem('Chạy nhắc trước hạn thứ Sáu (gửi mail)', 'nhacTruocHan')
    .addSeparator()
    .addItem('Khởi tạo các sheet', 'khoiTao')
    .addItem('Cài lịch tự động', 'caiDatTrigger')
    .addToUi();
}

/* ========================= HÀM CHÍNH ========================= */

/** Thứ Hai: nhắc chưa báo cáo -> cập nhật dashboard -> email HT -> tóm tắt đơn vị. */
function kiemTraHangTuan() {
  const monday = getCurrentMonday_();
  const ketQua = docTatCaDonVi_(monday);

  ketQua.filter(k => !k.loi).forEach(k => guiNhacChuaBaoCao_(k, monday));
  ghiDashboard_(ketQua, monday);
  guiEmailHieuTruong_(ketQua, monday);
  if (CONFIG.GUI_TOM_TAT_DON_VI) {
    ketQua.filter(k => !k.loi).forEach(k => guiTomTatDonVi_(k, monday));
  }
}

/** Chỉ đọc dữ liệu và ghi dashboard, không gửi email. */
function capNhatDashboard() {
  const monday = getCurrentMonday_();
  ghiDashboard_(docTatCaDonVi_(monday), monday);
}

/** Thứ Sáu: nhắc mốc sắp đến hạn và hạn nộp báo cáo thứ Hai tới. */
function nhacTruocHan() {
  const nextMonday = addDays_(getCurrentMonday_(), 7);
  const today = today_();
  const denNgay = addDays_(today, CONFIG.SO_NGAY_SAP_HAN);

  docDanhSachDonVi_().forEach(dv => {
    let d;
    try {
      d = docDonVi_(dv, nextMonday);
    } catch (e) {
      ghiNhatKy_('LỖI', dv.ten, '', 'Không đọc được file', e.message);
      return;
    }
    // Gom theo người thực hiện: mục tiêu đang theo dõi + mốc sắp đến hạn
    const theoNguoi = {};
    d.goals.filter(g => g.active).forEach(g => {
      const p = (theoNguoi[g.nguoiTH] = theoNguoi[g.nguoiTH] || { goals: [], moc: [] });
      p.goals.push(g);
    });
    d.moc.filter(m => !m.xong && m.han && m.han >= today && m.han <= denNgay).forEach(m => {
      const g = d.goalMap[m.maMT];
      if (!g || !theoNguoi[g.nguoiTH]) return;
      theoNguoi[g.nguoiTH].moc.push(m);
    });

    Object.keys(theoNguoi).forEach(nguoi => {
      const p = theoNguoi[nguoi];
      let html = '<p>Kính gửi Anh/Chị <b>' + esc_(nguoi) + '</b>,</p>';
      if (p.moc.length) {
        html += '<p>Các mốc công việc sau đến hạn trong ' + CONFIG.SO_NGAY_SAP_HAN +
          ' ngày tới và <b>chưa đánh dấu hoàn thành</b>:</p>' +
          bang_(['Mã CV', 'Sản phẩm bàn giao', 'Hạn'],
            p.moc.map(m => [m.maCV, m.sanPham, fmt_(m.han)]));
      }
      html += '<p>Nhắc lịch: hạn nhập <b>Báo cáo tuần ' + fmt_(nextMonday) +
        '</b> là <b>10h thứ Hai</b> cho các mục tiêu: ' +
        p.goals.map(g => esc_(g.maMT)).join(', ') + '.</p>' +
        '<p><a href="' + d.url + '">Mở file theo dõi của ' + esc_(dv.ten) + '</a></p>' + chanTrang_();
      const subject = '[Nhắc lịch] ' + dv.ten + ' - Báo cáo tuần ' + fmt_(nextMonday) +
        (p.moc.length ? ' & ' + p.moc.length + ' mốc sắp đến hạn' : '');
      guiMail_(d.emails[nguoi] || dv.emailTruong, [], subject, html, dv.ten, 'Nhắc trước hạn');
    });
  });
}

/** Tạo trigger. Chạy một lần. */
function caiDatTrigger() {
  const ten = ['kiemTraHangTuan', 'nhacTruocHan'];
  ScriptApp.getProjectTriggers()
    .filter(t => ten.indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('kiemTraHangTuan').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(CONFIG.GIO_KIEM_TRA)
    .inTimezone(CONFIG.TIMEZONE).create();
  ScriptApp.newTrigger('nhacTruocHan').timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(CONFIG.GIO_NHAC_TRUOC)
    .inTimezone(CONFIG.TIMEZONE).create();
  Logger.log('Đã cài: thứ Hai %sh kiểm tra, thứ Sáu %sh nhắc trước hạn.',
    CONFIG.GIO_KIEM_TRA, CONFIG.GIO_NHAC_TRUOC);
}

/** Tạo các sheet cần thiết trong file tổng hợp (không xóa dữ liệu có sẵn). */
function khoiTao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ds = layHoacTaoSheet_(ss, CONFIG.SHEET_DS_DON_VI);
  if (ds.getLastRow() === 0) {
    ds.getRange(1, 1, 1, 7).setValues([[
      'Mã ĐV', 'Tên đơn vị', 'Link file theo dõi (URL hoặc ID)', 'Trưởng đơn vị',
      'Email Trưởng đơn vị', 'Email CC (cách nhau dấu phẩy)', 'Theo dõi (x)'
    ]]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    ds.getRange(2, 1, 1, 7).setValues([[
      'QLKH-ĐBCL', 'Phòng QLKH-ĐBCL',
      'https://docs.google.com/spreadsheets/d/1V0i8iCyzv3XWexdE8rZkgWYliu7-gmpQoUTXz6n1s1I/edit',
      'Nguyễn Văn Toàn', '', '', 'x'
    ]]);
    ds.setFrozenRows(1);
    ds.autoResizeColumns(1, 7);
  }
  layHoacTaoSheet_(ss, CONFIG.SHEET_DASHBOARD);
  layHoacTaoSheet_(ss, CONFIG.SHEET_CHI_TIET);
  const nk = layHoacTaoSheet_(ss, CONFIG.SHEET_NHAT_KY);
  if (nk.getLastRow() === 0) {
    nk.appendRow(['Thời gian', 'Loại', 'Đơn vị', 'Người nhận', 'Tiêu đề', 'Kết quả']);
    nk.getRange(1, 1, 1, 6).setFontWeight('bold');
    nk.setFrozenRows(1);
  }
}

/* ======================= ĐỌC DỮ LIỆU ======================= */

function docDanhSachDonVi_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DS_DON_VI);
  if (!sh) throw new Error('Chưa có sheet ' + CONFIG.SHEET_DS_DON_VI + '. Hãy chạy khoiTao().');
  return sh.getDataRange().getValues().slice(1)
    .filter(r => String(r[DV.FILE]).trim() && /x/i.test(String(r[DV.THEO_DOI])))
    .map(r => ({
      ma: String(r[DV.MA]).trim(),
      ten: String(r[DV.TEN]).trim(),
      fileId: layFileId_(r[DV.FILE]),
      truong: String(r[DV.TRUONG]).trim(),
      emailTruong: String(r[DV.EMAIL_TRUONG]).trim(),
      cc: String(r[DV.CC]).split(/[,;\s]+/).filter(Boolean)
    }));
}

function docTatCaDonVi_(monday) {
  return docDanhSachDonVi_().map(dv => {
    try {
      return docDonVi_(dv, monday);
    } catch (e) {
      ghiNhatKy_('LỖI', dv.ten, '', 'Không đọc được file', e.message);
      return { dv: dv, loi: e.message, goals: [], moc: [], tk: tkRong_() };
    }
  });
}

/** Đọc 1 file đơn vị, trả về mục tiêu, mốc, email và số liệu thống kê. */
function docDonVi_(dv, monday) {
  const ss = SpreadsheetApp.openById(dv.fileId);
  const mondayKey = dateKey_(monday);
  const today = today_();

  const sheet = name => {
    const s = ss.getSheetByName(name);
    if (!s) throw new Error('Thiếu sheet [' + name + ']');
    return s;
  };

  // --- Báo cáo tuần: mục tiêu đã báo cáo tuần này + vướng mắc ---
  const bc = sheet(CONFIG.UNIT.BAO_CAO).getDataRange().getValues();
  const daBC = {};
  const vuongMac = {};
  for (let r = timDongTieuDe_(bc, 'Mã MT') + 1; r < bc.length; r++) {
    const row = bc[r];
    const tuan = parseDate_(row[0]);
    const ma = String(row[1]).trim();
    if (!tuan || dateKey_(tuan) !== mondayKey || !ma) continue;
    if ([row[4], row[5], row[6]].some(v => String(v).trim() !== '')) daBC[ma] = true;
    const vm = String(row[7]).trim();
    if (vm && vm !== '-') vuongMac[ma] = vm;
  }

  // --- Mục tiêu học kỳ ---
  const shMT = sheet(CONFIG.UNIT.MUC_TIEU).getDataRange();
  const mtV = shMT.getValues();
  const mtD = shMT.getDisplayValues();
  const goals = [];
  for (let r = timDongTieuDe_(mtV, 'Mã MT') + 1; r < mtV.length; r++) {
    const ma = String(mtV[r][0]).trim();
    if (!ma || !String(mtV[r][1]).trim()) continue;
    const batDau = parseDate_(mtV[r][4]);
    const deadline = parseDate_(mtV[r][5]);
    goals.push({
      maMT: ma,
      ten: String(mtV[r][1]).trim(),
      nguoiTH: String(mtV[r][2]).trim(),
      nguoiKiem: String(mtV[r][3]).trim(),
      deadline: deadline,
      tienDo: mtD[r][6],
      pctHT: toPct_(mtV[r][7]),
      pctTG: toPct_(mtV[r][8]),
      mocQuaHan: Number(mtV[r][9]) || 0,
      tuanKhongBC: Number(mtV[r][10]) || 0,
      trangThai: String(mtD[r][11]).trim(),
      // Báo cáo thứ Hai là cho tuần trước: MT bắt đầu từ thứ Hai này trở đi chưa phải báo cáo,
      // MT đã hết hạn vẫn báo cáo thêm 1 tuần sau deadline.
      active: !(batDau && batDau >= monday) && !(deadline && deadline < addDays_(monday, -7)),
      daBC: !!daBC[ma],
      vuongMac: vuongMac[ma] || ''
    });
  }
  const goalMap = {};
  goals.forEach(g => (goalMap[g.maMT] = g));

  // --- Mốc công việc ---
  const mc = sheet(CONFIG.UNIT.MOC).getDataRange().getValues();
  const moc = [];
  for (let r = timDongTieuDe_(mc, 'Mã MT') + 1; r < mc.length; r++) {
    const maMT = String(mc[r][0]).trim();
    const maCV = String(mc[r][1]).trim();
    if (!maMT || !maCV) continue;
    moc.push({
      maMT: maMT,
      maCV: maCV,
      sanPham: String(mc[r][2]).trim(),
      han: parseDate_(mc[r][3]),
      xong: String(mc[r][4]).trim() !== ''
    });
  }

  // --- Thống kê ---
  const act = goals.filter(g => g.active);
  const denHan = addDays_(today, CONFIG.SO_NGAY_DEN_HAN_DASHBOARD);
  const tk = {
    soMT: act.length,
    tre: act.filter(g => /TRỄ/i.test(g.trangThai)).length,
    canhBao: act.filter(g => /CẢNH BÁO/i.test(g.trangThai)).length,
    chuaBC: act.filter(g => !g.daBC).length,
    mocQuaHan: moc.filter(m => !m.xong && m.han && m.han < today).length,
    mocDenHan: moc.filter(m => !m.xong && m.han && m.han >= today && m.han <= denHan).length,
    vuongMac: act.filter(g => g.vuongMac).length,
    pctTB: act.length ? Math.round(act.reduce((s, g) => s + g.pctHT, 0) / act.length) : 0,
    pctTG: act.length ? Math.round(act.reduce((s, g) => s + g.pctTG, 0) / act.length) : 0
  };
  tk.mucDo = (tk.tre > 0 || tk.mocQuaHan > 0) ? 'ĐỎ'
    : (tk.canhBao > 0 || tk.chuaBC > 0) ? 'VÀNG' : 'XANH';

  return {
    dv: dv, url: ss.getUrl(), goals: goals, goalMap: goalMap, moc: moc,
    emails: docEmailChuyenVien_(ss), tk: tk
  };
}

/** Email lấy từ cột có tiêu đề chứa "Email" trong [DS_ChuyenVien] của đơn vị. */
function docEmailChuyenVien_(ss) {
  const map = {};
  const sh = ss.getSheetByName(CONFIG.UNIT.CHUYEN_VIEN);
  if (!sh) return map;
  const v = sh.getDataRange().getValues();
  const iEmail = v[0].findIndex(h => /email/i.test(String(h)));
  if (iEmail < 0) return map;
  for (let r = 1; r < v.length; r++) {
    const ten = String(v[r][0]).trim();
    const email = String(v[r][iEmail]).trim();
    if (ten && email) map[ten] = email;
  }
  return map;
}

/* ======================= GHI DASHBOARD ======================= */

function ghiDashboard_(ketQua, monday) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sapXep = ketQua.slice().sort(soSanhMucDo_);

  // --- Dashboard Toàn trường ---
  const sh = layHoacTaoSheet_(ss, CONFIG.SHEET_DASHBOARD);
  sh.clear();
  const hdr = ['Đơn vị', 'Trưởng đơn vị', 'Mức độ', 'Số MT đang theo dõi', 'MT TRỄ', 'MT CẢNH BÁO',
    'Chưa BC tuần này', 'Mốc quá hạn', 'Mốc đến hạn ' + CONFIG.SO_NGAY_DEN_HAN_DASHBOARD + ' ngày',
    'Vướng mắc chờ HT', '% hoàn thành TB', '% thời gian TB', 'Link file'];
  const tong = tongHop_(ketQua);
  sh.getRange(1, 1).setValue('DASHBOARD TIẾN ĐỘ TOÀN TRƯỜNG - TUẦN ' + fmt_(monday))
    .setFontSize(14).setFontWeight('bold').setFontColor('#1f4e79');
  sh.getRange(2, 1).setValue('Cập nhật tự động lúc ' + fmt_(new Date(), 'HH:mm dd/MM/yyyy') +
    ' | ' + ketQua.length + ' đơn vị | ' + tong.soMT + ' mục tiêu | TRỄ: ' + tong.tre +
    ' | CẢNH BÁO: ' + tong.canhBao + ' | Chưa BC: ' + tong.chuaBC +
    ' | Mốc quá hạn: ' + tong.mocQuaHan + ' | Vướng mắc chờ HT: ' + tong.vuongMac);
  sh.getRange(4, 1, 1, hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);

  const rows = sapXep.map(k => k.loi
    ? [k.dv.ten, k.dv.truong, 'LỖI', '', '', '', '', '', '', '', '', '', k.loi]
    : [k.dv.ten, k.dv.truong, k.tk.mucDo, k.tk.soMT, k.tk.tre, k.tk.canhBao, k.tk.chuaBC,
      k.tk.mocQuaHan, k.tk.mocDenHan, k.tk.vuongMac, k.tk.pctTB / 100, k.tk.pctTG / 100,
      '=HYPERLINK("' + k.url + '","Mở")']);
  if (rows.length) {
    const rg = sh.getRange(5, 1, rows.length, hdr.length);
    rg.setValues(rows);
    sh.getRange(5, 11, rows.length, 2).setNumberFormat('0%');
    rg.setBackgrounds(sapXep.map(k => Array(hdr.length).fill(mauMucDo_(k.loi ? 'LỖI' : k.tk.mucDo))));
  }
  sh.setFrozenRows(4);
  sh.setColumnWidth(1, 220);

  // --- Chi tiết mục tiêu ---
  const ct = layHoacTaoSheet_(ss, CONFIG.SHEET_CHI_TIET);
  ct.clear();
  const hdr2 = ['Đơn vị', 'Mã MT', 'Mục tiêu', 'Người thực hiện', 'Người kiểm', 'Mốc xong/tổng',
    '% hoàn thành', '% thời gian', 'Mốc quá hạn', 'Tuần liên tiếp không BC', 'Trạng thái',
    'Đã BC tuần này', 'Vướng mắc cần HT quyết'];
  ct.getRange(1, 1, 1, hdr2.length).setValues([hdr2])
    .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
  const rows2 = [];
  const mau2 = [];
  sapXep.filter(k => !k.loi).forEach(k => k.goals.filter(g => g.active).forEach(g => {
    rows2.push([k.dv.ten, g.maMT, g.ten, g.nguoiTH, g.nguoiKiem, g.tienDo, g.pctHT / 100,
      g.pctTG / 100, g.mocQuaHan, g.tuanKhongBC, g.trangThai, g.daBC ? 'Có' : 'CHƯA', g.vuongMac]);
    mau2.push(Array(hdr2.length).fill(mauTrangThai_(g.trangThai, g.daBC)));
  }));
  if (rows2.length) {
    ct.getRange(2, 1, rows2.length, hdr2.length).setValues(rows2).setBackgrounds(mau2);
    ct.getRange(2, 7, rows2.length, 2).setNumberFormat('0%');
    ct.getRange(2, 3, rows2.length, 1).setWrap(true);
  }
  ct.setFrozenRows(1);
  ct.setColumnWidth(3, 320);
  if (ct.getFilter()) ct.getFilter().remove();
  ct.getRange(1, 1, Math.max(rows2.length + 1, 2), hdr2.length).createFilter();
}

/* ========================= EMAIL ========================= */

/** Nhắc từng Người thực hiện chưa nhập báo cáo tuần, CC Người kiểm + Trưởng đơn vị. */
function guiNhacChuaBaoCao_(k, monday) {
  const ds = k.goals.filter(g => g.active && !g.daBC);
  if (!ds.length) return;
  const theoNguoi = {};
  ds.forEach(g => (theoNguoi[g.nguoiTH] = theoNguoi[g.nguoiTH] || []).push(g));

  Object.keys(theoNguoi).forEach(nguoi => {
    const list = theoNguoi[nguoi];
    const to = k.emails[nguoi] || k.dv.emailTruong;
    const cc = uniq_(list.map(g => k.emails[g.nguoiKiem])
      .concat([k.dv.emailTruong], k.dv.cc)).filter(e => e && e !== to);
    const html =
      '<p>Kính gửi Anh/Chị <b>' + esc_(nguoi) + '</b>' +
      (k.emails[nguoi] ? '' : ' (chưa có email - nhờ Trưởng đơn vị chuyển giúp)') + ',</p>' +
      '<p>Đến ' + fmt_(new Date(), 'HH:mm dd/MM/yyyy') + ', sheet <b>[Báo cáo tuần]</b> của ' +
      esc_(k.dv.ten) + ' chưa có báo cáo tuần <b>' + fmt_(monday) + '</b> cho các mục tiêu:</p>' +
      bang_(['Mã MT', 'Mục tiêu', 'Trạng thái', 'Tuần liên tiếp không BC'],
        list.map(g => [g.maMT, g.ten, g.trangThai, g.tuanKhongBC])) +
      '<p>Đề nghị cập nhật ngay: mỗi mục tiêu ghi <b>một dòng mới</b> ở cuối bảng (Tuần = ' +
      fmt_(monday) + ', Mã MT, Kết quả đã xong, Kế hoạch tuần tới, Vướng mắc, Link minh chứng).</p>' +
      '<p><a href="' + k.url + '">Mở file theo dõi của ' + esc_(k.dv.ten) + '</a></p>' + chanTrang_();
    guiMail_(to, cc, '[Nhắc nhở] Chưa nhập Báo cáo tuần ' + fmt_(monday) + ' - ' + k.dv.ten,
      html, k.dv.ten, 'Nhắc chưa BC');
  });
}

/** Email tổng hợp toàn trường cho Hiệu trưởng. */
function guiEmailHieuTruong_(ketQua, monday) {
  const tong = tongHop_(ketQua);
  const sapXep = ketQua.slice().sort(soSanhMucDo_);
  const ssUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  let html = '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    '<p>Kính gửi Thầy Hiệu trưởng,</p>' +
    '<p>Tình hình thực hiện mục tiêu học kỳ của các đơn vị, tuần <b>' + fmt_(monday) + '</b>:</p>';

  html += '<h3 style="color:#1f4e79">1. TỔNG QUAN TOÀN TRƯỜNG</h3>' +
    bang_(['Đơn vị', 'Mục tiêu', 'TRỄ', 'CẢNH BÁO', 'Chưa BC tuần', 'Mốc quá hạn', 'Vướng mắc chờ HT'],
      [[ketQua.length, tong.soMT, tong.tre, tong.canhBao, tong.chuaBC, tong.mocQuaHan, tong.vuongMac]],
      null, true);

  html += '<h3 style="color:#1f4e79">2. THEO ĐƠN VỊ</h3>' +
    bang_(['Đơn vị', 'Mức độ', 'Số MT', 'TRỄ', 'CẢNH BÁO', 'Chưa BC', 'Mốc quá hạn',
      'Vướng mắc', '% HT TB', '% TG TB'],
      sapXep.map(k => k.loi
        ? [k.dv.ten, 'LỖI: ' + k.loi, '', '', '', '', '', '', '', '']
        : [k.dv.ten, k.tk.mucDo, k.tk.soMT, k.tk.tre, k.tk.canhBao, k.tk.chuaBC,
          k.tk.mocQuaHan, k.tk.vuongMac, k.tk.pctTB + '%', k.tk.pctTG + '%']),
      sapXep.map(k => mauMucDo_(k.loi ? 'LỖI' : k.tk.mucDo)));

  // Vướng mắc chờ HT quyết
  const vm = [];
  const tre = [];
  sapXep.filter(k => !k.loi).forEach(k => k.goals.filter(g => g.active).forEach(g => {
    if (g.vuongMac) vm.push([k.dv.ten, g.maMT + ' - ' + g.ten, g.nguoiTH, g.vuongMac]);
    if (/TRỄ/i.test(g.trangThai)) {
      tre.push([k.dv.ten, g.maMT + ' - ' + g.ten, g.nguoiTH, g.pctHT + '% / ' + g.pctTG + '%', g.mocQuaHan]);
    }
  }));
  html += '<h3 style="color:#c00000">3. VƯỚNG MẮC CẦN HIỆU TRƯỞNG QUYẾT (' + vm.length + ')</h3>' +
    (vm.length ? bang_(['Đơn vị', 'Mục tiêu', 'Người thực hiện', 'Nội dung'], vm) : '<p>Không có.</p>');
  html += '<h3 style="color:#c00000">4. MỤC TIÊU TRỄ (' + tre.length + ')</h3>' +
    (tre.length ? bang_(['Đơn vị', 'Mục tiêu', 'Người thực hiện', '% HT / % TG', 'Mốc quá hạn'], tre)
      : '<p>Không có.</p>');

  const chuaBC = sapXep.filter(k => !k.loi && k.tk.chuaBC > 0);
  html += '<h3 style="color:#1f4e79">5. ĐƠN VỊ CHƯA NHẬP ĐỦ BÁO CÁO TUẦN (' + chuaBC.length + ')</h3>' +
    (chuaBC.length
      ? '<ul>' + chuaBC.map(k => '<li>' + esc_(k.dv.ten) + ': ' + k.tk.chuaBC + '/' + k.tk.soMT +
        ' mục tiêu (' + esc_(uniq_(k.goals.filter(g => g.active && !g.daBC).map(g => g.nguoiTH)).join(', ')) +
        ')</li>').join('') + '</ul><p>Đã gửi email nhắc nhở cho người thực hiện và Trưởng đơn vị.</p>'
      : '<p style="color:#006100">Tất cả đơn vị đã nhập đủ.</p>');

  html += '<p><a href="' + ssUrl + '">Mở Dashboard toàn trường</a></p>' + chanTrang_() + '</div>';
  guiMail_(CONFIG.EMAIL_HIEU_TRUONG.join(','), CONFIG.CC_HIEU_TRUONG,
    '[Dashboard toàn trường] Tuần ' + fmt_(monday) + ' - TRỄ ' + tong.tre + ', CẢNH BÁO ' +
    tong.canhBao + ', chưa BC ' + tong.chuaBC, html, 'Toàn trường', 'Dashboard HT');
}

/** Tóm tắt từng đơn vị gửi Trưởng đơn vị. */
function guiTomTatDonVi_(k, monday) {
  if (!k.dv.emailTruong) return;
  const act = k.goals.filter(g => g.active);
  const html =
    '<p>Kính gửi Anh/Chị <b>' + esc_(k.dv.truong) + '</b>,</p>' +
    '<p>Tóm tắt tiến độ <b>' + esc_(k.dv.ten) + '</b> tuần ' + fmt_(monday) +
    ' (mức độ: <b>' + k.tk.mucDo + '</b>):</p>' +
    bang_(['Mã MT', 'Mục tiêu', 'Người thực hiện', 'Mốc xong/tổng', '% HT', '% TG',
      'Trạng thái', 'Đã BC tuần'],
      act.map(g => [g.maMT, g.ten, g.nguoiTH, g.tienDo, g.pctHT + '%', g.pctTG + '%',
        g.trangThai, g.daBC ? 'Có' : 'CHƯA']),
      act.map(g => mauTrangThai_(g.trangThai, g.daBC))) +
    '<p>Mốc quá hạn: <b>' + k.tk.mocQuaHan + '</b> | Mốc đến hạn ' +
    CONFIG.SO_NGAY_DEN_HAN_DASHBOARD + ' ngày tới: <b>' + k.tk.mocDenHan + '</b></p>' +
    '<p>Mục tiêu CẢNH BÁO: Trưởng đơn vị nêu phương án khắc phục trong Báo cáo tuần.</p>' +
    '<p><a href="' + k.url + '">Mở file theo dõi</a></p>' + chanTrang_();
  guiMail_(k.dv.emailTruong, k.dv.cc, '[Tóm tắt tuần] ' + k.dv.ten + ' - ' + fmt_(monday) +
    ' - ' + k.tk.mucDo, html, k.dv.ten, 'Tóm tắt đơn vị');
}

function guiMail_(to, cc, subject, html, donVi, loai) {
  const ccList = (cc || []).filter(Boolean);
  if (!to) {
    ghiNhatKy_(loai, donVi, '', subject, 'BỎ QUA: không có email người nhận');
    return;
  }
  try {
    if (CONFIG.TEST_MODE) {
      const me = Session.getEffectiveUser().getEmail();
      MailApp.sendEmail({
        to: me,
        subject: '[TEST] ' + subject,
        htmlBody: '<p style="background:#fff2cc;padding:6px">[TEST] To: ' + esc_(to) +
          (ccList.length ? ' | CC: ' + esc_(ccList.join(', ')) : '') + '</p>' + html
      });
    } else {
      MailApp.sendEmail({ to: to, cc: ccList.join(','), subject: subject, htmlBody: html });
    }
    ghiNhatKy_(loai, donVi, to, subject, CONFIG.TEST_MODE ? 'TEST' : 'Đã gửi');
  } catch (e) {
    ghiNhatKy_(loai, donVi, to, subject, 'LỖI: ' + e.message);
  }
}

/* ========================= TIỆN ÍCH ========================= */

function tkRong_() {
  return { soMT: 0, tre: 0, canhBao: 0, chuaBC: 0, mocQuaHan: 0, mocDenHan: 0, vuongMac: 0,
    pctTB: 0, pctTG: 0, mucDo: 'LỖI' };
}

function tongHop_(ketQua) {
  const t = tkRong_();
  ketQua.forEach(k => ['soMT', 'tre', 'canhBao', 'chuaBC', 'mocQuaHan', 'mocDenHan', 'vuongMac']
    .forEach(f => (t[f] += k.tk[f] || 0)));
  return t;
}

function soSanhMucDo_(a, b) {
  const rank = { 'LỖI': 0, 'ĐỎ': 1, 'VÀNG': 2, 'XANH': 3 };
  const ra = a.loi ? 0 : rank[a.tk.mucDo];
  const rb = b.loi ? 0 : rank[b.tk.mucDo];
  return ra - rb || (b.tk.tre - a.tk.tre) || (b.tk.chuaBC - a.tk.chuaBC);
}

function mauMucDo_(m) {
  return { 'LỖI': '#d9d9d9', 'ĐỎ': '#f4cccc', 'VÀNG': '#fff2cc', 'XANH': '#d9ead3' }[m] || '#ffffff';
}

function mauTrangThai_(s, daBC) {
  if (/TRỄ|QUÁ HẠN/i.test(s)) return '#f4cccc';
  if (/CẢNH BÁO/i.test(s)) return '#fff2cc';
  if (!daBC || /CHƯA BÁO CÁO/i.test(s)) return '#fce5cd';
  return '#ffffff';
}

function ghiNhatKy_(loai, donVi, to, subject, ketQua) {
  Logger.log('[%s] %s | %s | %s | %s', loai, donVi, to, subject, ketQua);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NHAT_KY);
  if (sh) sh.appendRow([new Date(), loai, donVi, to, subject, ketQua]);
}

function layHoacTaoSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function layFileId_(s) {
  s = String(s).trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

function timDongTieuDe_(values, firstHeader) {
  const i = values.findIndex(row => row.some(c => String(c).trim() === firstHeader));
  if (i < 0) throw new Error('Không tìm thấy dòng tiêu đề "' + firstHeader + '"');
  return i;
}

/** Nhận 0.2 / 20 / "20%" -> 20 */
function toPct_(v) {
  if (typeof v === 'number') return Math.round(v <= 1 ? v * 100 : v);
  const n = parseFloat(String(v).replace('%', '').replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n);
}

function today_() {
  const [y, m, d] = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd').split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Thứ Hai của tuần hiện tại (giờ Việt Nam). */
function getCurrentMonday_() {
  const dow = Number(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'u')); // 1=T2..7=CN
  return addDays_(today_(), -(dow - 1));
}

/** Nhận Date hoặc chuỗi dd/MM/yyyy. */
function parseDate_(val) {
  if (val instanceof Date && !isNaN(val)) {
    const [y, m, d] = Utilities.formatDate(val, CONFIG.TIMEZONE, 'yyyy-MM-dd').split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const mt = String(val || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
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

function uniq_(arr) {
  return Array.from(new Set(arr));
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Bảng HTML. mauDong: mảng màu nền từng dòng (tùy chọn). canGiua: căn giữa ô. */
function bang_(hdr, rows, mauDong, canGiua) {
  const cell = (tag, c) => '<' + tag + (canGiua ? ' align="center"' : '') + '>' +
    esc_(String(c == null ? '' : c).replace(/\s*\n\s*/g, ' ')) + '</' + tag + '>';
  return '<table cellpadding="5" cellspacing="0" border="1" ' +
    'style="border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif">' +
    '<tr style="background:#1f4e79;color:#fff">' + hdr.map(h => cell('th', h)).join('') + '</tr>' +
    rows.map((r, i) => '<tr' + (mauDong ? ' style="background:' + mauDong[i] + '"' : '') + '>' +
      r.map(c => cell('td', c)).join('') + '</tr>').join('') + '</table>';
}

function chanTrang_() {
  return '<p>Trân trọng.</p><p style="color:#888;font-size:11px">Email gửi tự động từ ' +
    'Hệ thống theo dõi tiến độ - Trường ĐH Kinh tế Công nghiệp Long An.</p>';
}
