// intentSchemas.js - Required/optional fields per intent

export const schemas = {
    // Task intents
    buat_tugas: {
        required: ['matkul', 'waktu'],
        optional: ['tipe_tugas', 'note']
    },
    edit_tugas: {
        required: ['matkul'],
        optional: ['task_status', 'waktu', 'note']
    },
    lihat_tugas: {
        required: [],
        optional: ['matkul', 'waktu']
    },
    hapus_tugas: {
        required: ['matkul'],
        optional: ['tipe_tugas']
    },
    deadline_terdekat: {
        required: [],
        optional: ['waktu']
    },

    // Transaction intents
    tambah_pengeluaran: {
        required: ['amount'],
        optional: ['kategori', 'note', 'waktu']
    },
    tambah_pemasukan: {
        required: ['amount'],
        optional: ['kategori', 'note', 'waktu']
    },
    edit_transaksi: {
        required: [],
        optional: ['amount', 'kategori', 'note']
    },
    hapus_transaksi: {
        required: [],
        optional: []
    },
    lihat_transaksi: {
        required: [],
        optional: ['waktu', 'kategori']
    },
    cek_saldo: {
        required: [],
        optional: []
    },

    // Project intents
    buat_project: {
        required: ['project'],
        optional: ['waktu', 'priority', 'matkul']
    },
    edit_project: {
        required: ['project'],
        optional: ['project_status', 'waktu', 'priority']
    },
    hapus_project: {
        required: ['project'],
        optional: []
    },
    lihat_project: {
        required: [],
        optional: ['project_status']
    },
    catat_progress: {
        // Guided flow - minimal required
        required: [],
        optional: ['project', 'duration', 'persentase', 'note'],
        guidedFlow: true
    },

    // Other intents
    ingatkan: {
        required: ['waktu'],
        optional: ['note']
    },
    minta_summary: {
        required: [],
        optional: ['waktu']
    },
    batalkan: {
        required: [],
        optional: []
    },
    bantuan: {
        required: [],
        optional: []
    },
    casual: {
        required: [],
        optional: []
    }
};

/**
 * Get missing required fields
 * @param {Array} required - List of required field names
 * @param {Object} entities - Extracted entities
 * @returns {Array} List of missing field names
 */
export function getMissingFields(required, entities) {
    return required.filter(field => {
        const value = entities[field];
        return !value || value.value === undefined || value.value === null;
    });
}
