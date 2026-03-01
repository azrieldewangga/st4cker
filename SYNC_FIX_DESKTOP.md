# Sync Fix - Desktop App dengan VPS

## Status
- ✅ Database VPS sudah diperbaiki
- ✅ Balance: 959,000 IDR (sesuai target: 709rb + 250rb cash)
- ✅ TikTok: 1 transaksi tersisa
- ✅ Shopee: 1 transaksi tersisa

## Langkah Sync Desktop App

### 1. Clear Sync Queue (Jika Ada)
Sebelum melakukan sync, clear sync queue di desktop app:

```sql
-- Jalankan di SQLite Desktop (DevTools Console atau langsung di DB)
DELETE FROM sync_queue;
```

### 2. Trigger Pull dari VPS
Di app desktop, lakukan salah satu:
- **Opsi A**: Klik "Sync Now" di menu Telegram pairing
- **Opsi B**: Reload app (Ctrl+R atau restart)
- **Opsi C**: Tunggu auto-sync (akan terjadi saat WebSocket connect)

### 3. Verifikasi Data
Cek di app desktop:
- Balance harus menunjukkan: **Rp 959.000**
- Transaksi TikTok: 1 item
- Transaksi Shopee: 1 item

### 4. Jika Ada Konflik
Jika data desktop tidak update:
1. Close app desktop
2. Hapus file `st4cker.db` di folder:
   - Windows: `%APPDATA%/st4cker/st4cker.db`
   - Linux: `~/.config/st4cker/st4cker.db`
   - Mac: `~/Library/Application Support/st4cker/st4cker.db`
3. Buka app lagi - akan auto-pull dari VPS

## Perubahan yang Dilakukan di VPS

### Transaksi Dihapus (4 item):
| ID | Title | Amount |
|---|---|---|
| a3ce5b1f-9060-4ada-b49d-206931dea629 | Payment for Tiktok | 392,000 |
| e5615aec-80c2-440c-868c-9287e0178538 | Payment for Tiktok | 392,000 |
| ff2e3b1a-0f98-47a5-93d0-5c74ce522f1c | Subscription: Tiktok | 392,000 |
| 3574b34f-ddb8-42e2-ac73-39d887df1cc6 | Subscription: Shopee | 30,000 |

### Transaksi Ditambahkan (1 item):
| Title | Category | Amount |
|---|---|---|
| Penyesuaian Saldo | Adjustment | 766,803 |

### Fix Data Inconsistensi:
- 9 transaksi expense yang tersimpan sebagai positif sudah diubah ke negatif
- Semua transaksi income sudah positif

## Mekanisme Anti Racing Condition

### Di App Desktop (main.cts):
1. `pullFromVPS()` mengambil data dari VPS dan mengganti data lokal
2. `processQueue()` mengirim perubahan lokal ke VPS
3. Saat WebSocket connect, `pullFromVPS()` dipanggil OTOMATIS

### Rekomendasi:
- Jangan buat transaksi baru saat proses sync berjalan
- Tunggu status "Connected" sebelum melakukan perubahan
- Jika ada konflik, data VPS dianggap sumber kebenaran (master)

## Backup SQL (Untuk Safety)
File backup otomatis dibuat di: `st4cker-backups/YYYYmmDD-HHMMSS/`

## Kontak
Jika ada masalah sync, periksa log di:
- VPS: `docker logs st4cker-bot`
- Desktop: DevTools Console (F12)
