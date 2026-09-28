/**
 * Giả lập môi trường Google Apps Script để chạy các file .gs trong Node.
 *
 *   const env = taoMoiTruong({ thuMuc, bayGio, fileTongHop, fileDonVi });
 *   env.chay('kiemTraHangTuan()');   // chạy biểu thức bất kỳ trong phạm vi script
 *   env.mail                          // danh sách email đã gửi
 *   env.fileTongHop.sheet('Nhật ký').ghi   // dữ liệu script đã ghi vào sheet
 *
 * Mỗi lần gọi taoMoiTruong tạo một phạm vi mới (vm context) nên các test độc lập với nhau.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Apps Script chạy theo múi giờ của project; đặt giống để new Date(y, m, d) cho kết quả như thật.
process.env.TZ = 'Asia/Ho_Chi_Minh';

/* ============================== SHEET & FILE ============================== */

class Sheet {
  /** giaTri: mảng 2 chiều (dữ liệu có sẵn). hienThi: mảng chữ hiển thị (mặc định tự suy ra). */
  constructor(ten, giaTri, hienThi) {
    this.ten = ten;
    this.giaTri = giaTri || [];
    this.hienThi = hienThi;
    this.ghi = [];        // các dòng script đã ghi bằng setValues / appendRow
    this.mau = [];        // màu nền script đã tô
    this.daXoa = 0;
  }
  getName() { return this.ten; }
  getSheetId() { return 1000; }
  getDataRange() {
    const giaTri = this.giaTri;
    const hienThi = this.hienThi || giaTri.map(r => r.map(hienThiO_));
    return { getValues: () => giaTri, getDisplayValues: () => hienThi };
  }
  getLastRow() { return this.giaTri.length + this.ghi.length; }
  appendRow(row) { this.ghi.push(row); }
  clear() { this.ghi = []; this.mau = []; this.daXoa++; }
  getRange() { return taoRange_(this); }
  getFilter() { return null; }
  setFrozenRows() {}
  setColumnWidth() {}
  autoResizeColumns() {}
}

/** Range: ghi nhận setValues / setBackgrounds, mọi phương thức định dạng khác trả về chính nó. */
function taoRange_(sheet) {
  let proxy;
  const goc = {
    setValues(v) { sheet.ghi.push(...v); return proxy; },
    setValue(v) { sheet.ghi.push([v]); return proxy; },
    setBackgrounds(m) { sheet.mau.push(...m); return proxy; },
    createFilter() { return {}; }
  };
  proxy = new Proxy(goc, { get: (t, k) => (k in t ? t[k] : () => proxy) });
  return proxy;
}

function hienThiO_(o) {
  if (o instanceof Date) {
    return String(o.getDate()).padStart(2, '0') + '/' + String(o.getMonth() + 1).padStart(2, '0') +
      '/' + o.getFullYear();
  }
  return o == null ? '' : String(o);
}

class Spreadsheet {
  constructor(id, sheets) {
    this.id = id;
    this.sheets = {};
    Object.keys(sheets || {}).forEach(ten => {
      const s = sheets[ten];
      this.sheets[ten] = s instanceof Sheet ? s : new Sheet(ten, s);
    });
  }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheetByName(ten) { return this.sheets[ten] || null; }
  insertSheet(ten) { return (this.sheets[ten] = new Sheet(ten, [])); }
  /** Tiện cho test: lấy sheet, tạo nếu chưa có. */
  sheet(ten) { return this.sheets[ten] || this.insertSheet(ten); }
}

/* ============================== UTILITIES ============================== */

/** Utilities.formatDate thật: định dạng theo múi giờ truyền vào (hỗ trợ các mẫu script dùng). */
function formatDate(ngay, tz, mau) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
  }).formatToParts(ngay).forEach(x => (p[x.type] = x.value));
  const thu = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return mau
    .replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
    .replace('HH', p.hour).replace('mm', p.minute).replace(/\bu\b/, String(thu));
}

/* ============================== MÔI TRƯỜNG ============================== */

/**
 * tuyChon:
 *   thuMuc       thư mục chứa các file .gs (nạp theo thứ tự tên file, như Apps Script)
 *   bayGio       Date "hiện tại" của script
 *   fileTongHop  Spreadsheet trả về bởi getActiveSpreadsheet()
 *   fileDonVi    { id: Spreadsheet } dùng cho openById(); id không có -> lỗi "không có quyền"
 */
function taoMoiTruong(tuyChon) {
  const bayGio = tuyChon.bayGio.getTime();
  const mail = [];
  const triggers = [];
  const logs = [];

  // Date trong script: new Date() không đối số trả về "bayGio"
  class NgayGia extends Date {
    constructor(...a) { if (a.length) super(...a); else super(bayGio); }
    static now() { return bayGio; }
    // Ô ngày tạo trong file test (Date thường) vẫn được script nhận là Date
    static [Symbol.hasInstance](x) { return x instanceof Date; }
  }

  const fileDonVi = tuyChon.fileDonVi || {};
  const ctx = {
    console,
    Date: NgayGia,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => tuyChon.fileTongHop,
      openById: id => {
        if (!fileDonVi[id]) throw new Error('Bạn không có quyền truy cập tài liệu ' + id);
        return fileDonVi[id];
      },
      getUi: () => ({ createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => m }; return m; } })
    },
    MailApp: { sendEmail: thu => mail.push(thu) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'toi@daihoclongan.edu.vn' }) },
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    Utilities: { formatDate },
    ScriptApp: {
      WeekDay: { MONDAY: 'MONDAY', FRIDAY: 'FRIDAY' },
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: ham => {
        const t = { ham, getHandlerFunction: () => ham };
        const b = {
          timeBased: () => b, onWeekDay: thu => ((t.thu = thu), b), atHour: gio => ((t.gio = gio), b),
          inTimezone: tz => ((t.tz = tz), b), create: () => (triggers.push(t), t)
        };
        return b;
      }
    }
  };
  vm.createContext(ctx);

  fs.readdirSync(tuyChon.thuMuc).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(tuyChon.thuMuc, f), 'utf8'), ctx, { filename: f });
  });

  return {
    ctx, mail, triggers, logs,
    fileTongHop: tuyChon.fileTongHop,
    /** Chạy biểu thức trong phạm vi script (truy cập được cả const như CONFIG). */
    chay: bieuThuc => vm.runInContext(bieuThuc, ctx),
    /** Date của script (dùng khi cần so sánh instanceof trong script). */
    ngay: (y, m, d) => new NgayGia(y, m - 1, d)
  };
}

module.exports = { taoMoiTruong, Sheet, Spreadsheet, formatDate };
