const commentsAdminState = { page: 1, limit: 20, search: '' };

const commentsListEl = document.getElementById('comments-list');
const commentsPaginationEl = document.getElementById('comments-pagination');

function renderCommentAdminItem(item) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    const q = item.question || {};
    const qLabel = q.question_number
        ? `#${String(q.question_number).padStart(3, '0')} — ${q.question || ''}`
        : item.question_id;

    div.innerHTML = `
    <div class="admin-item-top">
      <div>
        <span class="comment-author">${escapeHtml(item.author_name)}</span>
        ${item.parent_id ? '<span class="field-hint">(trả lời một bình luận khác)</span>' : ''}
      </div>
      <div class="field-hint">${formatDate(item.created_at)}</div>
    </div>
    <div class="comment-body">${escapeHtml(item.content)}</div>
    <div class="field-hint">Thuộc câu hỏi: <a href="/cau-hoi.html?id=${encodeURIComponent(item.question_id)}" target="_blank">${escapeHtml(qLabel)}</a></div>
    <div class="admin-item-actions"></div>
  `;

    const actions = div.querySelector('.admin-item-actions');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.textContent = 'Xoá';
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Xoá bình luận này (và các trả lời trực tiếp của nó)?')) return;
        try {
            await api(`/api/comments?id=${encodeURIComponent(item._id)}`, { method: 'DELETE' });
            await loadCommentsAdmin();
        } catch (err) {
            alert(err.message);
        }
    });
    actions.appendChild(deleteBtn);

    return div;
}

async function loadCommentsAdmin() {
    commentsListEl.innerHTML = '<div class="loading-line">Đang tải...</div>';
    const p = new URLSearchParams({
        page: commentsAdminState.page,
        limit: commentsAdminState.limit,
    });
    if (commentsAdminState.search) p.set('search', commentsAdminState.search);

    try {
        const data = await api(`/api/admin/comments?${p.toString()}`);
        commentsListEl.innerHTML = '';
        if (!data.items.length) {
            commentsListEl.innerHTML = '<div class="empty-state">Chưa có bình luận nào.</div>';
        } else {
            data.items.forEach((item) => commentsListEl.appendChild(renderCommentAdminItem(item)));
        }
        renderPagination(commentsPaginationEl, data.page, data.totalPages, (page) => {
            commentsAdminState.page = page;
            loadCommentsAdmin();
        });
    } catch (err) {
        commentsListEl.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

document.getElementById('comments-search').addEventListener(
    'input',
    debounce((e) => {
        commentsAdminState.search = e.target.value.trim();
        commentsAdminState.page = 1;
        loadCommentsAdmin();
    }, 350)
);

function initCommentsSection() {
    loadCommentsAdmin();
}