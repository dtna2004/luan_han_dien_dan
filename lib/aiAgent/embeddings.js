/**
 * embeddings.js
 * Tính embedding câu hỏi bằng Gemini Embedding 2, và tìm case tương tự
 * bằng cosine similarity thủ công (MongoDB Atlas chưa có Vector Search).
 *
 * Lưu ý hiệu năng: cách này tải toàn bộ embedding về Node rồi tính tay,
 * chấp nhận được với vài nghìn case. Nếu sau này nâng tier Atlas lên bản
 * có Vector Search, nên chuyển sang $vectorSearch cho nhanh hơn nhiều.
 */

const { embedText } = require('./geminiClient');
const { getSettings } = require('./modelRegistry');

function buildEmbeddingSourceText(caseDoc) {
    const optionsText = (caseDoc.options || []).map((o) => `${o.letter}. ${o.text}`).join(' | ');
    return [
        caseDoc.category ? `Chủ đề: ${caseDoc.category}` : '',
        `Câu hỏi: ${caseDoc.question}`,
        optionsText ? `Đáp án: ${optionsText}` : '',
    ].filter(Boolean).join('\n');
}

async function embedCase(db, caseDoc, modelOverride) {
    const settings = await getSettings(db);
    const model = modelOverride || settings.modelEmbedding;
    const text = buildEmbeddingSourceText(caseDoc);
    const vector = await embedText(db, { model, text });
    return vector;
}

function cosineSimilarity(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * @param {import('mongodb').Db} db
 * @param {number[]} vector
 * @param {{ excludeId?: string, collectionName?: string, topK?: number }} opts
 */
async function findSimilar(db, vector, { excludeId, collectionName = 'cases', topK = 5 } = {}) {
    const col = db.collection(collectionName);
    const candidates = await col.find(
        { question_embedding: { $exists: true, $ne: null }, ...(excludeId ? { id: { $ne: excludeId } } : {}) },
        { projection: { id: 1, question_number: 1, question: 1, answer: 1, category: 1, question_embedding: 1 } },
    ).toArray();

    const scored = candidates
        .map((c) => ({
            case_id: c.id,
            question_number: c.question_number,
            question: c.question,
            category: c.category,
            score: cosineSimilarity(vector, c.question_embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return scored;
}

module.exports = { buildEmbeddingSourceText, embedCase, cosineSimilarity, findSimilar };