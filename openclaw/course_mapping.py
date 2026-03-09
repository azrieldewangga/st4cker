#!/usr/bin/env python3
"""
Course Mapping Service - Python version
Mengubah course ID menjadi nama yang readable
"""

# Curriculum data (sync dengan app desktop)
CURRICULUM_DATA = {
    "1": [
        {"name": "Agama", "sks": 2},
        {"name": "Algoritma dan Struktur Data", "sks": 2},
        {"name": "Arsitektur Komputer", "sks": 2},
        {"name": "Elektronika Digital 1", "sks": 2},
        {"name": "Matematika 1", "sks": 2},
        {"name": "Praktikum Algoritma dan Struktur Data", "sks": 1},
        {"name": "Praktikum Arsitektur Komputer", "sks": 1},
        {"name": "Praktikum Elektronika Digital 1", "sks": 1},
        {"name": "Praktikum Sistem Komunikasi", "sks": 1},
        {"name": "Sistem Komunikasi", "sks": 2},
        {"name": "Workshop Teknologi Web dan Aplikasi", "sks": 2}
    ],
    "2": [
        {"name": "Arsitektur Jaringan dan Internet", "sks": 2},
        {"name": "Dasar Pemrograman", "sks": 2},
        {"name": "Elektronika Digital 2", "sks": 2},
        {"name": "Komunikasi Data", "sks": 2},
        {"name": "Kreatifitas Mahasiswa 1", "sks": 1},
        {"name": "Matematika 2", "sks": 2},
        {"name": "Pancasila", "sks": 2},
        {"name": "Praktikum Arsitektur Jaringan dan Internet", "sks": 1},
        {"name": "Praktikum Dasar Pemrograman", "sks": 1},
        {"name": "Praktikum Elektronika Digital 2", "sks": 1},
        {"name": "Praktikum Komunikasi Data", "sks": 1},
        {"name": "Workshop Basis data", "sks": 2}
    ],
    "3": [
        {"name": "Jaringan Nirkabel", "sks": 2},
        {"name": "Kewarganegaraan", "sks": 2},
        {"name": "Kreatifitas Mahasiswa 2", "sks": 1},
        {"name": "Praktikum Jaringan Nirkabel", "sks": 1},
        {"name": "Praktikum Sistem Komunikasi Nirkabel", "sks": 1},
        {"name": "Praktikum Sistem dan Jaringan Komputer", "sks": 1},
        {"name": "Sistem Komunikasi Nirkabel", "sks": 2},
        {"name": "Sistem dan Jaringan Komputer", "sks": 2},
        {"name": "Statistika", "sks": 2},
        {"name": "Workshop Embedded System", "sks": 2},
        {"name": "Workshop Pemrograman Lanjut", "sks": 2}
    ],
    "4": [
        {"name": "Keamanan Jaringan dan Kriptografi", "sks": 2},
        {"name": "Komputasi Bergerak", "sks": 2},
        {"name": "Kreatifitas Mahasiswa 3", "sks": 1},
        {"name": "Pemrograman Jaringan", "sks": 2},
        {"name": "Pengembangan Perangkat Lunak", "sks": 2},
        {"name": "Praktikum Keamanan Jaringan dan Kriptografi", "sks": 1},
        {"name": "Praktikum Komputasi Bergerak", "sks": 1},
        {"name": "Praktikum Pemrograman Jaringan", "sks": 1},
        {"name": "Praktikum Pengembangan Perangkat Lunak", "sks": 1},
        {"name": "Praktikum Sistem Terdistribusi", "sks": 1},
        {"name": "Sistem Terdistribusi", "sks": 2},
        {"name": "Workshop Sistem Pendukung Keputusan", "sks": 2}
    ],
    "5": [
        {"name": "Administrasi Jaringan 1", "sks": 2},
        {"name": "Bahasa Indonesia", "sks": 2},
        {"name": "Bahasa Inggris Teknik", "sks": 2},
        {"name": "Dasar Komputasi Awan", "sks": 2},
        {"name": "MPI-English for academic", "sks": 2},
        {"name": "MPI-English for developing vocabulary", "sks": 2},
        {"name": "MPI-Etika dan Profesionalisme", "sks": 2},
        {"name": "Internet of Things (IoT)", "sks": 2},
        {"name": "MPI-K3L dan Standar Internasional", "sks": 2},
        {"name": "MPI-Kewirausahaan", "sks": 2},
        {"name": "Kreatifitas Mahasiswa 4", "sks": 1},
        {"name": "MPI-Manajemen Proyek", "sks": 2},
        {"name": "Mobile Ad-Hoc Network (MANET)", "sks": 2},
        {"name": "Pemrograman Web dan Aplikasi", "sks": 2},
        {"name": "Praktikum Administrasi Jaringan 1", "sks": 1},
        {"name": "Praktikum Dasar Komputasi Awan", "sks": 1},
        {"name": "Praktikum Internet of Things", "sks": 1},
        {"name": "Praktikum Mobile Ad-Hoc Network (MANET)", "sks": 1},
        {"name": "Praktikum Pemrograman Web dan Aplikasi", "sks": 1}
    ],
    "6": [
        {"name": "MPP-Kerja Praktek 3 Bulan", "sks": 10},
        {"name": "MPP-Kerja Praktek 6 Bulan", "sks": 20},
        {"name": "MBKM-MBKM: Asistensi Mengajar", "sks": 10},
        {"name": "MBKM-MBKM: Asistensi Mengajar", "sks": 20},
        {"name": "MBKM-MBKM: KKN Tematik", "sks": 10},
        {"name": "MBKM-MBKM: KKN Tematik", "sks": 20},
        {"name": "MBKM-MBKM: Kegiatan Wirausaha", "sks": 10},
        {"name": "MBKM-MBKM: Kegiatan Wirausaha", "sks": 20},
        {"name": "MBKM-MBKM: Magang", "sks": 10},
        {"name": "MBKM-MBKM: Magang", "sks": 20},
        {"name": "MBKM-MBKM: Membangun Desa", "sks": 10},
        {"name": "MBKM-MBKM: Membangun Desa", "sks": 20},
        {"name": "MBKM-MBKM: Membangun Desa", "sks": 10},
        {"name": "MBKM-MBKM: Membangun Desa", "sks": 20},
        {"name": "MBKM-MBKM: Pertukaran Pelajar", "sks": 10},
        {"name": "MBKM-MBKM: Pertukaran Pelajar", "sks": 20},
        {"name": "MBKM-MBKM: Proyek Kemanusiaan", "sks": 10},
        {"name": "MBKM-MBKM: Proyek Kemanusiaan", "sks": 20},
        {"name": "MBKM-MBKM: Riset", "sks": 10},
        {"name": "MBKM-MBKM: Riset", "sks": 20},
        {"name": "MBKM-MBKM: Studi Independen", "sks": 10},
        {"name": "MBKM-MBKM: Studi Independen", "sks": 20},
    ],
    "7": [
        {"name": "Desain dan Manajemen Jaringan", "sks": 2},
        {"name": "Interpersonal Skill", "sks": 2},
        {"name": "Kepemimpinan", "sks": 2},
        {"name": "MPP-Kerja Praktek 3 Bulan", "sks": 10},
        {"name": "MPP-Kerja Praktek 6 Bulan", "sks": 20},
        {"name": "Proyek Profesional Mandiri", "sks": 2},
        {"name": "Seminar", "sks": 2},
        {"name": "Teknik Komunikasi Data", "sks": 2},
        {"name": "Teknik Layanan Jaringan", "sks": 2},
        {"name": "Workshop Administrasi Jaringan 2", "sks": 2}
    ],
    "8": [
        {"name": "MPP-Kerja Praktek 3 Bulan", "sks": 10},
        {"name": "MPP-Kerja Praktek 6 Bulan", "sks": 20},
        {"name": "MPP-Kerja Praktek Lanjut", "sks": 20},
        {"name": "MPP-Kerja Praktek Lanjut", "sks": 20},
        {"name": "Tugas Akhir", "sks": 6}
    ]
}


