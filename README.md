# CleanXLink

Extension cho trình duyệt (Chrome / Edge / Brave / Cốc Cốc / Firefox) giúp link copy từ mạng xã hội sạch và gửi đi đẹp hơn:

- **Gỡ t.co** trên x.com: copy hay bấm link đều ra thẳng link gốc.
- **Bỏ tham số theo dõi**: `?s=20&t=…` (X), `mibextid` (Facebook), `igsh` (Instagram), `utm_*`…
- **Fixups (link embed)**: đổi link bài viết khi copy để dán vào Discord / Telegram hiện preview đẹp (dùng [FxEmbed](https://github.com/FxEmbed/FxEmbed) và vxReddit):
  - `x.com/…/status/…` → `fxtwitter.com` hoặc `fixupx.com`
  - `bsky.app/profile/…/post/…` → `fxbsky.app`
  - `reddit.com/r/…/comments/…`, link chia sẻ `/s/…`, `redd.it` → `vxreddit.com`

| Thao tác | Kết quả |
|---|---|
| Chuột phải link trong tweet → *Sao chép địa chỉ liên kết* | `https://example.com/bai-viet` (không còn t.co) |
| Bấm link trong tweet | mở thẳng link gốc |
| *Chia sẻ → Sao chép liên kết* của tweet | `https://fxtwitter.com/user/status/123` |
| Ctrl+C đoạn chữ có link | t.co được thay, link bài viết được đổi sang dạng embed |

Trang cá nhân và các trang không phải bài viết được giữ nguyên. Không gửi dữ liệu đi đâu, mọi xử lý chạy trong trình duyệt.

## Cài đặt (popup)

Bấm biểu tượng CleanXLink trên thanh công cụ:

| Tuỳ chọn | Giá trị |
|---|---|
| Tên miền X | `fxtwitter.com` (mặc định), `fixupx.com`, `x.com` (giữ nguyên) |
| Kiểu embed | Đầy đủ · `d.` media trực tiếp · `g.` gallery · `t.` chỉ chữ · `m.` ghép ảnh · `i.` Telegram Instant View · `o.` Discord kiểu cũ |
| Dịch nội dung | thêm `/vi`, `/en`, `/ja` vào cuối link |
| Bluesky / Reddit | bật/tắt riêng từng trang |

Kiểu embed và dịch áp dụng cho cả X và Bluesky (Reddit không có tuỳ chọn kiểu).

## Cài extension

### Chrome, Edge, Brave, Cốc Cốc
1. Mở `chrome://extensions` (Edge: `edge://extensions`).
2. Bật **Developer mode / Chế độ nhà phát triển**.
3. **Load unpacked / Tải tiện ích đã giải nén** → chọn thư mục `D:\CleanXLink`.
4. Tải lại các tab đang mở. (Nếu đã cài bản cũ: bấm nút ⟳ Reload của extension.)

### Firefox (128+)
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → chọn `manifest.json`.

### Userscript (Tampermonkey / Violentmonkey)
Tạo script mới, dán nội dung `dist/cleanxlink.user.js`. Userscript không có popup — đổi cài đặt bằng Console (F12):
```js
localStorage.cleanxlink = JSON.stringify({ xDomain: 'fixupx.com', style: 'g', translate: 'vi' })
```
Sửa `src/cleanxlink.js` xong thì chạy `node build.mjs` để tạo lại file userscript.

## Cấu trúc
- `src/cleanxlink.js` — lõi: gỡ t.co, Fixups, làm sạch clipboard (chạy trong MAIN world).
- `src/bridge.js` — đưa cài đặt từ `chrome.storage` sang lõi.
- `popup/` — giao diện cài đặt.
- `test/test.mjs` — kiểm thử: `node test/test.mjs`.

Debug trên trang (F12 → Console): `__cleanXLink.map`, `__cleanXLink.settings()`, `__cleanXLink.cleanText("https://x.com/a/status/1?s=20")`.

## Giới hạn
- *Sao chép địa chỉ liên kết* bằng chuột phải lấy thẳng `href` nên **không** đổi sang Fixups (chỉ gỡ t.co); dùng nút *Sao chép liên kết* của trang hoặc Ctrl+C để có link embed.
- Copy từ thanh địa chỉ trình duyệt không qua extension nên không được xử lý.
- Link t.co mà X không trả kèm `expanded_url` và chữ hiển thị bị cắt (`…`) sẽ được giữ nguyên.

## Giấy phép
[MIT](LICENSE)
