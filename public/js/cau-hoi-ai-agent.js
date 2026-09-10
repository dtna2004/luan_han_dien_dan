/**
 * cau-hoi-ai-agent.js
 * Đã được gọi sẵn từ cau-hoi.js (trong handler nút "Xem đáp án") vào
 * <div id="ai-agent-panel"></div>. File này chỉ định nghĩa window.AiAgent.showAnswer.
 * Cần load sau common.js (dùng chung hàm api()).
 */
(function () {
    const PILLAR_LABELS = ['NĂM', 'THÁNG', 'NGÀY', 'GIỜ'];

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function renderBaziTable(bazi) {
        const wrap = el('div', 'ai-bazi-table');
        const rows = [
            ['TỨ TRỤ', bazi.tuTru],
            ['CHỦ TINH', bazi.chuTinh],
            ['TÀNG ẨN', bazi.tangCan.map((a) => a.join(' · '))],
            ['PHÓ TINH', bazi.phoTinh.map((a) => a.join(' · '))],
            ['TRƯỜNG SINH', bazi.truongSinh],
            ['NẠP ÂM', bazi.napAm],
        ];

        let html = '<table class="ai-bazi-grid"><thead><tr><th></th>'
            + PILLAR_LABELS.map((l) => `<th>${l}</th>`).join('') + '</tr></thead><tbody>';
        rows.forEach(([label, values]) => {
            html += `<tr><th>${label}</th>${values.map((v) => `<td>${v}</td>`).join('')}</tr>`;
        });
        html += '</tbody></table>';

        const meta = el('div', 'ai-bazi-meta', `
      <span><b>Mệnh cung:</b> ${bazi.mệnhCung}</span>
      <span><b>Thai nguyên:</b> ${bazi.thaiNguyen}</span>
      <span><b>Niên không:</b> ${bazi.nienKhong}</span>
      <span><b>Nhật không:</b> ${bazi.nhatKhong}</span>
    `);

        wrap.innerHTML = html;
        wrap.appendChild(meta);
        return wrap;
    }

    function renderDaiVan(daiVan) {
        let html = '<div class="ai-daivan-title">Đại vận</div><table class="ai-daivan-grid"><tbody><tr>';
        daiVan.forEach((d) => {
            html += `<td><b>${d.canChi}</b><br><small>${d.tuoiBatDau}-${d.tuoiKetThuc}t</small><br><small>${d.namBatDau}</small></td>`;
        });
        html += '</tr></tbody></table>';
        return el('div', '', html);
    }

    function renderSimilarCases(list) {
        if (!list || !list.length) return el('div');
        const wrap = el('div', 'ai-similar-cases', '<div class="ai-similar-title">Case tương tự</div>');
        const ul = el('ul');
        list.forEach((c) => {
            ul.appendChild(el('li', '', `#${c.question_number} — ${c.question} <small>(độ tương đồng ${(c.score * 100).toFixed(0)}%)</small>`));
        });
        wrap.appendChild(ul);
        return wrap;
    }

    async function showAnswer(caseId, container) {
        if (!container) return;
        container.innerHTML = '<div class="ai-loading">Đang tính Bát Tự & luận giải, vui lòng chờ...</div>';
        try {
            const data = await api(`/api/agent/${encodeURIComponent(caseId)}`);

            container.innerHTML = '';
            container.appendChild(el('div', 'ai-answer-header', `Đáp án đúng: <b>${data.answer}</b>`));
            container.appendChild(el('div', 'ai-cache-badge', data.fromCache
                ? 'LÁ SỐ BÁT TỰ GIẢI NHƯ SAU: '
                : 'Bạn đã mở khóa giải thích: '));
            container.appendChild(renderBaziTable(data.bazi));
            container.appendChild(renderDaiVan(data.bazi.daiVan));
            container.appendChild(el('div', 'ai-explanation-title', 'Luận giải'));
            container.appendChild(el('div', 'ai-explanation-text', data.explanation.replace(/\n/g, '<br>')));
            container.appendChild(renderSimilarCases(data.similarCases));
        } catch (err) {
            container.innerHTML = `<div class="ai-error">Không tải được luận giải AI: ${err.message}</div>`;
        }
    }

    window.AiAgent = { showAnswer };
})();