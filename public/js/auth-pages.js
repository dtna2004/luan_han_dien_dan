function showMessage(text, type) {
  const el = document.getElementById('form-message');
  el.textContent = text;
  el.className = `form-message show ${type}`;
}

function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  window.location.href = redirect ? decodeURIComponent(redirect) : '/luanhan.html';
}

function initLoginPage() {
  initHeaderAuth();
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await api('/api/auth/login', { method: 'POST', body: { identifier, password } });
      showMessage('Đăng nhập thành công, đang chuyển hướng...', 'success');
      setTimeout(redirectAfterAuth, 500);
    } catch (err) {
      showMessage(err.message, 'error');
      submitBtn.disabled = false;
    }
  });
}

function initRegisterPage() {
  initHeaderAuth();
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await api('/api/auth/register', { method: 'POST', body: { username, email, password } });
      showMessage('Tạo tài khoản thành công, đang chuyển hướng...', 'success');
      setTimeout(redirectAfterAuth, 500);
    } catch (err) {
      showMessage(err.message, 'error');
      submitBtn.disabled = false;
    }
  });
}
