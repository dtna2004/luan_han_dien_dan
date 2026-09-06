// Tiện ích dùng chung cho toàn site

async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `Lỗi ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function formatDate(value) {
  try {
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '';
  }
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const CATEGORY_LABELS = {}; // dự phòng nếu cần map nhãn tuỳ chỉnh sau này

// Ghi nhận lượt truy cập (ẩn danh, không gắn với tài khoản) - gọi 1 lần khi mỗi trang tải xong
function trackVisit() {
  fetch('/api/stats/track', { method: 'POST', credentials: 'same-origin' }).catch(() => { });
}

// Tạo các đường dẫn chia sẻ mạng xã hội cho 1 URL + tiêu đề cho trước
function buildShareLinks(url, title) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title || '');
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    zalo: `https://sp.zalo.me/share?u=${encodedUrl}&t=${encodedTitle}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
  };
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Trình duyệt cũ / không hỗ trợ clipboard API
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (e2) {
      return false;
    } finally {
      document.body.removeChild(el);
    }
  }
}

async function initHeaderAuth() {
  const slot = document.getElementById('header-auth-slot');
  if (!slot) return null;
  try {
    const { user } = await api('/api/auth/me');
    if (user) {
      slot.innerHTML = `
        <span class="user-chip">Xin chào, <strong>${escapeHtml(user.display_name || user.username)}</strong></span>
        <a class="btn btn-sm" href="/dang-bai.html">Đăng câu hỏi</a>
        ${user.role === 'admin' ? '<a class="btn btn-sm btn-ghost" href="/admin_van_han.html">Quản trị</a>' : ''}
        <button class="btn btn-sm btn-ghost" id="logout-btn">Đăng xuất</button>
      `;
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          await api('/api/auth/logout', { method: 'POST' });
          window.location.href = '/luanhan.html';
        });
      }
    } else {
      slot.innerHTML = `
        <a class="btn btn-sm btn-ghost" href="/dang-nhap.html">Đăng nhập</a>
        <a class="btn btn-sm btn-primary" href="/dang-ky.html">Đăng ký</a>
      `;
    }
    return user;
  } catch (err) {
    slot.innerHTML = `
      <a class="btn btn-sm btn-ghost" href="/dang-nhap.html">Đăng nhập</a>
      <a class="btn btn-sm btn-primary" href="/dang-ky.html">Đăng ký</a>
    `;
    return null;
  }
}

trackVisit();