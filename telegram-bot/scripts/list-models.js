
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    try {
        const key = process.env.GEMINI_API_KEY;
        // Using v1beta as per error messages
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

        const response = await fetch(url);
        const data = await response.json();

        let output = '';
        if (data.models) {
            output += '✅ Available Models:\n';
            data.models.forEach(m => {
                output += `- ${m.name} (${m.supportedGenerationMethods.join(', ')})\n`;
            });
        } else {
            output += `❌ Failed to list models: ${JSON.stringify(data)}\n`;
        }

        fs.writeFileSync(path.join(__dirname, '../models_list.txt'), output, 'utf8');
        console.log('List written to models_list.txt');

    } catch (e) {
        console.error('❌ Error:', e);
        fs.writeFileSync(path.join(__dirname, '../models_list.txt'), `Error: ${e.message}`, 'utf8');
    }
}

listModels();
