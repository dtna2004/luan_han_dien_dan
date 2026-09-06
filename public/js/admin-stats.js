function renderStatCards(data) {
    const cards = [
        { label: 'Tổng lượt xem trang', value: data.site.total_visits },
        { label: 'Khách truy cập (ước tính)', value: data.site.unique_visitors },
        { label: 'Người dùng đăng ký', value: data.users.total },
        { label: 'Tài khoản bị khoá', value: data.users.banned },
        { label: 'Câu hỏi đã duyệt', value: data.questions.approved },
        { label: 'Câu hỏi chờ duyệt', value: data.questions.pending },
        { label: 'Câu hỏi bị từ chối', value: data.questions.rejected },
        { label: 'Tổng bình luận', value: data.comments_count },
    ];
    return `
    <div class="stat-grid">
      ${cards
            .map(
                (c) => `
        <div class="stat-card">
          <div class="stat-value">${c.value.toLocaleString('vi-VN')}</div>
          <div class="stat-label">${c.label}</div>
        </div>`
            )
            .join('')}
    </div>
  `;
}

function renderCategoryChart(categories) {
    if (!categories.length) {
        return '<p class="field-hint">Chưa có câu hỏi đã duyệt để thống kê chuyên mục.</p>';
    }
    const max = Math.max(...categories.map((c) => c.count), 1);
    return `
    <h3>Số câu hỏi theo chuyên mục (đã duyệt)</h3>
    <div class="bar-chart">
      ${categories
            .map(
                (c) => `
        <div class="bar-chart-row">
          <div class="bar-label" title="${escapeHtml(c.category)}">${escapeHtml(c.category)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(c.count / max) * 100}%"></div></div>
          <div class="bar-count">${c.count}</div>
        </div>`
            )
            .join('')}
    </div>
  `;
}

function renderDailyTable(daily) {
    if (!daily.length) {
        return '<p class="field-hint">Chưa có dữ liệu lượt truy cập theo ngày.</p>';
    }
    return `
    <h3>Lượt truy cập 14 ngày gần nhất</h3>
    <table class="daily-table">
      <thead>
        <tr><th>Ngày</th><th>Lượt xem</th><th>Khách mới</th></tr>
      </thead>
      <tbody>
        ${daily
            .map(
                (d) => `<tr><td>${escapeHtml(d.date)}</td><td>${d.visits}</td><td>${d.uniques}</td></tr>`
            )
            .join('')}
      </tbody>
    </table>
  `;
}

async function loadStats() {
    const container = document.getElementById('stats-content');
    container.innerHTML = '<div class="loading-line">Đang tải thống kê...</div>';
    try {
        const data = await api('/api/admin/stats');
        container.innerHTML =
            renderStatCards(data) + renderCategoryChart(data.categories) + renderDailyTable(data.daily);
    } catch (err) {
        container.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

function initStatsSection() {
    loadStats();
}