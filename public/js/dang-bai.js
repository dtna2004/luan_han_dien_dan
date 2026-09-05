async function init() {
  const user = await initHeaderAuth();
  if (!user) {
    document.getElementById('login-required').style.display = '';
    return;
  }
  document.getElementById('submit-card').style.display = '';

  const form = document.getElementById('question-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('form-message');
    const submitBtn = form.querySelector('button[type="submit"]');

    const payload = {
      birth_info: {
        raw: document.getElementById('birth-raw').value.trim(),
        gender: document.getElementById('gender').value,
        calendar_type: document.getElementById('calendar-type').value,
        location: document.getElementById('location').value.trim() || null,
        country: document.getElementById('country').value.trim() || null,
      },
      category: document.getElementById('category').value.trim(),
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
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-message show error';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

init();
