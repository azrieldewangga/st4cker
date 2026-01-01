// Run this in browser console or integrate into app to seed grades for semesters 1-3
// This maps grades from user data to the database

const gradesData = {
    "1": [
        { name: "Agama", grade: "A-" },
        { name: "Algoritma dan Struktur Data", grade: "AB" },
        { name: "Arsitektur Komputer", grade: "BC" },
        { name: "Elektronika Digital 1", grade: "C" },
        { name: "Matematika 1", grade: "BC" },
        { name: "Praktikum Algoritma dan Struktur Data", grade: "A" },
        { name: "Praktikum Arsitektur Komputer", grade: "B" },
        { name: "Praktikum Elektronika Digital 1", grade: "B+" },
        { name: "Praktikum Sistem Komunikasi", grade: "AB" },
        { name: "Sistem Komunikasi", grade: "C" },
        { name: "Workshop Teknologi Web dan Aplikasi", grade: "AB" }
    ],
    "2": [
        { name: "Arsitektur Jaringan dan Internet", grade: "B+" },
        { name: "Dasar Pemrograman", grade: "A-" },
        { name: "Elektronika Digital 2", grade: "C" },
        { name: "Komunikasi Data", grade: "AB" },
        { name: "Kreatifitas Mahasiswa 1", grade: "" }, // Belum Isi Kuesioner
        { name: "Matematika 2", grade: "B" },
        { name: "Pancasila", grade: "A-" },
        { name: "Praktikum Arsitektur Jaringan dan Internet", grade: "AB" },
        { name: "Praktikum Dasar Pemrograman", grade: "BC" },
        { name: "Praktikum Elektronika Digital 2", grade: "B" },
        { name: "Praktikum Komunikasi Data", grade: "AB" },
        { name: "Workshop Basis data", grade: "AB" }
    ],
    "3": [
        { name: "Jaringan Nirkabel", grade: "AB" },
        { name: "Kewarganegaraan", grade: "A" },
        { name: "Kreatifitas Mahasiswa 2", grade: "" }, // -
        { name: "Praktikum Jaringan Nirkabel", grade: "AB" },
        { name: "Praktikum Sistem Komunikasi Nirkabel", grade: "A" },
        { name: "Praktikum Sistem dan Jaringan Komputer", grade: "B+" },
        { name: "Sistem Komunikasi Nirkabel", grade: "A-" },
        { name: "Sistem dan Jaringan Komputer", grade: "B" },
        { name: "Statistika", grade: "B+" },
        { name: "Workshop Embedded System", grade: "B+" },
        { name: "Workshop Pemrograman Lanjut", grade: "A-" }
    ]
};

export default gradesData;
