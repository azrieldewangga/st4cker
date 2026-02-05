import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import { shell, app, safeStorage } from 'electron';
// @ts-ignore
import log from 'electron-log/main.js';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKENS_FILE = 'google-drive-tokens.enc'; // encrypted tokens file
// Credentials loaded from JSON
let CLIENT_ID;
let CLIENT_SECRET;
let oauth2Client = null; // Lazy-initialized
// --- Token Storage with safeStorage ---
const getTokensPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, TOKENS_FILE);
};
const saveTokens = (tokens) => {
    if (!safeStorage.isEncryptionAvailable()) {
        log.error('[Drive] safeStorage encryption not available. Cannot save tokens.');
        throw new Error('Token encryption not available on this system');
    }
    try {
        const tokensJson = JSON.stringify(tokens);
        const encrypted = safeStorage.encryptString(tokensJson);
        fs.writeFileSync(getTokensPath(), encrypted);
        log.info('[Drive] Tokens saved securely');
    }
    catch (error) {
        log.error('[Drive] Failed to save tokens:', error);
        throw error;
    }
};
const loadTokens = () => {
    const tokensPath = getTokensPath();
    if (!fs.existsSync(tokensPath)) {
        log.info('[Drive] No saved tokens found');
        return null;
    }
    if (!safeStorage.isEncryptionAvailable()) {
        log.error('[Drive] safeStorage decryption not available');
        return null;
    }
    try {
        const encrypted = fs.readFileSync(tokensPath);
        const decrypted = safeStorage.decryptString(encrypted);
        const tokens = JSON.parse(decrypted);
        log.info('[Drive] Tokens loaded successfully');
        return tokens;
    }
    catch (error) {
        log.error('[Drive] Failed to load tokens:', error);
        return null;
    }
};
const deleteTokens = () => {
    const tokensPath = getTokensPath();
    if (fs.existsSync(tokensPath)) {
        fs.unlinkSync(tokensPath);
        log.info('[Drive] Tokens deleted');
    }
};
// --- Credential Loading ---
const loadCredentials = () => {
    try {
        const credentialsPath = app.isPackaged
            ? path.join(process.resourcesPath, 'google-drive.json')
            : path.join(app.getAppPath(), 'electron/credentials/google-drive.json');
        log.info('[Drive] Loading credentials from:', credentialsPath);
        const credentialsData = fs.readFileSync(credentialsPath, 'utf-8');
        const credentials = JSON.parse(credentialsData);
        CLIENT_ID = credentials.client_id;
        CLIENT_SECRET = credentials.client_secret;
        if (!CLIENT_ID || !CLIENT_SECRET) {
            log.error('[Drive] Credentials file missing client_id or client_secret');
            return false;
        }
        log.info('[Drive] Credentials loaded successfully');
        return true;
    }
    catch (error) {
        log.error('[Drive] Failed to load credentials:', error);
        CLIENT_ID = undefined;
        CLIENT_SECRET = undefined;
        return false;
    }
};
// --- OAuth2 Client Helper (Lazy Init) ---
const getOAuthClient = (redirectUri) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Google Drive credentials not loaded. Feature unavailable.');
    }
    // Create new client if redirect URI provided (for auth flow)
    if (redirectUri) {
        return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
    }
    // Reuse existing client for other operations
    if (!oauth2Client) {
        oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        // Try to load saved tokens
        const savedTokens = loadTokens();
        if (savedTokens) {
            oauth2Client.setCredentials(savedTokens);
        }
    }
    return oauth2Client;
};
// --- Initialize credentials on module load ---
loadCredentials();
let authServer = null;
// --- Drive Service ---
export const driveService = {
    // 1. Authenticate User
    authenticate: async () => {
        if (authServer) {
            authServer.close();
            authServer = null;
        }
        return new Promise((resolve, reject) => {
            log.info('[Drive] Starting authentication flow...');
            // Check safeStorage availability first
            if (!safeStorage.isEncryptionAvailable()) {
                const errorMsg = 'Secure token storage not available on this system. Google Drive backup disabled.';
                log.error('[Drive]', errorMsg);
                return reject(new Error(errorMsg));
            }
            // Reload credentials to ensure fresh state
            const credsReloaded = loadCredentials();
            if (!credsReloaded || !CLIENT_ID || !CLIENT_SECRET) {
                const errorMsg = 'Google Drive credentials not found. Please ensure google-drive.json exists in application resources.';
                log.error('[Drive]', errorMsg);
                return reject(new Error(errorMsg));
            }
            // Check if we have existing refresh token (for conditional prompt)
            const existingTokens = loadTokens();
            const hasRefreshToken = existingTokens && existingTokens.refresh_token;
            // Declare tempOAuth2Client in outer scope
            let tempOAuth2Client = null;
            // Start auth server with ephemeral port
            authServer = http.createServer(async (req, res) => {
                try {
                    // Guard against undefined req.url
                    // @ts-ignore
                    if (req.url && req.url.startsWith('/oauth2callback')) {
                        log.info('[Drive] Received OAuth callback');
                        // @ts-ignore
                        const qs = new url.URL(req.url, 'http://localhost').searchParams;
                        const code = qs.get('code');
                        if (code) {
                            res.end('✅ Authentication successful! You can close this window.');
                            if (authServer)
                                authServer.close();
                            authServer = null;
                            try {
                                // Use tempOAuth2Client from outer scope
                                const { tokens } = await tempOAuth2Client.getToken(code);
                                // Save to global client
                                const client = getOAuthClient();
                                client.setCredentials(tokens);
                                // Save encrypted tokens
                                saveTokens(tokens);
                                log.info('[Drive] Authentication completed successfully');
                                resolve(true);
                            }
                            catch (tokenError) {
                                log.error('[Drive] Token exchange failed:', tokenError);
                                reject(tokenError);
                            }
                        }
                        else {
                            res.end('❌ Authentication failed. No authorization code received.');
                            log.warn('[Drive] No code in OAuth callback');
                            resolve(false);
                            if (authServer)
                                authServer.close();
                        }
                    }
                }
                catch (e) {
                    log.error('[Drive] OAuth callback error:', e);
                    res.end('❌ Error during authentication.');
                    reject(e);
                    if (authServer)
                        authServer.close();
                }
            });
            // Listen on ephemeral port (OS assigns)
            authServer.listen(0, () => {
                const address = authServer.address();
                const port = address.port;
                const redirectUri = `http://localhost:${port}/oauth2callback`;
                log.info('[Drive] Auth server listening on port:', port);
                log.info('[Drive] Redirect URI:', redirectUri);
                // Assign to outer scope variable
                tempOAuth2Client = getOAuthClient(redirectUri);
                // Conditional prompt based on refresh token existence
                const authUrl = tempOAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: SCOPES,
                    prompt: hasRefreshToken ? 'select_account' : 'consent' // Consent only when needed
                });
                shell.openExternal(authUrl).catch(e => {
                    log.error('[Drive] Failed to open browser:', e);
                    reject(new Error('Failed to open authentication URL'));
                });
            });
            authServer.on('error', (e) => {
                log.error('[Drive] Auth server error:', e);
                reject(e);
            });
        });
    },
    // Helper: Find or Create Folder
    getOrCreateFolder: async (drive, folderName) => {
        try {
            const res = await drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });
            if (res.data.files && res.data.files.length > 0) {
                log.info(`[Drive] Found folder '${folderName}':`, res.data.files[0].id);
                return res.data.files[0].id;
            }
            log.info(`[Drive] Creating folder '${folderName}'...`);
            const folder = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            });
            log.info(`[Drive] Folder created:`, folder.data.id);
            return folder.data.id;
        }
        catch (e) {
            log.error('[Drive] Folder operation failed:', e);
            throw e;
        }
    },
    // 2. Upload Backup
    uploadDatabase: async () => {
        try {
            // Re-validate credentials instead of using stale boolean
            if (!CLIENT_ID || !CLIENT_SECRET) {
                throw new Error('Google Drive credentials not available');
            }
            const client = getOAuthClient();
            // Validate refresh_token and force access_token refresh if needed
            // @ts-ignore
            if (!client.credentials || !client.credentials.refresh_token) {
                throw new Error('Not authenticated. Please connect Google Drive first.');
            }
            // Ensure we have a valid access token (will auto-refresh if expired)
            try {
                await client.getAccessToken();
            }
            catch (error) {
                log.error('[Drive] Failed to refresh access token:', error);
                throw new Error('Authentication expired. Please reconnect Google Drive.');
            }
            const drive = google.drive({ version: 'v3', auth: client });
            // Database path consistency - always use userData
            // NOTE: Database file renamed to st4cker.db as part of v1.6.0 rebranding
            const dbPath = path.join(app.getPath('userData'), 'st4cker.db');
            if (!fs.existsSync(dbPath)) {
                throw new Error('Database file not found at: ' + dbPath);
            }
            // st4cker branding
            // NOTE: Google Cloud project_id remains "campusdash-backup" in credentials
            // to avoid requiring all users to re-authenticate with new OAuth credentials
            const folderId = await driveService.getOrCreateFolder(drive, 'st4cker Backups');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `backup-st4cker-${timestamp}.db`;
            log.info('[Drive] Starting upload...');
            const res = await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [folderId]
                },
                media: {
                    mimeType: 'application/x-sqlite3',
                    body: fs.createReadStream(dbPath)
                },
                fields: 'id'
            });
            log.info('[Drive] Upload successful, ID:', res.data.id);
            // Save last backup timestamp
            const metaPath = path.join(app.getPath('userData'), 'drive-meta.json');
            fs.writeFileSync(metaPath, JSON.stringify({ lastBackup: Date.now() }));
            // @ts-ignore
            return res.data.id;
        }
        catch (error) {
            log.error('[Drive] Upload failed:', error);
            // @ts-ignore
            throw new Error(error.message || 'Upload failed');
        }
    },
    // 3. Check Status
    isAuthenticated: () => {
        try {
            // Check for refresh_token (persistent), not access_token (ephemeral)
            const tokens = loadTokens();
            return !!tokens && !!tokens.refresh_token;
        }
        catch {
            return false;
        }
    },
    getLastBackup: () => {
        try {
            const metaPath = path.join(app.getPath('userData'), 'drive-meta.json');
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                return meta.lastBackup;
            }
        }
        catch (e) {
            log.error('[Drive] Failed to read backup metadata:', e);
        }
        return null;
    },
    // Logout
    logout: () => {
        deleteTokens();
        if (oauth2Client) {
            oauth2Client.setCredentials({});
            oauth2Client = null;
        }
        log.info('[Drive] Logged out');
    },
    // Auto-backup scheduler
    checkAndRunAutoBackup: async () => {
        if (!driveService.isAuthenticated()) {
            log.info('[Drive] Auto-backup skipped (not authenticated)');
            return;
        }
        const lastBackup = driveService.getLastBackup();
        const now = Date.now();
        const WEEK = 7 * 24 * 60 * 60 * 1000;
        if (!lastBackup || (now - lastBackup > WEEK)) {
            log.info('[Drive] Auto-backup triggered');
            try {
                await driveService.uploadDatabase();
                log.info('[Drive] Auto-backup completed');
            }
            catch (e) {
                log.error('[Drive] Auto-backup failed:', e);
            }
        }
        else {
            log.info('[Drive] Auto-backup skipped (recent backup exists)');
        }
    }
};
