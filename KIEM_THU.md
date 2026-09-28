# Kiểm thử

## 1. Kiểm thử tự động (chạy trên máy, không cần Google)

Yêu cầu Node.js 20 trở lên. Không cần cài thêm thư viện.

```
npm test
```

GitHub Actions tự chạy lệnh này mỗi lần push (file .github/workflows/test.yml).

Cách hoạt động: tests/helpers/gas-mock.js giả lập SpreadsheetApp, MailApp, Utilities
(định dạng ngày đúng múi giờ Asia/Ho_Chi_Minh), ScriptApp, Session; nạp các file .gs theo
thứ tự tên như Apps Script; dữ liệu mẫu (tests/helpers/du-lieu-mau.js) có bố cục giống file thật.

| File | Nội dung |
|---|---|
| tests/toan-truong.test.js | 24 ca: tiện ích ngày/%, quy tắc "phải báo cáo", đọc Báo cáo tuần, mức độ, sắp xếp, luồng thứ Hai, email HT, file đơn vị lỗi, TEST_MODE, thoát HTML, dashboard, nhắc thứ Sáu, trigger, khởi tạo, nhật ký |
| tests/don-vi.test.js | 8 ca: nhắc nhở, email Dashboard HT, đã báo cáo đủ, thiếu email, chạy thử, trigger, SPREADSHEET_ID, ranh giới |

Các ranh giới đã có test:
- Mục tiêu bắt đầu đúng thứ Hai: chưa phải báo cáo. Bắt đầu Chủ nhật trước đó: phải báo cáo.
- Deadline cách thứ Hai đúng 7 ngày: vẫn báo cáo. 8 ngày: thôi.
- Dòng báo cáo chỉ có mã (hoặc chỉ ghi vướng mắc): vẫn là CHƯA báo cáo.
- Mốc đến hạn đúng ngày thứ 7: có trong nhắc thứ Sáu; ngày thứ 8: không.
- Chạy lúc 0h30 thứ Hai (giờ UTC vẫn là Chủ nhật): vẫn nhận đúng tuần.

Khi sửa code: thêm/cập nhật ca kiểm thử tương ứng, chạy `npm test` trước khi push.

## 2. Kiểm thử trên Google Sheet thật (làm 1 lần trước khi dùng chính thức)

Giả lập không kiểm được quyền truy cập, giới hạn gửi mail và giao diện email thật.
Làm trên BẢN SAO file đơn vị, để TEST_MODE = true.

| # | Chuẩn bị | Thao tác | Kết quả mong đợi |
|---|---|---|---|
| 1 | File tổng hợp mới | Chạy khoiTao() | Có 4 sheet: DS_DonVi (có dòng mẫu), Dashboard Toàn trường, Chi tiết mục tiêu, Nhật ký. Menu "Theo dõi tiến độ" hiện sau khi mở lại file |
| 2 | DS_DonVi có 1 đơn vị, link đúng | Menu > Cập nhật Dashboard | Dashboard có 1 dòng, số mục tiêu khớp sheet Mục tiêu học kỳ. Không có email |
| 3 | Thêm 1 đơn vị với link sai | Cập nhật Dashboard | Dòng đó hiện LỖI (xếp đầu), Nhật ký có dòng LỖI, đơn vị kia vẫn đúng |
| 4 | Xóa 1 dòng báo cáo tuần này của 1 mục tiêu | Menu > Chạy thử | Hộp thư của bạn nhận: email [TEST][Nhắc nhở] ghi đúng To/CC; [TEST][Dashboard toàn trường]; [TEST][Tóm tắt tuần] |
| 5 | Nhập lại dòng báo cáo | Chạy thử | Không còn email nhắc cho mục tiêu đó |
| 6 | 1 người không có email trong DS_ChuyenVien | Chạy thử | Email nhắc gửi tới Trưởng đơn vị, có câu "nhờ Trưởng đơn vị chuyển giúp" |
| 7 | Ghi vướng mắc ở cột H dòng tuần này | Chạy thử | Email HT mục 3 có nội dung vướng mắc |
| 8 | Có mốc chưa xong, hạn trong 7 ngày | Chạy nhacTruocHan() | Email [TEST][Nhắc lịch] liệt kê đúng mốc |
| 9 | Mở email trên điện thoại | | Bảng hiển thị đọc được, màu đúng mức độ |
| 10 | Tài khoản chạy script | Kiểm tra quyền XEM mọi file đơn vị | Không đơn vị nào LỖI do quyền |
| 11 | Xong các bước trên | TEST_MODE = false, caiDatTrigger() | Apps Script > Trình kích hoạt có 2 lịch: thứ Hai 10h, thứ Sáu 15h |
| 12 | Thứ Hai đầu tiên sau khi bật | Xem sheet Nhật ký | Có dòng "Đã gửi" cho từng email, không có LỖI |
