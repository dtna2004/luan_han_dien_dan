const CUSTOM_CATEGORY_VALUE = '__custom__';

async function loadCategoriesInto(selectEl) {
  try {
    const data = await api('/api/categories');
    const options = (data.categories || []).map(
      (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    );
    options.push(`<option value="${CUSTOM_CATEGORY_VALUE}">+ Thêm chuyên mục mới...</option>`);
    selectEl.innerHTML = options.join('');
  } catch (err) {
    selectEl.innerHTML = `<option value="${CUSTOM_CATEGORY_VALUE}">+ Thêm chuyên mục mới...</option>`;
  }
}

function getSelectedCategory() {
  const select = document.getElementById('category-select');
  if (select.value === CUSTOM_CATEGORY_VALUE) {
    return document.getElementById('category-custom').value.trim();
  }
  return select.value;
}

function init() {
  initHeaderAuth().then((user) => {
    if (!user) {
      document.getElementById('login-required').style.display = '';
      return;
    }
    document.getElementById('submit-card').style.display = '';

    const categorySelect = document.getElementById('category-select');
    const customRow = document.getElementById('category-custom-row');
    const customInput = document.getElementById('category-custom');

    loadCategoriesInto(categorySelect);

    categorySelect.addEventListener('change', () => {
      const isCustom = categorySelect.value === CUSTOM_CATEGORY_VALUE;
      customRow.style.display = isCustom ? '' : 'none';
      customInput.required = isCustom;
      if (isCustom) customInput.focus();
    });

    const form = document.getElementById('question-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('form-message');
      const submitBtn = form.querySelector('button[type="submit"]');

      const category = getSelectedCategory();
      if (!category) {
        msgEl.textContent = 'Vui lòng chọn hoặc nhập tên chuyên mục.';
        msgEl.className = 'form-message show error';
        return;
      }

      const payload = {
        birth_info: {
          raw: document.getElementById('birth-raw').value.trim(),
          gender: document.getElementById('gender').value,
          calendar_type: document.getElementById('calendar-type').value,
          location: document.getElementById('location').value.trim() || null,
          country: document.getElementById('country').value.trim() || null,
        },
        category,
        question: document.getElementById('question-text').value.trim(),
        options: [
          { letter: 'A', text: document.getElementById('opt-a').value.trim() },
          { letter: 'B', text: document.getElementById('opt-b').value.trim() },
          { letter: 'C', text: document.getElementById('opt-c').value.trim() },
          { letter: 'D', text: document.getElementById('opt-d').value.trim() },
        ],
        answer: document.getElementById('answer').value,
      };

      submitBtn.disabled = true;
      try {
        const res = await api('/api/questions', { method: 'POST', body: payload });
        msgEl.textContent = res.message + ` (mã: ${res.id})`;
        msgEl.className = 'form-message show success';
        form.reset();
        customRow.style.display = 'none';
        await loadCategoriesInto(categorySelect);
      } catch (err) {
        msgEl.textContent = err.message;
        msgEl.className = 'form-message show error';
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}

init();