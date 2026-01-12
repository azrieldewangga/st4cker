
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(__dirname, '../data/new-utterances.json');
const CUSTOM_CORPUS_FILE = path.resolve(__dirname, '../data/custom-corpus.json');

async function bulkTrain() {
    console.log('📦 Reading new utterances...');
    if (!fs.existsSync(DATA_FILE)) {
        console.error('File not found:', DATA_FILE);
        return;
    }

    const newData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // Load existing custom corpus
    let customData = { utterances: [] };
    if (fs.existsSync(CUSTOM_CORPUS_FILE)) {
        try {
            customData = JSON.parse(fs.readFileSync(CUSTOM_CORPUS_FILE, 'utf8'));
        } catch (e) {
            console.error('⚠️ Custom corpus error, starting fresh.');
        }
    }

    let addedCount = 0;
    for (const item of newData) {
        // Check duplicate
        const exists = customData.utterances.some(u => u.text === item.text && u.intent === item.intent);
        if (!exists) {
            customData.utterances.push(item);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(CUSTOM_CORPUS_FILE, JSON.stringify(customData, null, 2));
        console.log(`✅ Added ${addedCount} new utterances to corpus.`);

        console.log('🚀 Triggering training...');
        const trainProcess = spawn('npm', ['run', 'train'], {
            stdio: 'inherit',
            shell: true,
            cwd: path.resolve(__dirname, '..')
        });

        trainProcess.on('close', (code) => {
            console.log(`Training process exited with code ${code}`);
        });

    } else {
        console.log('ℹ️ No new unique utterances to add.');
    }
}

bulkTrain();
