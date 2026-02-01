
import { parseDate } from './telegram-bot/src/nlp/dateParser.js';

const text = "deadline nya 20 jan";
const res = parseDate(text);
console.log(`Input: "${text}"`);
console.log('Result:', res);

const text2 = "tenggat 21 januari";
console.log(`Input: "${text2}"`);
console.log('Result:', parseDate(text2));
