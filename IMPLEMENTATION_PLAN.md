# Settings UI Refactoring

Refactor Settings page to use HextaUI components for better integration management and cleaner layout.

## User Review Required

> [!IMPORTANT]
> **Layout Changes**: Integrations and Backups cards will be displayed side-by-side (grid layout) on larger screens. Card "Telegram Quick Input" akan dihapus dan digabung ke dalam Integrations card.

> [!IMPORTANT]
> **New Dependencies**: Membutuhkan 2 HextaUI components (`@hextaui/settings-integrations` dan `@hextaui/auth-otp-verify`).

> [!WARNING]
> **UI Changes**: Telegram pairing flow akan berubah dari inline OTP input menjadi dialog modal dengan OTP verify component dari HextaUI.

## Proposed Changes

### Dependencies Installation

Install HextaUI components:
```bash
pnpm dlx shadcn@latest add @hextaui/settings-integrations
pnpm dlx shadcn@latest add @hextaui/auth-otp-verify
```

---

### [MODIFY] [Settings.tsx](file:///d:/Project/st4cker/src/pages/Settings.tsx)

**Remove:**
- `GoogleDriveCard` component (lines 48-183)
- Standalone `<TelegramTab />` render (line 535)

**Add:**
1. **Import HextaUI Components**
   - Import `SettingsIntegrations` dari `@/components/ui/settings-integrations`
   - Import `AuthOTPVerify` dari `@/components/ui/auth-otp-verify`

2. **State Management - Google Drive**
   - Extract state dari `GoogleDriveCard`: `isAuthenticated`, `loading`, `lastBackup`
   - Move handlers: `checkStatus()`, `handleConnect()`, `confirmDisconnect()`, `handleBackupNow()`

3. **State Management - Telegram**
   - Extract state dari `TelegramTab`: `isPaired`, `status`, `pairingCode`, `isVerifying`
   - Move handlers: `handlePair()`, `handleUnpair()`, `handleSync()`
   - Add: `showOTPDialog` state untuk control dialog

4. **Integrations Card (New)**
   - Location: After "App Preferences" card, inside grid (right side)
   - Component: `<SettingsIntegrations />`
   - Integrations array (simplified - no lastSynced):
     ```typescript
     [
       {
         id: "google-drive",
         name: "Google Drive",
         description: "Autosave your database weekly",
         status: isAuthenticated ? "connected" : "disconnected",
         scopes: ["drive.file"], // permission info
       },
       {
         id: "telegram",
         name: "Telegram Bot",
         description: "Add tasks, expenses, and projects from your phone",
         status: isPaired ? (status === 'connected' ? "connected" : "disconnected") : "disconnected",
         scopes: ["read:messages", "write:data"], // permission info
       }
     ]
     ```
   - `onConnect`: 
     - Google Drive: panggil `handleConnect()`
     - Telegram: set `showOTPDialog(true)`
   - `onDisconnect`:
     - Google Drive: panggil `confirmDisconnect()`
     - Telegram: panggil `handleUnpair()`

5. **OTP Verify Dialog (New)**
   - Component: `<Dialog>` wrapping `<AuthOTPVerify />`
   - Props:
     - `deliveryMethod`: "other" atau tidak relevan
     - `deliveryAddress`: "@st4cker_bot on Telegram"
     - `onSubmit`: panggil `handlePair(code)`
     - `onResend`: generate new pairing code (jika ada API)
   - **Custom text instruction**: "Get your code by texting @st4cker_bot on Telegram with /start"
     - Replace default "We've sent a 6-digit code to..." message
   - **No additional instructions** - user sudah tahu cara pairing

6. **Backups Card (Modified from Local Data)**
   - Location: Side-by-side dengan Integrations card dalam grid
   - Grid wrapper: `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">`
   - Title: "Backups" (changed from "Local Data")
   - Structure:
     ```
     Backups
     ├─ Local Backup     [Backup button]
     ├─ Google Drive     [Backup Now button] (only if isAuthenticated)
     └─ Local Restore    [Restore button]
     ```
   - Google Drive row:
     - Label: "Google Drive"
     - Description: "Backup to cloud" atau "Last backup: {date}"
     - Button: "Backup Now" (disabled if not authenticated or loading)
     - Handler: `handleBackupNow()`

**Layout Structure After Changes:**
```
┌─────────────────────────────────────┐
│   Appearance (full width)           │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   App Preferences (full width)      │
└─────────────────────────────────────┘
┌─────────────────┬───────────────────┐
│     Backups     │   Integrations    │ <- Grid 2 columns (Backups LEFT, Integrations RIGHT)
│  - Local Backup │  - Google Drive   │
│  - Google Drive │  - Telegram Bot   │
│  - Local Restore│                   │
└─────────────────┴───────────────────┘
```

---

### [NO CHANGE] [TelegramTab.tsx](file:///d:/Project/st4cker/src/pages/Settings/TelegramTab.tsx)

File akan tetap ada sebagai reference, tetapi tidak dirender lagi di Settings.tsx. Logic akan dipindahkan ke Settings.tsx.

## Verification Plan

### Manual Verification

**Google Drive Integration:**
1. ✅ Connect button membuka auth flow
2. ✅ Status "connected" muncul setelah autentikasi
3. ✅ Last synced date ditampilkan jika ada
4. ✅ Backup Now button di Backups card berfungsi (hanya jika connected)
5. ✅ Disconnect button membuka confirmation dan unpair

**Telegram Integration:**
1. ✅ Connect button membuka OTP verify dialog
2. ✅ Dialog menampilkan instructions
3. ✅ 6-digit OTP input berfungsi
4. ✅ Verify code mengupdate status ke "connected"
5. ✅ Status live/offline ditampilkan dengan benar
6. ✅ Disconnect button unpair device

**Backups Card:**
1. ✅ Local Backup berfungsi
2. ✅ Google Drive backup hanya muncul jika connected
3. ✅ Local Restore berfungsi dengan warning

**Layout:**
1. ✅ Integrations dan Backups bersebelahan pada desktop (md breakpoint)
2. ✅ Stack vertical pada mobile
3. ✅ Responsive dan tidak ada overflow
