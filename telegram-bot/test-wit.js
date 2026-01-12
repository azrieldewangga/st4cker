/* test-wit.js */
import 'dotenv/config';
import fetch from 'node-fetch';

const TOKEN = process.env.WIT_ACCESS_TOKEN;
// Test dengan kalimat yang PASTI ada di training data user (persis sama)
const QUERY = "project on hold";

console.log(`🔑 Token: ${TOKEN ? TOKEN.substring(0, 5) + '...' : 'NONE'}`);

async function test() {
    // 1. Cek App Info dari Token
    try {
        const appRes = await fetch("https://api.wit.ai/apps?limit=1", {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const appData = await appRes.json();
        console.log("\n📱 App Info (dari token ini):");
        console.log(JSON.stringify(appData, null, 2));
    } catch (e) {
        console.log("Gagal cek app info");
    }

    // 2. Test Message
    const url = `https://api.wit.ai/message?v=20240101&q=${encodeURIComponent(QUERY)}`;
    console.log(`\n🔍 Testing Query: "${QUERY}"`);

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();

        console.log("\n📦 RESPON WIT.AI:");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();