/**
 * ============================================================================
 *  HỆ THỐNG THEO DÕI TIẾN ĐỘ TOÀN TRƯỜNG
 *  Trường Đại học Kinh tế Công nghiệp Long An
 * ============================================================================
 *
 *  MÔ HÌNH
 *  - Mỗi đơn vị có 1 file Google Sheet riêng, sao từ file mẫu
 *    (TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027). Giữ nguyên tên sheet, thứ tự cột.
 *  - 1 file TỔNG HỢP chứa project Apps Script này. Script CHỈ ĐỌC file đơn vị.
 *
 *  CÁC FILE TRONG PROJECT (Apps Script dùng chung phạm vi giữa các file)
 *    00_CauHinh.gs   Cấu hình, tên sheet, vị trí cột, màu sắc       <- thường chỉ sửa file này
 *    01_ChayChinh.gs Hàm chạy chính, menu, lịch tự động, khởi tạo
 *    02_DocDuLieu.gs Đọc file đơn vị -> đối tượng "KetQuaDonVi"
 *    03_Dashboard.gs Ghi sheet Dashboard Toàn trường + Chi tiết mục tiêu
 *    04_Email.gs     Soạn và gửi email (nhắc nhở, Hiệu trưởng, Trưởng đơn vị)
 *    05_TienIch.gs   Hàm tiện ích: ngày tháng, HTML, nhật ký
 *
 *  LUỒNG XỬ LÝ THỨ HAI (kiemTraHangTuan)
 *    DS_DonVi -> đọc từng file đơn vị -> nhắc người chưa báo cáo
 *             -> ghi dashboard -> email Hiệu trưởng -> email tóm tắt Trưởng đơn vị
 *
 *  QUY ƯỚC ĐẶT TÊN
 *    - Hàm kết thúc bằng "_" là hàm nội bộ (không hiện trong danh sách chạy của Apps Script).
 *    - Tiếng Việt không dấu cho tên biến/hàm để dễ đọc với người trong trường.
 */

/* ------------------------------ CẤU HÌNH CHUNG ------------------------------ */

const CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',

  // Người nhận email tổng hợp toàn trường
  EMAIL_HIEU_TRUONG: ['hieutruong@daihoclongan.edu.vn'],
  CC_HIEU_TRUONG: [],

  // Có gửi email tóm tắt cho từng Trưởng đơn vị vào thứ Hai không
  GUI_TOM_TAT_DON_VI: true,

  // Số ngày nhìn trước khi xét mốc "sắp đến hạn"
  SO_NGAY_NHAC_TRUOC: 7,     // email nhắc thứ Sáu
  SO_NGAY_DEN_HAN: 14,       // cột "Mốc đến hạn" trên dashboard

  // Giờ chạy tự động
  GIO_KIEM_TRA_THU_HAI: 10,  // sau hạn nộp báo cáo 10h thứ Hai
  GIO_NHAC_THU_SAU: 15,

  // true: mọi email gửi về tài khoản đang chạy script, đầu email ghi người nhận thật
  TEST_MODE: true
};

/* ------------------------------ FILE TỔNG HỢP ------------------------------ */

const SHEET = {
  DS_DON_VI: 'DS_DonVi',
  DASHBOARD: 'Dashboard Toàn trường',
  CHI_TIET: 'Chi tiết mục tiêu',
  NHAT_KY: 'Nhật ký'
};

/** Vị trí cột (bắt đầu từ 0) trong sheet [DS_DonVi]. */
const COT_DON_VI = { MA: 0, TEN: 1, FILE: 2, TRUONG: 3, EMAIL_TRUONG: 4, CC: 5, THEO_DOI: 6 };

const TIEU_DE_DON_VI = [
  'Mã ĐV', 'Tên đơn vị', 'Link file theo dõi (URL hoặc ID)', 'Trưởng đơn vị',
  'Email Trưởng đơn vị', 'Email CC (cách nhau dấu phẩy)', 'Theo dõi (x)'
];

/* ------------------------------ FILE ĐƠN VỊ ------------------------------ */

const SHEET_DON_VI = {
  MUC_TIEU: 'Mục tiêu học kỳ',
  BAO_CAO: 'Báo cáo tuần',
  MOC: 'Mốc công việc',
  CHUYEN_VIEN: 'DS_ChuyenVien'
};

/**
 * Vị trí cột (bắt đầu từ 0) trong file đơn vị. Nếu file mẫu đổi cột, chỉ cần sửa ở đây.
 * TIEU_DE: chữ ở dòng tiêu đề, dùng để tìm dòng bắt đầu dữ liệu.
 */
const COT = {
  MUC_TIEU: {
    TIEU_DE: 'Mã MT',
    MA: 0, TEN: 1, NGUOI_TH: 2, NGUOI_KIEM: 3, BAT_DAU: 4, DEADLINE: 5,
    TIEN_DO: 6, PCT_HT: 7, PCT_TG: 8, MOC_QUA_HAN: 9, TUAN_KHONG_BC: 10, TRANG_THAI: 11
  },
  BAO_CAO: {
    TIEU_DE: 'Mã MT',
    TUAN: 0, MA: 1, DA_XONG: 4, MA_MOC: 5, KE_HOACH: 6, VUONG_MAC: 7
  },
  MOC: {
    TIEU_DE: 'Mã MT',
    MA_MT: 0, MA_CV: 1, SAN_PHAM: 2, HAN: 3, DA_XONG: 4
  },
  CHUYEN_VIEN: { TEN: 0 } // cột Email được tìm theo tiêu đề có chữ "Email"
};

/* ------------------------------ MỨC ĐỘ & MÀU ------------------------------ */

/** Mức độ đơn vị, xếp theo thứ tự nghiêm trọng giảm dần. */
const MUC_DO = { LOI: 'LỖI', DO: 'ĐỎ', VANG: 'VÀNG', XANH: 'XANH' };
const THU_TU_MUC_DO = [MUC_DO.LOI, MUC_DO.DO, MUC_DO.VANG, MUC_DO.XANH];

const MAU = {
  TIEU_DE: '#1f4e79',
  CHU_DO: '#c00000',
  CHU_XANH: '#006100',
  [MUC_DO.LOI]: '#d9d9d9',
  [MUC_DO.DO]: '#f4cccc',
  [MUC_DO.VANG]: '#fff2cc',
  [MUC_DO.XANH]: '#d9ead3',
  CHUA_BAO_CAO: '#fce5cd',
  TRANG: '#ffffff'
};
