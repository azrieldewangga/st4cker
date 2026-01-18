# Task: Gemini API Migration & Enhancement

## Phase 1: The Brain Transplant (Core Migration) @today
Focus: Switching from `node-nlp` to Gemini API for accurate, zero-training intent extraction.
- [ ] Install dependencies (`@google/generative-ai`, `dotenv`) <!-- id: 0 -->
- [ ] Backup and archive `corpus.json` to `legacy_corpus_backup.json` <!-- id: 1 -->
- [ ] Implement `nlp-service.js` with Gemini API logic <!-- id: 2 -->
    - Setup GoogleGenerativeAI client
    - Create System Instruction (Persona & JSON Schema)
    - Implement `parseMessage` to return standard format
- [ ] Refactor `nlp-handler.js` <!-- id: 3 -->
    - Remove legacy regex fallbacks and complex correction logic
    - Connect to new `nlp-service`
- [ ] Verify functionality (Live Test via Telegram) <!-- id: 4 -->

## Phase 2: The Personality Upgrade (Future)
Focus: Making the bot "human" with context awareness and generated responses.
- [ ] Implement `HistoryService` to fetch recent transactions by User ID <!-- id: 5 -->
- [ ] Update `nlp-service.js` to accept conversation history <!-- id: 6 -->
- [ ] Enable Response Generation (let Gemini generate the reply text) <!-- id: 7 -->
- [ ] Test context awareness ("Nasi ayam 5 hari berturut-turut") <!-- id: 8 -->
