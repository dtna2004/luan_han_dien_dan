function optionsHtml(models, selected) {
    return models
        .map((m) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${escapeHtml(m.label)}</option>`)
        .join('');
}

// ---------- Mục "AI Agent": cấu hình model dùng chung cho cả site ----------
async function loadAgentSettings() {
    const container = document.getElementById('agent-settings-content');
    container.innerHTML = '<div class="loading-line">Đang tải cấu hình...</div>';
    try {
        const data = await api('/api/admin/agent?action=settings');
        const { settings, availableModels } = data;

        container.innerHTML = `
      <div class="field">
        <label>Model trích xuất thông tin sinh (đọc raw text → ngày giờ sinh)</label>
        <select id="agent-model-extract">${optionsHtml(availableModels.extract, settings.modelExtract)}</select>
      </div>
      <div class="field">
        <label>Model luận giải đáp án</label>
        <select id="agent-model-explain">${optionsHtml(availableModels.explain, settings.modelExplain)}</select>
      </div>
      <div class="field">
        <label>Model embedding (tìm case tương tự)</label>
        <select id="agent-model-embedding">${optionsHtml(availableModels.embedding, settings.modelEmbedding)}</select>
      </div>
      <button class="btn btn-primary" id="agent-settings-save">Lưu cấu hình</button>
      <div class="form-message" id="agent-settings-msg"></div>
      <h3>Tình trạng xoay vòng API key</h3>
      <div id="agent-key-usage" class="field-hint">Đang tải...</div>
    `;

        document.getElementById('agent-settings-save').addEventListener('click', async () => {
            const msg = document.getElementById('agent-settings-msg');
            try {
                await api('/api/admin/agent?action=settings', {
                    method: 'PUT',
                    body: {
                        modelExtract: document.getElementById('agent-model-extract').value,
                        modelExplain: document.getElementById('agent-model-explain').value,
                        modelEmbedding: document.getElementById('agent-model-embedding').value,
                    },
                });
                msg.textContent = 'Đã lưu cấu hình.';
                msg.className = 'form-message show';
            } catch (err) {
                msg.textContent = err.message;
                msg.className = 'form-message show error';
            }
        });

        const usage = await api('/api/admin/agent?action=key-usage');
        document.getElementById('agent-key-usage').textContent =
            `Số API key đang cấu hình: ${usage.totalKeys} — tổng số lượt gọi đã xoay: ${usage.totalCallsSoFar} (key kế tiếp: #${usage.lastIndex ?? 0})`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

function initSettingsSection() {
    loadAgentSettings();
}

// ---------- Modal xem/sửa/regenerate luận giải AI cho 1 câu hỏi ----------
const agentModalOverlay = document.getElementById('agent-modal-overlay');
const agentModalContent = document.getElementById('agent-modal-content');

function renderBaziPreview(bazi) {
    const pillars = ['Năm', 'Tháng', 'Ngày', 'Giờ'];
    const rows = [
        ['Tứ Trụ', bazi.tuTru],
        ['Chủ tinh', bazi.chuTinh],
        ['Tàng ẩn', bazi.tangCan.map((a) => a.join(' · '))],
        ['Phó tinh', bazi.phoTinh.map((a) => a.join(' · '))],
        ['Trường sinh', bazi.truongSinh],
        ['Nạp âm', bazi.napAm],
    ];
    let html = '<table class="ai-bazi-grid"><thead><tr><th></th>' +
        pillars.map((p) => `<th>${p}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(([label, values]) => {
        html += `<tr><th>${label}</th>${values.map((v) => `<td>${v}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table>';
    html += `<div class="ai-bazi-meta">
      <span><b>Mệnh cung:</b> ${bazi.mệnhCung}</span>
      <span><b>Thai nguyên:</b> ${bazi.thaiNguyen}</span>
      <span><b>Niên không:</b> ${bazi.nienKhong}</span>
      <span><b>Nhật không:</b> ${bazi.nhatKhong}</span>
    </div>`;
    return html;
}

async function openCaseModal(caseId) {
    agentModalOverlay.classList.add('open');
    agentModalContent.innerHTML = '<div class="loading-line">Đang tải...</div>';
    try {
        const data = await api(`/api/agent/${encodeURIComponent(caseId)}`);
        agentModalContent.innerHTML = `
      <div class="field-hint">${data.fromCache ? 'Đã tính sẵn (đang xem bản lưu)' : 'Vừa tính mới'} — model: trích xuất ${escapeHtml((data.meta && data.meta.modelExtract) || '?')}, luận giải ${escapeHtml((data.meta && data.meta.modelExplain) || '?')}</div>
      ${renderBaziPreview(data.bazi)}
      <div class="field">
        <label>Luận giải (sửa được)</label>
        <textarea id="agent-explanation-edit" rows="8">${escapeHtml(data.explanation)}</textarea>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-primary" id="agent-save-explanation">Lưu luận giải đã sửa</button>
        <button class="btn btn-ghost" id="agent-regenerate">Tính lại toàn bộ (gọi AI mới)</button>
      </div>
      <div class="form-message" id="agent-case-msg"></div>
    `;

        document.getElementById('agent-save-explanation').addEventListener('click', async () => {
            const msg = document.getElementById('agent-case-msg');
            try {
                await api(`/api/admin/agent?action=case&id=${encodeURIComponent(caseId)}`, {
                    method: 'PUT',
                    body: { ai_explanation: document.getElementById('agent-explanation-edit').value },
                });
                msg.textContent = 'Đã lưu.';
                msg.className = 'form-message show';
            } catch (err) {
                msg.textContent = err.message;
                msg.className = 'form-message show error';
            }
        });

        document.getElementById('agent-regenerate').addEventListener('click', async () => {
            const msg = document.getElementById('agent-case-msg');
            msg.textContent = 'Đang tính lại, vui lòng chờ...';
            msg.className = 'form-message show';
            try {
                await api(`/api/admin/agent?action=regenerate&id=${encodeURIComponent(caseId)}`, {
                    method: 'POST',
                    body: {},
                });
                openCaseModal(caseId);
            } catch (err) {
                msg.textContent = err.message;
                msg.className = 'form-message show error';
            }
        });
    } catch (err) {
        agentModalContent.innerHTML = `<div class="empty-state">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

document.getElementById('agent-modal-close').addEventListener('click', () => {
    agentModalOverlay.classList.remove('open');
});
agentModalOverlay.addEventListener('click', (e) => {
    if (e.target === agentModalOverlay) agentModalOverlay.classList.remove('open');
});

window.AdminAgent = { initSettingsSection, openCaseModal };