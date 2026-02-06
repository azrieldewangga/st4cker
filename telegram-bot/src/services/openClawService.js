
/**
 * Service to communicate with the OpenClaw Agent via HTTP Gateway.
 */
export class OpenClawService {
    /**
     * Send a prompt to OpenClaw.
     * @param {string} text - The user's prompt.
     * @param {string} modelPreference - 'flash' (Light) or 'pro' (Heavy).
     * @returns {Promise<string>} - The agent's response.
     */
    static async sendPrompt(text, modelPreference = 'flash') {
        const endpoint = process.env.OPENCLAW_ENDPOINT;

        if (!endpoint) {
            console.warn('[OpenClaw] OPENCLAW_ENDPOINT not configured. Falling back.');
            return null;
        }

        console.log(`[OpenClaw] Sending request (${modelPreference}): "${text}"`);

        try {
            // Construct payload compatible with OpenClaw's likely API (Adjust based on actual API)
            // Assuming standard JSON payload: { input: "...", model: "..." }
            const payload = {
                input: text,
                model: modelPreference === 'pro' ? 'gemini-3-pro-preview' : 'gemini-2.0-flash',
                stream: false
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // If the URL is "tokenized" (e.g. ?token=...), we might not need auth header,
                    // but adding it doesn't hurt if the endpoint supports it.
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`OpenClaw Gateway returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Extract text from standard agent response formats (adjust as needed)
            return data.output || data.response || data.text || JSON.stringify(data);

        } catch (error) {
            console.error('[OpenClaw] Request failed:', error.message);
            return null; // Return null to trigger fallback or error handling
        }
    }
}
