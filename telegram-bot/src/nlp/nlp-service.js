// src/nlp/nlp-service.js - Replaces wit.js
import { NlpManager } from 'node-nlp';

let manager = null;

export async function initNLP() {
    manager = new NlpManager({ languages: ['id'], forceNER: true, nlu: { useNoneFeature: true } });
    if (process.env.NODE_ENV === 'test') {
        return; // Skip loading in test environment if needed, or handle path differently
    }
    // Adjust path if running from dist or root
    manager.load('./corpus.json');
    console.log('[NLP] Model loaded');
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
