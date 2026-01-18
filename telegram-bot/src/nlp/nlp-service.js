import fs from 'fs';
// src/nlp/nlp-service.js - Replaces wit.js
import nodeNlp from 'node-nlp';
const { NlpManager } = nodeNlp;

let manager = null;

export async function initNLP() {
    manager = new NlpManager({ languages: ['id'], forceNER: true, nlu: { useNoneFeature: true } });
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    // 1. Load existing model/corpus
    // We try/catch in case corpus doesn't exist yet
    try {
        if (fs.existsSync('./corpus.json')) {
            manager.load('./corpus.json');
        }
    } catch (e) { console.log('[NLP] No corpus found, starting fresh.'); }

    // 2. Add New Synonyms (Runtime updates)
    manager.addDocument('id', 'list project', 'lihat_project');
    manager.addDocument('id', 'list projects', 'lihat_project');
    manager.addDocument('id', 'list projek', 'lihat_project');
    manager.addDocument('id', 'list projekan', 'lihat_project');
    manager.addDocument('id', 'daftar project', 'lihat_project');
    manager.addDocument('id', 'daftar projek', 'lihat_project');
    manager.addDocument('id', 'cek project', 'lihat_project');
    manager.addDocument('id', 'cek projek', 'lihat_project');
    manager.addDocument('id', 'lihat project', 'lihat_project');
    manager.addDocument('id', 'lihat projek', 'lihat_project');
    manager.addDocument('id', 'project running', 'lihat_project');
    manager.addDocument('id', 'projek running', 'lihat_project');
    manager.addDocument('id', 'project aktif', 'lihat_project');
    manager.addDocument('id', 'projek aktif', 'lihat_project');

    // 3. Train to incorporate new docs
    // Only train if we added docs or if no corpus existed
    console.log('[NLP] Training model...');
    await manager.train();

    // 4. Save updated model
    manager.save('./corpus.json');
    console.log('[NLP] Model trained and saved');
}

export function getManager() {
    return manager;
}

export async function parseMessage(text) {
    if (!manager) await initNLP();

    const result = await manager.process('id', text);
    // Convert to Wit.ai-compatible format for minimal code changes
    return {
        intents: result.intent ? [{ name: result.intent, confidence: result.score }] : [],
        entities: extractEntities(result.entities)
    };
}

export function extractEntities(nlpEntities) {
    const converted = {};
    if (!nlpEntities) return converted;

    // Normalize input to array
    let entityList = [];
    if (Array.isArray(nlpEntities)) {
        entityList = nlpEntities;
    } else if (typeof nlpEntities === 'object') {
        // Handle object map format: { entityName: [results] }
        Object.values(nlpEntities).forEach(val => {
            if (Array.isArray(val)) entityList.push(...val);
            else entityList.push(val);
        });
    }

    for (const e of entityList) {
        const name = e.entity;
        if (!converted[name]) converted[name] = [];
        converted[name].push({
            value: e.option || e.utteranceText,
            confidence: e.accuracy,
            body: e.utteranceText
        });
    }
    return converted;
}
