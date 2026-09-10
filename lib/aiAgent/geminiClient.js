/**
 * geminiClient.js
 * Gọi thẳng REST endpoint của Gemini API (dùng chung cho cả Gemini và Gemma,
 * vì Gemma 4 được phục vụ qua chính Gemini API) — không cần SDK riêng.
 */

const { getNextKey } = require('./keyRotator');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gọi generateContent, hỗ trợ JSON mode qua responseSchema.
 * @param {import('mongodb').Db} db
 * @param {{model:string, systemInstruction?:string, prompt:string, responseSchema?:object, temperature?:number}} opts
 */
async function generateContent(db, opts) {
    const { model, systemInstruction, prompt, responseSchema, temperature = 0.3 } = opts;
    const { key } = await getNextKey(db);

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature },
    };
    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (responseSchema) {
        body.generationConfig.responseMimeType = 'application/json';
        body.generationConfig.responseSchema = responseSchema;
    }

    const res = await fetch(`${BASE_URL}/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API lỗi (model=${model}, status=${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return { text, raw: data };
}

/**
 * Gọi embedContent (Gemini Embedding 2).
 * @param {import('mongodb').Db} db
 * @param {{model:string, text:string, outputDimensionality?:number}} opts
 * @returns {Promise<number[]>}
 */
async function embedText(db, opts) {
    const { model, text, outputDimensionality = 768 } = opts;
    const { key } = await getNextKey(db);

    const res = await fetch(`${BASE_URL}/models/${model}:embedContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini Embedding lỗi (status=${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data?.embedding?.values || [];
}

module.exports = { generateContent, embedText };