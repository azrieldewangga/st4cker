
import fs from 'fs';
import path from 'path';
import { NlpManager } from 'node-nlp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const WIT_DIR = path.resolve(ROOT_DIR, '../st4cker');
const CUSTOM_CORPUS_FILE = path.resolve(ROOT_DIR, 'data/custom-corpus.json');
const OUTPUT_FILE = path.resolve(ROOT_DIR, 'corpus.json');

// Args
const args = process.argv.slice(2);
const addIndex = args.indexOf('--add');
const newText = addIndex !== -1 ? args[addIndex + 1] : null;
const newIntent = addIndex !== -1 ? args[addIndex + 2] : null;

async function train() {
    console.log('🚀 Starting NLP Training...');
    const manager = new NlpManager({ languages: ['id'], forceNER: true, nlu: { useNoneFeature: true } });

    // 0. Handle New Data Addition
    if (newText && newIntent) {
        console.log(`📝 Adding new data: "${newText}" -> ${newIntent}`);
        let customData = { utterances: [] };
        if (fs.existsSync(CUSTOM_CORPUS_FILE)) {
            try {
                customData = JSON.parse(fs.readFileSync(CUSTOM_CORPUS_FILE, 'utf8'));
            } catch (e) {
                console.error('⚠️ Error reading custom corpus, creating new one.');
            }
        }

        // Add if not exists
        const exists = customData.utterances.some(u => u.text === newText && u.intent === newIntent);
        if (!exists) {
            customData.utterances.push({ text: newText, intent: newIntent });
            fs.writeFileSync(CUSTOM_CORPUS_FILE, JSON.stringify(customData, null, 2));
            console.log('✅ Saved to custom-corpus.json');
        } else {
            console.log('⚠️ Utterance already exists, skipping add.');
        }
    } else if (addIndex !== -1) {
        console.log('❌ Usage: npm run train -- --add "text" "intent"');
        process.exit(1);
    }

    // 1. Load Wit.ai Entities (Base)
    console.log('📦 Loading Wit.ai entities...');
    const entitiesDir = path.join(WIT_DIR, 'entities');
    if (fs.existsSync(entitiesDir)) {
        const entityFiles = fs.readdirSync(entitiesDir);
        for (const file of entityFiles) {
            if (!file.endsWith('.json')) continue;
            const entityName = file.replace('.json', '');
            if (entityName.includes('$')) continue;

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

    // 2. Load Wit.ai Utterances (Base)
    console.log('🗣️ Loading Wit.ai utterances...');
    const utteranceFile = path.join(WIT_DIR, 'utterances/utterances-1.json');
    if (fs.existsSync(utteranceFile)) {
        const content = JSON.parse(fs.readFileSync(utteranceFile, 'utf8'));
        for (const u of content.utterances) {
            manager.addDocument('id', u.text, u.intent);
            // Add entities from utterances
            if (u.entities) {
                for (const e of u.entities) {
                    const entityName = e.entity.split(':')[0];
                    if (entityName.startsWith('wit$')) continue;
                    manager.addNamedEntityText(entityName, e.body, ['id'], [e.body]);
                }
            }
        }
    }

    // 3. Load Custom Corpus (Overlays)
    if (fs.existsSync(CUSTOM_CORPUS_FILE)) {
        console.log('🌟 Loading custom corpus...');
        const customContent = JSON.parse(fs.readFileSync(CUSTOM_CORPUS_FILE, 'utf8'));
        for (const u of customContent.utterances) {
            manager.addDocument('id', u.text, u.intent);
        }
    }

    // 4. Train & Save
    console.log('🧠 Training model...');
    await manager.train();
    console.log('💾 Saving corpus.json...');
    manager.save(OUTPUT_FILE);
    console.log('✅ Training complete! Restart the bot to apply changes.');
}

train();
