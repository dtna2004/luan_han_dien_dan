const state = {
  page: 1,
  limit: 10,
  category: '',
  search: '',
};

const listEl = document.getElementById('case-list');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const categorySelect = document.getElementById('category-select');

function birthSummary(item) {
  const bi = item.birth_info || {};
  return bi.raw || '';
}

function renderList(items) {
  if (!items.length) {
    listEl.innerHTML = '<div class="empty-state">Chưa có câu hỏi nào phù hợp.</div>';
    return;
  }
  listEl.innerHTML = items
    .map((item) => {
      const num = item.question_number ? String(item.question_number).padStart(3, '0') : '—';
      return `
        <a class="case-card" href="/cau-hoi.html?id=${encodeURIComponent(item.id)}">
          <div class="case-card-top">
            <span class="case-number">${num}</span>
            <span class="case-tag">${escapeHtml(item.category || '')}</span>
          </div>
          <div class="case-birth">${escapeHtml(birthSummary(item))}</div>
          <div class="case-question">${escapeHtml(item.question)}</div>
        </a>
      `;
    })
    .join('');
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  const buttons = [];
  buttons.push(`<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`);

  const windowSize = 2;
  const pages = new Set([1, totalPages]);
  for (let p = page - windowSize; p <= page + windowSize; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) buttons.push('<span>…</span>');
    buttons.push(`<button class="${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`);
    prev = p;
  }

  buttons.push(`<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`);
  paginationEl.innerHTML = buttons.join('');

  paginationEl.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.dataset.page, 10);
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function populateCategories(categories) {
  if (!categories || !categories.length) return;
  const current = categorySelect.value;
  const options = ['<option value="">Tất cả chuyên mục</option>']
    .concat(categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
  categorySelect.innerHTML = options.join('');
  categorySelect.value = current;
}

async function load() {
  listEl.innerHTML = '<div class="loading-line">Đang tải dữ liệu...</div>';
  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
  });
  if (state.category) params.set('category', state.category);
  if (state.search) params.set('search', state.search);

  try {
    const data = await api(`/api/questions?${params.toString()}`);
    renderList(data.items);
    renderPagination(data.page, data.totalPages);
    populateCategories(data.categories);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Không tải được dữ liệu: ${escapeHtml(err.message)}</div>`;
    paginationEl.innerHTML = '';
  }
}

searchInput.addEventListener(
  'input',
  debounce((e) => {
    state.search = e.target.value.trim();
    state.page = 1;
    load();
  }, 350)
);

categorySelect.addEventListener('change', (e) => {
  state.category = e.target.value;
  state.page = 1;
  load();
});

initHeaderAuth();
load();
