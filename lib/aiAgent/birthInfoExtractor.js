/**
 * birthInfoExtractor.js
 * Dùng LLM để đọc text tự do (birth_info.raw) và trả JSON chuẩn hoá.
 * Mỗi người nhập một kiểu khác nhau nên KHÔNG parse bằng regex cứng —
 * để LLM tự hiểu ngữ cảnh, nhưng luôn ép JSON schema để dữ liệu ra ổn định.
 */

const { generateContent } = require('./geminiClient');
const { getSettings } = require('./modelRegistry');

const SCHEMA = {
    type: 'object',
    properties: {
        gender: { type: 'string', enum: ['Nam', 'Nữ'] },
        calendarType: { type: 'string', enum: ['Dương lịch', 'Âm lịch'] },
        year: { type: 'integer' },
        month: { type: 'integer' },
        day: { type: 'integer' },
        hour: { type: 'integer', nullable: true },
        minute: { type: 'integer', nullable: true },
        isLeapMonth: { type: 'boolean' },
        country: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        confidence: { type: 'number' },
        notes: { type: 'string', nullable: true },
    },
    required: ['gender', 'calendarType', 'year', 'month', 'day', 'isLeapMonth', 'confidence'],
};

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia trích xuất dữ liệu ngày giờ sinh từ văn bản tự do tiếng Việt để phục vụ tính Bát Tự (Tứ Trụ).
Người dùng nhập theo rất nhiều kiểu khác nhau (có thể lẫn cả tiếng Anh, viết tắt, thiếu dấu, ghi giờ kiểu "16h40", "4h40 chiều", "12h1", ngày kiểu "26/12/2004", "28 tháng 4 năm 1974", quốc gia bất kỳ trên thế giới không chỉ Việt Nam).
Nhiệm vụ: đọc kỹ câu chữ và ngữ cảnh (không dùng regex máy móc) để suy ra chính xác:
- gender: "Nam" hoặc "Nữ"
- calendarType: "Dương lịch" (mặc định nếu không nói rõ) hoặc "Âm lịch" nếu văn bản có nhắc âm lịch/ngày ta
- year/month/day: số nguyên
- hour/minute: số nguyên 0-23 / 0-59, để null nếu văn bản không cho biết giờ sinh
- isLeapMonth: true nếu là tháng nhuận âm lịch, ngược lại false
- country: tên quốc gia sinh nếu xác định được (giữ nguyên như trong văn bản), null nếu không rõ
- location: địa danh cụ thể hơn nếu có (tỉnh/thành), null nếu không có
- confidence: 0 đến 1, mức độ chắc chắn của việc trích xuất
- notes: ghi chú ngắn nếu có điểm mơ hồ cần admin xem lại, null nếu không có gì đặc biệt

Chỉ trả về đúng JSON theo schema, không thêm chữ nào khác.`;

/**
 * @param {import('mongodb').Db} db
 * @param {{ raw: string, hints?: object, modelOverride?: string }} params
 */
async function extract(db, { raw, hints = {}, modelOverride }) {
    const settings = await getSettings(db);
    const model = modelOverride || settings.modelExtract;

    const prompt = [
        `Văn bản khai báo ngày giờ sinh: """${raw}"""`,
        hints && Object.keys(hints).length
            ? `Dữ liệu đã có sẵn (có thể null/thiếu, chỉ dùng để tham khảo, ưu tiên đọc lại từ văn bản gốc ở trên): ${JSON.stringify(hints)}`
            : '',
    ].filter(Boolean).join('\n\n');

    const { text } = await generateContent(db, {
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        responseSchema: SCHEMA,
        temperature: 0.1,
    });

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        throw new Error(`Không parse được JSON trả về từ model trích xuất (${model}): ${text}`);
    }

    return { ...parsed, modelUsed: model };
}

module.exports = { extract, SCHEMA };