/**
 * modelRegistry.js
 * Danh sách model cho phép dùng trong AI Agent + cấu hình mặc định.
 * Admin sửa qua collection `ai_settings` (không cần deploy lại).
 */

const AVAILABLE_MODELS = {
    extract: [
        { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
        { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
        { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B' },
        { id: 'gemma-4-31b-it', label: 'Gemma 4 31B' },
        { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite' },
        { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite' },

    ],
    explain: [
        { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
        { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
        { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B' },
        { id: 'gemma-4-31b-it', label: 'Gemma 4 31B' },
        { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite' },
        { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite' },
    ],
    embedding: [
        { id: 'gemini-embedding-2', label: 'Gemini Embedding 2' },
    ],
};

const DEFAULT_SETTINGS = {
    _id: 'ai_settings',
    modelExtract: 'gemini-3.7-flash',
    modelExplain: 'gemini-3.8-flash',
    modelEmbedding: 'gemini-embedding-2',
    updatedAt: null,
    updatedBy: null,
};

async function getSettings(db) {
    const doc = await db.collection('ai_settings').findOne({ _id: 'ai_settings' });
    return doc || DEFAULT_SETTINGS;
}

async function updateSettings(db, { modelExtract, modelExplain, modelEmbedding, updatedBy }) {
    const update = { updatedAt: new Date() };
    if (modelExtract) update.modelExtract = modelExtract;
    if (modelExplain) update.modelExplain = modelExplain;
    if (modelEmbedding) update.modelEmbedding = modelEmbedding;
    if (updatedBy) update.updatedBy = updatedBy;

    await db.collection('ai_settings').updateOne(
        { _id: 'ai_settings' },
        { $set: update },
        { upsert: true },
    );
    return getSettings(db);
}

module.exports = { AVAILABLE_MODELS, DEFAULT_SETTINGS, getSettings, updateSettings };