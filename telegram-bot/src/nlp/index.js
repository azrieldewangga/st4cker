// index.js - NLP module exports

export { parseMessage, extractEntities } from './nlp-service.js';

export { schemas, getMissingFields } from './intentSchemas.js';
export { setPending, getPending, clearPending, updatePending, hasPending } from './pendingState.js';
export { handleNaturalLanguage, handleNLPCallback } from './nlp-handler.js';
export { parseAmount, formatAmount } from './currency.js';
export { parseDate, formatDate, formatDateRelative } from './dateParser.js';
export { responses } from './personality.js';
