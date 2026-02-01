import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ API Key not found in .env");
        return;
    }

    console.log("Checking available models for key ending in...", key.slice(-5));

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.models) {
            data.models.forEach(m => {
                // Print pure name without 'models/' prefix for clarity
                const name = m.name.replace('models/', '');
                console.log(`MODEL_ID: ${name}`);
            });
        } else {
            console.log("No models found?", data);
        }
    } catch (e) {
        console.error("❌ Error listing models:", e.message);
    }
}

listModels();
