
import { parseDate } from './telegram-bot/src/nlp/dateParser.js';

const AMOUNT_REGEX = /\b(?:\d{1,3}(?:[.,]\d{3})*(?:,\d+)?|\d+)\s*(?:rb|k|jt|juta)?\b/i;

function extractLocalEntities(text) {
    const entities = {};
    const lower = text.toLowerCase();

    // 1. Amount
    const amtMatch = text.match(AMOUNT_REGEX);
    if (amtMatch) {
        if (!amtMatch[0].match(/^\d{4}$/) || lower.includes('rp')) {
            entities.amount = [{ value: amtMatch[0] }];
        }
    }

    // 2. Date
    const dateObj = parseDate(text);
    if (dateObj) {
        entities.waktu = [{ value: text }];
    }

    return entities;
}

const text = "deadline nya 20 jan";
console.log(`Input: "${text}"`);
const ent = extractLocalEntities(text);
console.log('Entities:', JSON.stringify(ent, null, 2));
