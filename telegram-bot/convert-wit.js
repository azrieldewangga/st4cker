import fs from 'fs';
import path from 'path';
import { NlpManager } from 'node-nlp';

const WIT_DIR = '../st4cker';
const OUTPUT_FILE = './corpus.json';

async function convert() {
    console.log('🚀 Starting conversion...');
    const manager = new NlpManager({ languages: ['id'], forceNER: true, nlu: { useNoneFeature: true } });

    // 1. Load Entities
    console.log('📦 Loading entities...');
    const entitiesDir = path.join(WIT_DIR, 'entities');
    if (fs.existsSync(entitiesDir)) {
        const entityFiles = fs.readdirSync(entitiesDir);
        for (const file of entityFiles) {
            if (!file.endsWith('.json')) continue;
            const entityName = file.replace('.json', '');
            if (entityName.includes('$')) continue; // Skip builtins like wit$number

            try {
                const content = JSON.parse(fs.readFileSync(path.join(entitiesDir, file), 'utf8'));
                if (content.keywords) {
                    for (const item of content.keywords) {
                        manager.addNamedEntityText(entityName, item.keyword, ['id'], item.synonyms);
                    }
                }
            } catch (e) {
                console.error(`Error loading entity ${file}:`, e.message);
            }
        }
    }

    // 2. Load Utterances
    console.log('🗣️ Loading utterances...');
    const utteranceFile = path.join(WIT_DIR, 'utterances/utterances-1.json');
    if (fs.existsSync(utteranceFile)) {
        const content = JSON.parse(fs.readFileSync(utteranceFile, 'utf8'));

        for (const u of content.utterances) {
            const text = u.text;
            const intent = u.intent;

            manager.addDocument('id', text, intent);

            // Add entities found in utterances to enrich NER
            if (u.entities) {
                for (const e of u.entities) {
                    const entityName = e.entity.split(':')[0];
                    if (entityName.startsWith('wit$')) continue;

                    const body = e.body;
                    manager.addNamedEntityText(entityName, body, ['id'], [body]);
                }
            }
        }
    } else {
        console.error('Utterance file not found!');
    }

    // 3. Train & Save
    console.log('🧠 Training model...');
    await manager.train();
    console.log('💾 Saving corpus.json...');
    manager.save(OUTPUT_FILE);
    console.log('✅ Conversion complete!');
}

convert();
