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
                return 'Matkul apa?';
            case 'project':
                return 'Project apa?';
            case 'priority':
                return 'Prioritasnya?';
            case 'note':
                return 'Ada note ga?';
            case 'duration':
                return 'Berapa lama kerjanya?';
            case 'persentase':
                return 'Mau update progress ke berapa persen?';
            default:
                return `${field}?`;
        }
    },

    askNote: () => 'Ada note ga?',
    askCategory: () => 'Kategorinya apa?',
    askProject: () => 'Mau log progress project mana?',
    askDuration: () => 'Berapa lama kerjanya?',
    askDeadline: () => 'Deadlinenya kapan?',
    askConfirmTitle: (title) => `Nama projectnya "${title}" ya?`,

    // ============ Updates ============
    fieldUpdated: (field, value) => {
        const displayValue = typeof value === 'object' ? value.value : value;
        return `Oke, ${field} udah kuganti jadi ${displayValue}!`;
    },

    // ============ Cancel/Undo ============
    cancelled: () => 'Okee, dibatalin ya~',
    undone: (action) => `Okee, ${action} dibatalkan~\nMau undo lagi yang sebelumnya?`,
    redone: (action) => `Oke, ${action} udah balik lagi~`,

    // ============ Low Confidence ============
    lowConfidence: (text) =>
        `Hmm, aku belum terlalu paham nih~ Coba pakai command atau ketik "bantuan" yaa`,

    savedAsNote: (text) =>
        `Aku catat ini sebagai catatan dulu ya:\n"${text}"`,

    // ============ Errors ============
    error: (message) => `Waduh, ada yang salah nih: ${message}`,

    // ============ Help ============
    help: () => `Aku bisa bantu kamu:\n
📝 *Tugas*
• "tugas fisdas deadline besok"
• "ada deadline apa aja"

💰 *Keuangan*
• "habis 50rb makan"
• "dapat 2jt gaji"
• "saldo berapa"

📊 *Project*
• "buat project skripsi"
• "log progress"

💡 *Tips*
• Pakai singkatan: fisdas, alin, wpl
• Pakai format: 50rb, 100k, 2jt, gocap
• Bilang "ga jadi" untuk undo`,

    // ============ Casual ============
    casual: () => {
        const replies = [
            'Haii 👋',
            'Iyaa?',
            'Ada yang bisa kubantu?',
            'Sama-sama~',
            'Siapp!',
            'Okee~'
        ];
        return replies[Math.floor(Math.random() * replies.length)];
    },

    // ============ Destructive Confirmation ============
    confirmDelete: (type, name) =>
        `Yakin hapus ${type} ${name}?`,

    deleted: (type, name) =>
        `${type} ${name} udah kuhapus~`,

    // ============ Congratulations ============
    taskComplete: (name) =>
        `Yeayy ${name} selesaiii! Satu lagi kelar nihh 🎉`,
};