def get_course_name(course_id: str) -> str:
    """
    Convert course ID to readable name.
    Format: course-{semester}-{index}
    Example: course-4-7 -> Praktikum Pemrograman Jaringan
    """
    if not course_id:
        return "Matkul"
    
    # Parse course ID
    parts = course_id.split('-')
    if len(parts) >= 3 and parts[0] == 'course':
        semester = parts[1]
        try:
            index = int(parts[2]) - 1  # Convert to 0-based index
            semester_courses = CURRICULUM_DATA.get(semester, [])
            if 0 <= index < len(semester_courses):
                return semester_courses[index]["name"]
        except (ValueError, IndexError):
            pass
    
    # Fallback: return course_id as-is
    return course_id


def parse_course_id(course_id: str) -> dict:
    """
    Parse course ID into components.
    Returns: {"semester": str, "index": int, "name": str}
    """
    if not course_id:
        return {"semester": "?", "index": 0, "name": "Unknown"}
    
    parts = course_id.split('-')
    if len(parts) >= 3 and parts[0] == 'course':
        semester = parts[1]
        try:
            index = int(parts[2])
            name = get_course_name(course_id)
            return {"semester": semester, "index": index, "name": name}
        except ValueError:
            pass
    
    return {"semester": "?", "index": 0, "name": course_id}
