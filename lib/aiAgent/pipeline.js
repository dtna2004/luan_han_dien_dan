/**
 * pipeline.js
 * Điều phối toàn bộ luồng cho 1 case. Có cache: nếu case đã có ai_bazi rồi
 * và không ép forceRegenerate thì trả luôn dữ liệu cũ, không gọi LLM lại
 * (tiết kiệm chi phí + quota key).
 */

const baziEngine = require('./baziEngine');
const birthInfoExtractor = require('./birthInfoExtractor');
const explainAnswer = require('./explainAnswer');
const embeddings = require('./embeddings');

async function generateAiAnalysis(db, caseDoc, { forceRegenerate = false, modelOverrides = {} } = {}) {
    const col = db.collection('van_han');

    if (!forceRegenerate && caseDoc.ai_bazi && caseDoc.ai_explanation) {
        return {
            bazi: caseDoc.ai_bazi,
            explanation: caseDoc.ai_explanation,
            similarCases: caseDoc.ai_similar_cases || [],
            meta: caseDoc.ai_meta || {},
            fromCache: true,
        };
    }

    // 1. Trích xuất thông tin sinh từ raw text
    const birthInfo = caseDoc.birth_info || {};
    const extracted = await birthInfoExtractor.extract(db, {
        raw: birthInfo.raw || '',
        hints: birthInfo,
        modelOverride: modelOverrides.extract,
    });

    // 2. Tính Bát Tự — thuật toán tất định, KHÔNG dùng LLM
    const bazi = baziEngine.calculate({
        gender: extracted.gender,
        calendarType: extracted.calendarType,
        year: extracted.year,
        month: extracted.month,
        day: extracted.day,
        hour: extracted.hour,
        minute: extracted.minute,
        isLeapMonth: extracted.isLeapMonth,
        country: extracted.country || birthInfo.country,
    });

    // 3. Embedding câu hỏi + tìm case tương tự (không tính vào chính nó)
    let vector = null;
    let similarCases = [];
    try {
        vector = await embeddings.embedCase(db, caseDoc, modelOverrides.embedding);
        similarCases = await embeddings.findSimilar(db, vector, { excludeId: caseDoc.id, topK: 5 });
    } catch (e) {
        // Không để lỗi embedding chặn toàn bộ luồng — vẫn trả kết quả chính, chỉ thiếu case tương tự
        similarCases = [];
    }

    // 4. Luận giải đáp án dựa trên lá số đã tính
    const { explanation, modelUsed: explainModel } = await explainAnswer.generate(db, {
        bazi,
        question: caseDoc.question,
        options: caseDoc.options,
        answer: caseDoc.answer,
        category: caseDoc.category,
        similarCases,
        modelOverride: modelOverrides.explain,
    });

    const meta = {
        modelExtract: extracted.modelUsed,
        modelExplain: explainModel,
        modelEmbedding: vector ? (modelOverrides.embedding || 'gemini-embedding-2') : null,
        generatedAt: new Date(),
        editedByAdmin: false,
        extractConfidence: extracted.confidence,
        extractNotes: extracted.notes || null,
    };

    // 5. Lưu lại vào case (và embedding riêng để lần sau case khác tìm thấy case này)
    await col.updateOne(
        { id: caseDoc.id },
        {
            $set: {
                ai_bazi: bazi,
                ai_explanation: explanation,
                ai_similar_cases: similarCases,
                ai_meta: meta,
                ...(vector ? { question_embedding: vector } : {}),
                updated_at: new Date(),
            },
        },
    );

    return { bazi, explanation, similarCases, meta, fromCache: false };
}

module.exports = { generateAiAnalysis };