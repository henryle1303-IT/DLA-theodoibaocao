# Hệ thống theo dõi tiến độ toàn trường (Google Sheets + Apps Script)

## 1. Mô hình

```
File mẫu (TrienKhaiThucHien_QLKH-DBCL_HK1_2026-2027)
   │ copy cho mỗi đơn vị
   ▼
File đơn vị 1   File đơn vị 2   ...   File đơn vị N      <- đơn vị tự nhập
(Mục tiêu học kỳ, Mốc công việc, Báo cáo tuần, DS_ChuyenVien)
   │  script đọc (chỉ đọc, không sửa file đơn vị)
   ▼
FILE TỔNG HỢP TOÀN TRƯỜNG (chứa Code.gs)
   ├─ DS_DonVi               nhập tay: đơn vị, link file, trưởng đơn vị, email
   ├─ Dashboard Toàn trường  tự ghi: mỗi đơn vị 1 dòng, tô màu ĐỎ/VÀNG/XANH
   ├─ Chi tiết mục tiêu      tự ghi: mọi mục tiêu của mọi đơn vị (có bộ lọc)
   └─ Nhật ký                tự ghi: email đã gửi, lỗi đọc file
```

Mỗi đơn vị giữ nguyên cách làm hiện tại. Hiệu trưởng chỉ xem 1 file / 1 email.

## 2. Lịch tự động

| Thời điểm | Hàm | Việc |
|---|---|---|
| Thứ Sáu 15h | nhacTruocHan | Nhắc từng người: mốc chưa xong đến hạn trong 7 ngày + hạn nộp Báo cáo tuần 10h thứ Hai |
| Thứ Hai 10h | kiemTraHangTuan | 1) Nhắc người chưa nhập Báo cáo tuần (CC Người kiểm + Trưởng đơn vị) 2) Cập nhật Dashboard 3) Email Hiệu trưởng 4) Email tóm tắt cho Trưởng đơn vị |

## 3. Quy tắc tính

- Mục tiêu cần báo cáo tuần T (thứ Hai): đã bắt đầu trước T và deadline chưa quá 7 ngày trước T.
- Đã báo cáo: sheet Báo cáo tuần có dòng Tuần = T, đúng Mã MT, và có nội dung ở cột E, F hoặc G.
- Trạng thái mục tiêu (TRỄ/CẢNH BÁO...): lấy từ cột Trạng thái của file đơn vị (công thức sẵn có).
- Mốc quá hạn: mốc chưa đánh dấu x và hạn < hôm nay.
- Vướng mắc chờ HT: cột H Báo cáo tuần của tuần T (khác rỗng và khác "-").
- Mức độ đơn vị: ĐỎ = có MT TRỄ hoặc mốc quá hạn; VÀNG = có CẢNH BÁO hoặc chưa báo cáo; XANH = còn lại.

## 4. Email Hiệu trưởng gồm

1. Tổng quan toàn trường (số đơn vị, mục tiêu, TRỄ, CẢNH BÁO, chưa BC, mốc quá hạn, vướng mắc)
2. Bảng theo đơn vị, xếp đơn vị nặng nhất lên đầu
3. Vướng mắc cần Hiệu trưởng quyết
4. Danh sách mục tiêu TRỄ
5. Đơn vị/người chưa nhập báo cáo tuần

## 5. Triển khai

1. Chuẩn hóa file mẫu: sheet DS_ChuyenVien thêm cột C "Email". Khóa (Protect) các cột công thức.
2. Mỗi đơn vị: tạo bản sao file mẫu, xóa dữ liệu, nhập mục tiêu học kỳ và mốc công việc.
   KHÔNG đổi tên sheet, KHÔNG chèn/xóa cột.
3. Chia sẻ quyền XEM mọi file đơn vị cho tài khoản sẽ chạy script (ví dụ tài khoản Phòng TCHC).
4. Tạo Google Sheet mới "TONG HOP TIEN DO TOAN TRUONG", vào Tiện ích mở rộng > Apps Script,
   dán Code.gs (và appsscript.json nếu bật hiển thị manifest).
5. Chạy khoiTao() -> điền sheet DS_DonVi (cột G ghi x để theo dõi).
6. Sửa CONFIG: EMAIL_HIEU_TRUONG, CC_HIEU_TRUONG.
7. Để TEST_MODE = true, chạy menu "Theo dõi tiến độ" > Chạy kiểm tra thứ Hai: mọi email về chính mình.
8. Kiểm tra xong: TEST_MODE = false, chạy caiDatTrigger() một lần.

## 6. Giới hạn

- Gửi mail: tài khoản Workspace khoảng 1.500 người nhận/ngày - đủ cho vài chục đơn vị.
- Thời gian chạy tối đa 6 phút/lần: đọc được khoảng 50-80 file đơn vị.
- Không có thông báo tức thì trên điện thoại (chỉ email).
