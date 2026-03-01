-- ============================================
-- FIX BALANCE DESKTOP - st4cker.db
-- Target Balance: 959,000 IDR
-- ============================================

-- 1. Fix expense amounts yang positif menjadi negatif
UPDATE transactions 
SET amount = -ABS(amount) 
WHERE type = 'expense' AND amount > 0;

-- 2. Fix income amounts yang negatif menjadi positif  
UPDATE transactions 
SET amount = ABS(amount) 
WHERE type = 'income' AND amount < 0;

-- 3. Hapus transaksi TikTok (sisakan 1 terbaru)
-- Sisa: d3b4166e-d610-4e7f-91df-151fd986934b
DELETE FROM transactions 
WHERE id IN (
    'a3ce5b1f-9060-4ada-b49d-206931dea629',
    'e5615aec-80c2-440c-868c-9287e0178538',
    'ff2e3b1a-0f98-47a5-93d0-5c74ce522f1c'
);

-- 4. Hapus transaksi Shopee lama (sisakan 1 terbaru)
-- Sisa: c41cbbf6-c797-4467-96ef-15d8c6440c85
DELETE FROM transactions 
WHERE id = '3574b34f-ddb8-42e2-ac73-39d887df1cc6';

-- 5. Tambahkan transaksi penyesuaian
INSERT INTO transactions (id, title, category, amount, currency, date, type, createdAt, updatedAt)
VALUES (
    lower(hex(randomblob(16))),
    'Penyesuaian Saldo',
    'Adjustment',
    766803,
    'IDR',
    '2026-03-01T00:00:00.000Z',
    'income',
    datetime('now'),
    datetime('now')
);

-- 6. Verifikasi hasil
SELECT 
    COUNT(*) as total_transaksi,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
    SUM(amount) as final_balance
FROM transactions;
