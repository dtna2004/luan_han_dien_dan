const questionArea = document.getElementById('question-area');
const commentsSection = document.getElementById('comments-section');
const commentFormSlot = document.getElementById('comment-form-slot');
const commentListEl = document.getElementById('comment-list');

const params = new URLSearchParams(window.location.search);
const questionId = params.get('id');

let currentUser = null;
let currentQuestion = null;

const STATUS_LABEL = {
  pending: 'Đang chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

function renderBirthInfo(bi) {
  if (!bi) return '';
  const bits = [];
  if (bi.raw) bits.push(bi.raw);
  return bits.join(' ');
}

function renderQuestion(item) {
  const num = item.question_number ? String(item.question_number).padStart(3, '0') : '—';
  const statusBadge =
    item.status && item.status !== 'approved'
      ? `<span class="status-badge status-${item.status}">${STATUS_LABEL[item.status] || item.status}</span>`
      : '';

  const optionsHtml = item.options
    .map(
      (o) => `
      <div class="option-row" data-letter="${o.letter}">
        <span class="option-letter">${o.letter}.</span>
        <span>${escapeHtml(o.text)}</span>
      </div>`
    )
    .join('');

  questionArea.innerHTML = `
    <div class="case-header">
      <div class="case-meta-row">
        <span class="case-number">${num}</span>
        <span class="case-tag">${escapeHtml(item.category || '')}</span>
        ${statusBadge}
      </div>
      <div class="birth-info-box">${escapeHtml(renderBirthInfo(item.birth_info))}</div>
    </div>

    <div class="question-text">${escapeHtml(item.question)}</div>
    <div class="options-list">${optionsHtml}</div>

    <div class="reveal-box">
      <button class="btn btn-primary" id="reveal-btn">Xem đáp án</button>
    </div>

    <div class="author-line">Tác giả: ${escapeHtml((item.author && item.author.name) || 'Vô danh khách')}${item.created_at ? ' · ' + formatDate(item.created_at) : ''}</div>
  `;

  document.getElementById('reveal-btn').addEventListener('click', () => {
    const row = questionArea.querySelector(`.option-row[data-letter="${item.answer}"]`);
    if (row) row.classList.add('is-answer');
    document.getElementById('reveal-btn').outerHTML = `<div><strong>Đáp án: ${item.answer}</strong></div>`;
  });
}

function renderCommentForm(parentId, container, onDone) {
  const wrapper = document.createElement('div');
  wrapper.className = parentId ? 'reply-form' : 'comment-form';

  if (!currentUser) {
    wrapper.innerHTML = `<p class="field-hint">Vui lòng <a href="/dang-nhap.html">đăng nhập</a> để bình luận.</p>`;
    container.appendChild(wrapper);
    return;
  }

  wrapper.innerHTML = `
    <textarea placeholder="${parentId ? 'Viết trả lời...' : 'Viết bình luận của bạn...'}"></textarea>
    <div class="comment-form-actions">
      ${parentId ? '<button class="btn btn-sm btn-ghost" data-cancel>Huỷ</button>' : ''}
      <button class="btn btn-sm btn-primary" data-submit>Gửi</button>
    </div>
  `;
  container.appendChild(wrapper);

  const textarea = wrapper.querySelector('textarea');
  const submitBtn = wrapper.querySelector('[data-submit]');
  const cancelBtn = wrapper.querySelector('[data-cancel]');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => wrapper.remove());
  }

  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) return;
    submitBtn.disabled = true;
    try {
      await api('/api/comments', {
        method: 'POST',
        body: { question_id: questionId, content, parent_id: parentId || undefined },
      });
      textarea.value = '';
      if (parentId) wrapper.remove();
      await loadComments();
      if (onDone) onDone();
    } catch (err) {
      alert(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function buildTree(comments) {
  const byId = new Map();
  comments.forEach((c) => byId.set(c._id, { ...c, children: [] }));
  const roots = [];
  byId.forEach((c) => {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).children.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

function renderComment(comment, depth) {
  const el = document.createElement('div');
  el.className = 'comment';
  const canDelete = currentUser && (currentUser.username === comment.author_name || currentUser.role === 'admin');

  el.innerHTML = `
    <div class="comment-head">
      <span class="comment-author">${escapeHtml(comment.author_name)}</span>
      <span class="comment-time">${formatDate(comment.created_at)}</span>
    </div>
    <div class="comment-body">${escapeHtml(comment.content)}</div>
    <div class="comment-actions">
      ${currentUser ? '<button data-reply>Trả lời</button>' : ''}
      ${canDelete ? '<button data-delete>Xoá</button>' : ''}
    </div>
    <div class="reply-slot"></div>
    <div class="comment-replies"></div>
  `;

  const replySlot = el.querySelector('.reply-slot');
  const replyBtn = el.querySelector('[data-reply]');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      if (replySlot.childElementCount) {
        replySlot.innerHTML = '';
        return;
      }
      renderCommentForm(comment._id, replySlot);
    });
  }

  const deleteBtn = el.querySelector('[data-delete]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Xoá bình luận này (và các trả lời trực tiếp)?')) return;
      try {
        await api(`/api/comments?id=${encodeURIComponent(comment._id)}`, { method: 'DELETE' });
        await loadComments();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const repliesEl = el.querySelector('.comment-replies');
  if (comment.children && comment.children.length) {
    comment.children.forEach((child) => repliesEl.appendChild(renderComment(child, depth + 1)));
  }

  return el;
}

async function loadComments() {
  try {
    const data = await api(`/api/comments?question_id=${encodeURIComponent(questionId)}`);
    const tree = buildTree(data.items);
    commentListEl.innerHTML = '';
    if (!tree.length) {
      commentListEl.innerHTML = '<p class="field-hint">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ góc nhìn của bạn.</p>';
      return;
    }
    tree.forEach((c) => commentListEl.appendChild(renderComment(c, 0)));
  } catch (err) {
    commentListEl.innerHTML = `<p class="field-hint">Không tải được bình luận: ${escapeHtml(err.message)}</p>`;
  }
}

async function init() {
  if (!questionId) {
    questionArea.innerHTML = '<div class="empty-state">Thiếu mã câu hỏi.</div>';
    return;
  }
  currentUser = await initHeaderAuth();
  try {
    const data = await api(`/api/questions/${encodeURIComponent(questionId)}`);
    currentQuestion = data.item;
    renderQuestion(currentQuestion);
    commentsSection.style.display = '';
    commentFormSlot.innerHTML = '';
    renderCommentForm(null, commentFormSlot);
    await loadComments();
  } catch (err) {
    questionArea.innerHTML = `<div class="empty-state">Không tìm thấy câu hỏi này: ${escapeHtml(err.message)}</div>`;
  }
}

init();
