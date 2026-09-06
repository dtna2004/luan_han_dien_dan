const usersAdminState = { page: 1, limit: 20, search: '' };

const usersListEl = document.getElementById('users-list');
const usersPaginationEl = document.getElementById('users-pagination');
const banModalOverlay = document.getElementById('ban-modal-overlay');
const banModalMessage = document.getElementById('ban-modal-message');
const banForm = document.getElementById('ban-form');

function openBanModal(userId) {
    banModalMessage.className = 'form-message';
    banModalMessage.textContent = '';
    document.getElementById('ban-user-id').value = userId;
    document.getElementById('ban-reason').value = '';
    banModalOverlay.classList.add('open');
}

function closeBanModal() {
    banModalOverlay.classList.remove('open');
}

document.getElementById('ban-modal-close').addEventListener('click', closeBanModal);
banModalOverlay.addEventListener('click', (e) => {
    if (e.target === banModalOverlay) closeBanModal();
});

banForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = banForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
        await api('/api/admin/users', {
            method: 'PUT',
            body: {
                id: document.getElementById('ban-user-id').value,
                banned: true,
                reason: document.getElementById('ban-reason').value.trim(),
            },
        });
        closeBanModal();
        await loadUsersAdmin();
    } catch (err) {
        banModalMessage.textContent = err.message;
        banModalMessage.className = 'form-message show error';
    } finally {
        submitBtn.disabled = false;
    }
});

async function unbanUser(userId) {
    if (!confirm('Mở khoá tài khoản này?')) return;
    try {
        await api('/api/admin/users', { method: 'PUT', body: { id: userId, banned: false } });
        await loadUsersAdmin();
    } catch (err) {
        alert(err.message);
    }
}

function renderUserItem(user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
    <div class="user-item-info">
      <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
      <span class="role-badge ${user.role === 'admin' ? 'admin' : ''}">${user.role === 'admin' ? 'Quản trị' : 'Thành viên'}</span>
      ${user.banned ? '<span class="banned-badge">Đã khoá</span>' : ''}
      <div class="field-hint">@${escapeHtml(user.username)} · ${escapeHtml(user.email)} · tham gia ${formatDate(user.created_at)}</div>
      ${user.banned && user.banned_reason ? `<div class="field-hint">Lý do khoá: ${escapeHtml(user.banned_reason)}</div>` : ''}
    </div>
    <div class="admin-item-actions"></div>
  `;

    const actions = div.querySelector('.admin-item-actions');

    if (user.role !== 'admin') {
        if (user.banned) {
            const unbanBtn = document.createElement('button');
            unbanBtn.className = 'btn btn-sm btn-primary';
            unbanBtn.textContent = 'Mở khoá';
            unbanBtn.addEventListener('click', () => unbanUser(user._id));
            actions.appendChild(unbanBtn);
        } else {
            const banBtn = document.createElement('button');
            banBtn.className = 'btn btn-sm btn-danger';
            banBtn.textContent = 'Khoá tài khoản';
            banBtn.addEventListener('click', () => openBanModal(user._id));
            actions.appendChild(banBtn);
        }
    }

    return div;
}

async function loadUsersAdmin() {
    usersListEl.innerHTML = '<div class="loading-line">Đang tải...</div>';
    const p = new URLSearchParams({
        page: usersAdminState.page,
        limit: usersAdminState.limit,
    });
    if (usersAdminState.search) p.set('search', usersAdminState.search);

    try {
        const data = await api(`/api/admin/users?${p.toString()}`);
        usersListEl.innerHTML = '';
        if (!data.items.length) {
            usersListEl.innerHTML = '<div class="empty-state">Không tìm thấy người dùng nào.</div>';
        } else {
            data.items.forEach((user) => usersListEl.appendChild(renderUserItem(user)));
        }
        renderPagination(usersPaginationEl, data.page, data.totalPages, (page) => {
            usersAdminState.page = page;
            loadUsersAdmin();
        });
    } catch (err) {
        usersListEl.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

document.getElementById('users-search').addEventListener(
    'input',
    debounce((e) => {
        usersAdminState.search = e.target.value.trim();
        usersAdminState.page = 1;
        loadUsersAdmin();
    }, 350)
);

function initUsersSection() {
    loadUsersAdmin();
}