# Luận Hạn — Ngân hàng câu hỏi luận đoán Tứ Trụ

Ứng dụng web tĩnh (HTML/CSS/JS) + API serverless (Node.js) chạy trên Vercel,
dữ liệu lưu ở MongoDB (database `tuvi_cache`).

## Cấu trúc

```
public/                 -> các trang tĩnh (HTML/CSS/JS phía client)
  luanhan.html           danh sách câu hỏi (tìm kiếm, lọc, phân trang)
  cau-hoi.html           trang chi tiết 1 câu hỏi + bình luận (dùng ?id=...)
  dang-bai.html          form đăng câu hỏi mới (yêu cầu đăng nhập)
  dang-nhap.html / dang-ky.html
  admin_van_han.html     trang quản trị: duyệt / sửa / xoá / thêm câu hỏi
api/                    -> serverless functions (Vercel tự động deploy)
  auth/{register,login,logout,me}.js
  questions/{index,[id]}.js
  admin/questions.js
  comments/index.js
lib/                    -> kết nối MongoDB + xử lý auth (JWT, cookie, hash mật khẩu)
scripts/seed.js         -> script nạp dữ liệu mẫu (12 câu hỏi bạn cung cấp) vào MongoDB
data/van_han_seed.json  -> dữ liệu mẫu, tác giả sẽ được ghi là "Vô danh khách"
```

## Mô hình dữ liệu (MongoDB, db `tuvi_cache`)

- **van_han**: mỗi document là 1 câu hỏi, thêm các trường so với JSON gốc:
  - `status`: `pending` | `approved` | `rejected`
  - `author`: `{ user_id, name }` — dữ liệu seed ban đầu ghi `"Vô danh khách"`,
    câu người dùng đăng sau khi được duyệt ghi đúng tên tài khoản đã đăng.
  - `submitted_by`, `created_at`, `updated_at`, `reviewed_by`, `reviewed_at`
  - Chỉ câu có `status = "approved"` mới hiển thị công khai trên `luanhan.html`.
- **users**: `username, display_name, email, password_hash, role (user/admin), created_at`
- **comments**: `question_id, user_id, author_name, content, parent_id (để trả lời lồng nhau), created_at`

## Biến môi trường cần cấu hình

Xem `.env.example`:

- `MONGODB_URI` — bạn đã có sẵn.
- `MONGODB_DB` — mặc định `tuvi_cache`.
- `JWT_SECRET` — đổi thành chuỗi ngẫu nhiên dài, giữ bí mật (dùng để ký cookie đăng nhập).
- `ADMIN_EMAILS` — danh sách email (cách nhau bởi dấu phẩy) sẽ tự động có quyền
  admin ngay khi đăng ký/đăng nhập. Đây là cách đơn giản nhất để bạn tạo tài
  khoản admin đầu tiên: thêm email của bạn vào biến này trước khi đăng ký.

## Chạy & seed dữ liệu mẫu

```bash
npm install
cp .env.example .env   # rồi điền MONGODB_URI, JWT_SECRET, ADMIN_EMAILS thật
npm run seed            # nạp 12 câu hỏi mẫu vào collection van_han (status=approved, tác giả "Vô danh khách")
```

Chạy thử toàn bộ (API + static) trên máy giống môi trường Vercel:

```bash
npm install -g vercel
vercel dev
```

(Local chạy bằng `node` thuần sẽ không có `req.query`/`req.body` tự
parse — hai thứ này do runtime của Vercel cung cấp, nên khuyến khích dùng
`vercel dev` để test thay vì tự viết server Express.)

## Deploy lên Vercel

1. Đẩy thư mục này lên một Git repo (GitHub/GitLab...).
2. Vào Vercel → New Project → import repo.
3. Ở phần Environment Variables, thêm `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`,
   `ADMIN_EMAILS` giống như trong `.env`.
4. Deploy. Vercel tự nhận `public/` làm static site và mỗi file trong `api/`
   thành 1 serverless function.
5. Sau khi deploy, chạy `npm run seed` một lần từ máy local (script chỉ cần
   `MONGODB_URI` trỏ đúng cluster, không cần chạy trên Vercel) để nạp dữ liệu mẫu.
6. Đăng ký một tài khoản bằng email nằm trong `ADMIN_EMAILS` → tài khoản đó tự
   động có quyền vào `/admin_van_han.html`.

## Luồng hoạt động chính

- Khách vãng lai: xem `luanhan.html`, bấm vào 1 câu để sang `cau-hoi.html?id=...`,
  xem đáp án, đọc bình luận — không cần đăng nhập.
- Đăng ký/đăng nhập (`dang-ky.html`, `dang-nhap.html`) để: đăng câu hỏi mới
  (`dang-bai.html`), viết bình luận, trả lời bình luận của người khác.
- Câu hỏi người dùng gửi lên có `status = "pending"`, **chưa hiển thị công khai**
  cho đến khi admin duyệt tại `admin_van_han.html` (tab "Chờ duyệt" → Duyệt/Từ
  chối, hoặc bấm "Sửa" để chỉnh nội dung trước khi duyệt). Khi duyệt xong, câu
  hỏi tự động được cấp `question_number` kế tiếp và hiển thị ngay trên
  `luanhan.html`, ghi đúng tên người đã đăng làm tác giả.
- Admin cũng có thể tự thêm/sửa/xoá bất kỳ câu hỏi nào (kể cả tạo mới, duyệt
  luôn) ngay trong trang quản trị.
