/**
 * explainAnswer.js
 * LLM chỉ dùng lá số Bát Tự ĐÃ TÍNH SẴN (từ baziEngine, không tự tính lại)
 * để viết lời luận giải tại sao đáp án đúng lại đúng.
 */

const { generateContent } = require('./geminiClient');
const { getSettings } = require('./modelRegistry');

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia luận giải Bát Tự (Tứ Trụ) người Việt, văn phong rõ ràng, không mê tín thái quá, bám sát dữ liệu lá số được cung cấp.
Bạn sẽ nhận: lá số Bát Tự đã tính sẵn (Tứ Trụ, Tàng Can, Phó Tinh/Thập Thần, Trường Sinh, Nạp Âm, Đại Vận, Lưu Niên, Mệnh Cung...), một câu hỏi trắc nghiệm về vận hạn của lá số đó, và đáp án đúng.
Nhiệm vụ: viết đoạn luận giải TIẾNG VIỆT giải thích vì sao đáp án đúng lại hợp lý dựa trên lá số — cụ thể là dựa vào Đại Vận/Lưu Niên đang đi qua năm được hỏi, Thập Thần/Ngũ hành nổi bật trong giai đoạn đó, quan hệ Hình-Xung-Khắc-Hợp nếu có.
Không bịa thêm dữ kiện ngoài lá số đã cho. Nếu dữ liệu không đủ để khẳng định chắc chắn, hãy nói rõ đây là suy luận có tính tham khảo.
Trả lời khoảng 150-250 chữ, không lặp lại nguyên văn câu hỏi/đáp án.`;

/**
 * @param {import('mongodb').Db} db
 * @param {{ bazi:object, question:string, options:Array, answer:string, category?:string, similarCases?:Array, modelOverride?:string }} params
 */
async function generate(db, { bazi, question, options, answer, category, similarCases = [], modelOverride }) {
    const settings = await getSettings(db);
    const model = modelOverride || settings.modelExplain;

    const answerText = (options || []).find((o) => o.letter === answer)?.text || '';
    const similarText = similarCases.length
        ? `\n\nMột số case tương tự trong ngân hàng câu hỏi (chỉ để tham khảo văn phong lập luận, không copy nguyên văn):\n${similarCases.map((c) => `- [${c.question_number}] ${c.question}`).join('\n')
        }`
        : '';

    const prompt = `Lá số Bát Tự (JSON):\n${JSON.stringify(bazi, null, 2)}

Chủ đề câu hỏi: ${category || 'không rõ'}
Câu hỏi: ${question}
Các lựa chọn: ${(options || []).map((o) => `${o.letter}. ${o.text}`).join(' | ')}
Đáp án đúng: ${answer}. ${answerText}${similarText}

Hãy viết lời luận giải theo yêu cầu ở trên.`;

    const { text } = await generateContent(db, {
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        temperature: 0.5,
    });

    return { explanation: text.trim(), modelUsed: model };
}

module.exports = { generate };