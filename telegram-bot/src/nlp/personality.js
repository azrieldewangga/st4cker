// personality.js - Response templates with casual personality

/**
 * Response templates for bot personality
 * Style: Casual, friendly, uses "kamu", elongated vowels (okee, siapp)
 */
export const responses = {
    // ============ Confirmations ============
    confirmExpense: (amount, category) =>
        `Siapp, expense ${category} Rp${amount.toLocaleString('id-ID')} udah kucatat!`,

    confirmIncome: (amount, category) =>
        `Siapp, income ${category} Rp${amount.toLocaleString('id-ID')} udah kucatat!`,

    confirmTask: (matkul, deadline) =>
        `Siapp, tugas ${matkul} deadline ${deadline} udah dicatat yaa`,

    confirmProject: (project) =>
        `Siapp, project "${project}" udah kucatat!`,

    confirmProgress: (project, duration, progress) =>
        `Siapp! Progress ${project} udah kucatat:\n• Durasi: ${duration}\n• Progress: ${progress}`,

    // ============ Asking Fields ============
    askField: (field, intent, filled) => {
        switch (field) {
            case 'kategori':
                return 'Kategorinya apa?';
            case 'amount':
                return 'Berapa nominalnya?';
            case 'waktu':
                return 'Deadlinenya kapan?';
            case 'matkul':
                return 'Buat matkul apa? 📚';
            case 'project':
                return 'Apa nama projectnya? 📝';
            case 'priority':
                return 'Prioritasnya?';
            case 'note':
                // Context-aware prompts
                if (intent === 'tambah_pengeluaran') return 'Beli apa? 🛒';
                if (intent === 'tambah_pemasukan') return 'Dari mana? 💰';
                if (intent === 'buat_tugas') return 'Ada catatan/deskripsi? 📝';
                if (intent === 'catat_progress') return 'Keterangannya apa? (Wajib)';
                if (intent === 'buat_project') return 'Deskripsi projectnya? 📋';
                return 'Ada note ga?';
            case 'duration':
                return 'Berapa lama kerjanya?';
            case 'persentase':
                return 'Mau update progress ke berapa persen?';
            case 'link':
                // Check if we already have links (looping)
                // filled.links might be { value: [], ... } or direct array depending on state
                if (filled && (filled.links?.value?.length > 0 || Array.isArray(filled.links) && filled.links.length > 0)) {
                    return 'Mana link nya?';
                }
                return 'Ada link/material ga? 🔗 (Ketik "-" atau "skip" kalau ga ada)';
            case 'link_title':
                return 'apa judul linknya?';
            case 'add_more_links':
                return 'Ada link lagi?';
            case 'project_type':
                return 'Tipe projectnya apa?';
            default:
                return `${field}?`;
        }
    },

    askNote: () => 'Ada note ga?',
    askCategory: () => 'Kategorinya apa?',
    askProject: () => 'Mau log progress project mana?',
    askDuration: () => 'Berapa lama kerjanya?',
    askDeadline: () => 'Deadlinenya kapan?',
    askCourse: () => 'Matkulnya apa?',
    askConfirmTitle: (title) => `Nama projectnya "${title}" ya?`,

    // ============ Updates ============
    fieldUpdated: (field, value) => {
        const displayValue = typeof value === 'object' ? value.value : value;
        return `Oke, ${field} udah kuganti jadi ${displayValue}!`;
    },

    // ============ Cancel/Undo ============
    cancelled: () => 'Okee, dibatalin yaa',
    undone: (action) => `Okee, ${action} dibatalkan~\nMau undo lagi yang sebelumnya?`,
    redone: (action) => `Oke, ${action} udah balik lagi~`,

    // ============ Low Confidence ============
    confusion: (text) =>
        `Hmm, aku belum terlalu paham nih~ Coba pakai command atau ketik "bantuan" yaa`,
    lowConfidence: (text) =>
        `Hmm, aku belum terlalu paham nih~ Coba pakai command atau ketik "bantuan" yaa`,

    savedAsNote: (text) =>
        `Aku catat ini sebagai catatan dulu ya:\n"${text}"`,

    // ============ Errors ============
    error: (message) => `Waduh, ada yang salah nih: ${message}`,

    // ============ Help ============
    help: () => `Aku bisa bantu kamu:\n
<b>📝 Tugas</b>
• "tugas fisdas deadline besok"
• "lihat tugas" / "deadline"
• "hapus tugas" / "edit tugas"

<b>💰 Keuangan</b>
• "jajan 50rb kopi"
• "gaji 2jt"
• "cek saldo" / "histori transaksi"
• "edit transaksi" / "hapus transaksi"

<b>📊 Project</b>
• "buat project skripsi"
• "log progress"
• "lihat project"

<b>📅 Summary</b>
• "summary" (Hari ini)
• "rekap besok" / "rekap minggu ini"
• "rekap bulan ini"

<b>💡 Tips</b>
• Bisa undo pake "ga jadi"
• Bisa revisi pake "ganti [field]"
• Support singkatan: "mingdep", "buldep", "50k", "goceng"`,

    // ============ Casual ============
    casual: (text, suffix = '') => {
        if (!text) return 'Haii 👋';

        let response = text;
        const lowerText = text.toLowerCase();

        // 1. Detect Fillers (to append to response)
        const FILLERS = ['bes', 'bang', 'mas', 'kang', 'coy', 'ler'];
        let detectedFiller = '';

        // Check if text ends with a filler
        for (const f of FILLERS) {
            if (lowerText.endsWith(f) || suffix.toLowerCase() === f) {
                detectedFiller = f;
                break;
            }
        }

        // If suffix was passed from NLP handler (e.g. "pagi bang" -> suffix="bang")
        if (!detectedFiller && suffix && FILLERS.includes(suffix.toLowerCase())) {
            detectedFiller = suffix;
        }

        // Dynamic Greeting Patterns (Handles repeated chars like "haiii")
        const patterns = [
            { regex: /h+a+l+o+/i, replace: 'Halo jugaa' },
            { regex: /h+a+i+/i, replace: 'Hai jugaa' },
            { regex: /o+i+/i, replace: 'Oii' },
            { regex: /p+a+g+i+/i, replace: 'Pagi juga' },
            { regex: /s+i+a+n+g+/i, replace: 'Siang juga' },
            { regex: /s+o+r+e+/i, replace: 'Sore juga' },
            { regex: /m+a+l+a+m+/i, replace: 'Malam juga' },
            { regex: /m+k+s+h+|m+a+k+a+s+i+h+/i, replace: 'Sama-sama~' },
            { regex: /t+h+a+n+k+s+/i, replace: 'Your welcome!' }
        ];

        let matched = false;
        for (const p of patterns) {
            // Test against the text (flexible match)
            if (p.regex.test(text)) {
                // Base response from pattern
                response = p.replace;

                // Append filler if detected
                if (detectedFiller) {
                    response += ` ${detectedFiller}`;
                }

                matched = true;
                break;
            }
        }

        // Clean up punctuation if present in original text or replacement
        response = response.replace(/[!.]+$/, '');

        // Improve punctuation
        if (matched) {
            return `${response}!`; // Add exclamation at the very end
        }

        // Fallback: Echo or simple acknowledge
        return text;
    },

    // ============ Destructive Confirmation ============
    confirmDelete: (type, name) =>
        `Yakin nih hapus ${type} ${name}?`,

    deleted: (type, name) =>
        `${type} ${name} udah kuhapus~`,

    // ============ Congratulations ============
    taskComplete: (name) =>
        `gacorrr ${name} udah kelar!`,
};
