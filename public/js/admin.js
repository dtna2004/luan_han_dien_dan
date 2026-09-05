const adminState = {
  status: 'pending',
  page: 1,
  limit: 20,
  search: '',
};

let editingId = null; // null => đang tạo mới

const listEl = document.getElementById('admin-list');
const paginationEl = document.getElementById('admin-pagination');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const editForm = document.getElementById('question-edit-form');
const statusField = document.getElementById('edit-status-field');
const authorField = document.getElementById('edit-author-field');

const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' };

function openModal(mode, item) {
  modalMessage.className = 'form-message';
  modalMessage.textContent = '';
  editForm.reset();
  editingId = mode === 'edit' ? item.id : null;

  modalTitle.textContent = mode === 'edit' ? `Sửa câu hỏi ${item.id}` : 'Thêm câu hỏi mới';
  statusField.style.display = mode === 'edit' ? '' : 'none';
  authorField.style.display = mode === 'edit' ? 'none' : '';

  if (mode === 'edit' && item) {
    document.getElementById('edit-birth-raw').value = (item.birth_info && item.birth_info.raw) || '';
    document.getElementById('edit-category').value = item.category || '';
    document.getElementById('edit-question').value = item.question || '';
    const opts = item.options || [];
    document.getElementById('edit-opt-a').value = (opts.find((o) => o.letter === 'A') || {}).text || '';
    document.getElementById('edit-opt-b').value = (opts.find((o) => o.letter === 'B') || {}).text || '';
    document.getElementById('edit-opt-c').value = (opts.find((o) => o.letter === 'C') || {}).text || '';
    document.getElementById('edit-opt-d').value = (opts.find((o) => o.letter === 'D') || {}).text || '';
    document.getElementById('edit-answer').value = item.answer || 'A';
    document.getElementById('edit-status').value = item.status || 'pending';
  }

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.getElementById('open-create-btn').addEventListener('click', () => {
  openModal('create', null);
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = editForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const payload = {
    birth_info: { raw: document.getElementById('edit-birth-raw').value.trim() },
    category: document.getElementById('edit-category').value.trim(),
    question: document.getElementById('edit-question').value.trim(),
    options: [
      { letter: 'A', text: document.getElementById('edit-opt-a').value.trim() },
      { letter: 'B', text: document.getElementById('edit-opt-b').value.trim() },
      { letter: 'C', text: document.getElementById('edit-opt-c').value.trim() },
      { letter: 'D', text: document.getElementById('edit-opt-d').value.trim() },
    ],
    answer: document.getElementById('edit-answer').value,
  };

  try {
    if (editingId) {
      payload.id = editingId;
      payload.status = document.getElementById('edit-status').value;
      await api('/api/admin/questions', { method: 'PUT', body: payload });
    } else {
      payload.author_name = document.getElementById('edit-author-name').value.trim() || 'Quản trị viên';
      await api('/api/admin/questions', { method: 'POST', body: payload });
    }
    closeModal();
    await loadList();
  } catch (err) {
    modalMessage.textContent = err.message;
    modalMessage.className = 'form-message show error';
  } finally {
    submitBtn.disabled = false;
  }
});

async function quickSetStatus(id, status) {
  try {
    await api('/api/admin/questions', { method: 'PUT', body: { id, status } });
    await loadList();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteItem(id) {
  if (!confirm('Xoá vĩnh viễn câu hỏi này? Toàn bộ bình luận liên quan cũng sẽ bị xoá.')) return;
  try {
    await api(`/api/admin/questions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadList();
  } catch (err) {
    alert(err.message);
  }
}

function renderItem(item) {
  const num = item.question_number ? String(item.question_number).padStart(3, '0') : '—';
  const div = document.createElement('div');
  div.className = 'admin-item';
  div.innerHTML = `
    <div class="admin-item-top">
      <div>
        <span class="case-number">${num}</span>
        <span class="case-tag">${escapeHtml(item.category || '')}</span>
        <span class="status-badge status-${item.status}">${STATUS_LABEL[item.status] || item.status}</span>
      </div>
      <div class="field-hint">Mã: ${escapeHtml(item.id)} · Tác giả: ${escapeHtml((item.author && item.author.name) || 'Vô danh khách')} · ${formatDate(item.created_at)}</div>
    </div>
    <div class="case-birth">${escapeHtml((item.birth_info && item.birth_info.raw) || '')}</div>
    <div class="case-question">${escapeHtml(item.question)}</div>
    <div class="admin-item-actions"></div>
  `;

  const actions = div.querySelector('.admin-item-actions');

  if (item.status === 'pending') {
    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn-sm btn-primary';
    approveBtn.textContent = 'Duyệt';
    approveBtn.addEventListener('click', () => quickSetStatus(item.id, 'approved'));
    actions.appendChild(approveBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn btn-sm btn-danger';
    rejectBtn.textContent = 'Từ chối';
    rejectBtn.addEventListener('click', () => quickSetStatus(item.id, 'rejected'));
    actions.appendChild(rejectBtn);
  }

  if (item.status === 'rejected') {
    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn-sm btn-primary';
    approveBtn.textContent = 'Duyệt lại';
    approveBtn.addEventListener('click', () => quickSetStatus(item.id, 'approved'));
    actions.appendChild(approveBtn);
  }

  const viewLink = document.createElement('a');
  viewLink.className = 'btn btn-sm btn-ghost';
  viewLink.href = `/cau-hoi.html?id=${encodeURIComponent(item.id)}`;
  viewLink.textContent = 'Xem trang';
  actions.appendChild(viewLink);

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-sm btn-ghost';
  editBtn.textContent = 'Sửa';
  editBtn.addEventListener('click', () => openModal('edit', item));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.textContent = 'Xoá';
  deleteBtn.addEventListener('click', () => deleteItem(item.id));
  actions.appendChild(deleteBtn);

  return div;
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  const buttons = [];
  buttons.push(`<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`);
  for (let p = 1; p <= totalPages; p++) {
    buttons.push(`<button class="${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`);
  }
  buttons.push(`<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`);
  paginationEl.innerHTML = buttons.join('');
  paginationEl.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminState.page = parseInt(btn.dataset.page, 10);
      loadList();
    });
  });
}

async function loadList() {
  listEl.innerHTML = '<div class="loading-line">Đang tải...</div>';
  const p = new URLSearchParams({
    status: adminState.status,
    page: adminState.page,
    limit: adminState.limit,
  });
  if (adminState.search) p.set('search', adminState.search);

  try {
    const data = await api(`/api/admin/questions?${p.toString()}`);
    listEl.innerHTML = '';
    if (!data.items.length) {
      listEl.innerHTML = '<div class="empty-state">Không có câu hỏi nào trong mục này.</div>';
    } else {
      data.items.forEach((item) => listEl.appendChild(renderItem(item)));
    }
    renderPagination(data.page, data.totalPages);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
  }
}

document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    adminState.status = tab.dataset.status;
    adminState.page = 1;
    loadList();
  });
});

document.getElementById('admin-search').addEventListener(
  'input',
  debounce((e) => {
    adminState.search = e.target.value.trim();
    adminState.page = 1;
    loadList();
  }, 350)
);

async function init() {
  const user = await initHeaderAuth();
  if (!user || user.role !== 'admin') {
    document.getElementById('not-admin').style.display = '';
    return;
  }
  document.getElementById('admin-area').style.display = '';
  await loadList();
}

init();
