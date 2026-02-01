/**
 * NLP Scenario Suite
 * Defines various natural language sentences and their intended categories for testing.
 */

export const scenarioSuite = {
    transaction: [
        // 15 Create Scenarios
        { name: 'Expense: Food', text: 'Beli nasi padang 20rb', expectation: 'Food, 20000' },
        { name: 'Expense: Transport', text: 'Isi bensin motor 35.000', expectation: 'Transport, 35000' },
        { name: 'Expense: Bills', text: 'Bayar kosan 1.5jt via transfer', expectation: 'Bills, 1500000' },
        { name: 'Expense: Shopping', text: 'Beli kaos polos di Shopee 85rb', expectation: 'Shopping, 85000' },
        { name: 'Expense: Subscription', text: 'Langganan Spotify Family 12k', expectation: 'Subscription, 12000' },
        { name: 'Expense: Transport 2', text: 'Bayar parkir mall 5k', expectation: 'Transport, 5000' },
        { name: 'Income: Gift', text: 'Dapet jajan dari tante 200rb', expectation: 'Income, 200000' },
        { name: 'Income: Salary', text: 'Gajian part-time 1.200.000', expectation: 'Income, 1200000' },
        { name: 'Expense: Food 2', text: 'Makan Richeese berdua 110.000', expectation: 'Food, 110000' },
        { name: 'Expense: Bills 2', text: 'Beli token listrik 100rb', expectation: 'Bills, 100000' },
        { name: 'Expense: Transfer', text: 'Top up e-wallet 50k', expectation: 'Transfer, 50000' },
        { name: 'Expense: Debt', text: 'Bayar utang ke Andi 25rb', expectation: 'Transfer, 25000' },
        { name: 'Expense: Shopping 2', text: 'Beli sabun dan shampoo 45rb', expectation: 'Shopping, 45000' },
        { name: 'Expense: Entertainment', text: 'Nonton bioskop + popcorn 75k', expectation: 'Shopping, 75000' },
        { name: 'Income: Cashback', text: 'Dapet cashback gopay 2rb', expectation: 'Income, 2000' },

        // 5 History Scenarios
        { name: 'History: Weekly', text: 'Lihat riwayat belanja minggu ini', expectation: 'list_transactions' },
        { name: 'History: Today', text: 'Berapa total pengeluaran gw hari ini?', expectation: 'list_transactions' },
        { name: 'History: Yesterday', text: 'List transaksi kemarin', expectation: 'list_transactions' },
        { name: 'History: Outflow', text: 'Cek histori uang keluar', expectation: 'list_transactions' },
        { name: 'History: Summary', text: 'Tampilkan rekap keuangan bulan ini', expectation: 'minta_summary' }
    ],
    task: [
        // Create Task (Using courses from matkul.json, all types normalize to Tugas or valid Laporan types)
        { name: 'Task: Sister', text: 'Tugas sister deadline senin depan', expectation: 'Sistem Terdistribusi, Tugas' },
        { name: 'Quiz: KJK', text: 'Kuis kjk jam 10 pagi ini', expectation: 'Keamanan Jaringan dan Kriptografi, Tugas' },
        { name: 'Prak: Pemjar', text: 'Praktikum pemjar di lab besok', expectation: 'Praktikum Pemrograman Jaringan, Tugas' },
        { name: 'Report: Komber', text: 'Lapres komber kumpulin ntar malem', expectation: 'Praktikum Komputasi Bergerak, Laporan Resmi' },
        { name: 'Exam: PPL', text: 'UTS ppl hari jumat', expectation: 'Pengembangan Perangkat Lunak, Tugas' },
        { name: 'Task: Sister (Prak)', text: 'Tugas prak sister bikin laporan', expectation: 'Praktikum Sistem Terdistribusi, Tugas' },
        { name: 'Task: WSPK', text: 'Deadline wspk buat diagram hari minggu', expectation: 'Workshop Sistem Pendukung Keputusan, Tugas' },
        { name: 'Task: PJ', text: 'Tugas pj bab 3 beresin hari ini', expectation: 'Pemrograman Jaringan, Tugas' },
        { name: 'Task: KB', text: 'Tugas kb bikin app besok', expectation: 'Komputasi Bergerak, Tugas' },
        { name: 'Task: KJK (Prak)', text: 'Workshop kjk prak bikin landing page lusa', expectation: 'Praktikum Keamanan Jaringan dan Kriptografi, Tugas' },

        // Logical Checks (Theory vs Practical)
        { name: 'Logic: Valid Report', text: 'Lapres prak sister minggu depan', expectation: 'Pass (Practical course)' },
        { name: 'Logic: Invalid Report 1', text: 'Buat Laporan Resmi sister', expectation: 'Warn (Theory course)' },
        { name: 'Logic: Invalid Report 2', text: 'Tugas Lapres ppl', expectation: 'Warn (Theory course)' },
        { name: 'Logic: Valid Report 2', text: 'Lapres workshop spk modul 5', expectation: 'Pass (Practical course)' },
        { name: 'Logic: Practical Tag', text: 'Tugas Lapres sister tapi ini Prak', expectation: 'Pass (User forced Prak)' }
    ],
    project: [
        // 5 Project Creation
        { name: 'Proj: Sister', text: 'Bikin project baru: Tugas Sister Akhir 2026 priority high', expectation: 'Tugas Sister Akhir 2026, High' },
        { name: 'Proj: Komber', text: 'Ada project komber bikin startup priority medium', expectation: 'komber bikin startup, Medium' },
        { name: 'Proj: PJ', text: 'Project pj side-hustle UI Design santai aja', expectation: 'UI Design, Low' },
        { name: 'Proj: Wspk', text: 'Buat project Lomba wspk 2026', expectation: 'Lomba wspk 2026' },
        { name: 'Proj: PPL', text: 'Project baru: Belajar ppl tiap sore', expectation: 'Belajar ppl' },

        // 3 Log Progress Each (Total 15 logs)
        { name: 'Log 1: Sister 10%', text: 'Progres Tugas Sister Akhir 2026 naik ke 10%', expectation: '10%' },
        { name: 'Log 1: Sister 50%', text: 'Update sister sekarang udah 50%', expectation: '50%' },
        { name: 'Log 1: Sister 90%', text: 'Alhamdulillah sister udah 90% beres', expectation: '90%' },

        { name: 'Log 2: Komber 20%', text: 'komber bikin startup progres 20%', expectation: '20%' },
        { name: 'Log 2: Komber 45%', text: 'Lapor progress komber 45% ya', expectation: '45%' },
        { name: 'Log 2: Komber 100%', text: 'komber bikin startup udah finish 100%!', expectation: '100%' },

        { name: 'Log 3: PJ 5%', text: 'pj side-hustle baru jalan 5%', expectation: '5%' },
        { name: 'Log 3: PJ 15%', text: 'UI Design progres ke 15%', expectation: '15%' },
        { name: 'Log 3: PJ 30%', text: 'Update project UI Design ke 30%', expectation: '30%' },

        { name: 'Log 4: Wspk 40%', text: 'Lomba wspk progres 40%', expectation: '40%' },
        { name: 'Log 4: Wspk 60%', text: 'Update lomba wspk jadi 60%', expectation: '60%' },
        { name: 'Log 4: Wspk 80%', text: 'Progress wspk 80% bos', expectation: '80%' },

        { name: 'Log 5: PPL 25%', text: 'ppl progres 25%', expectation: '25%' },
        { name: 'Log 5: PPL 55%', text: 'Belajar ppl udah 55% lancar', expectation: '55%' },
        { name: 'Log 5: PPL 75%', text: 'Input progress ppl 75%', expectation: '75%' }
    ]
};
