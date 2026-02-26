/**
 * Course Mapping Service
 * Mengubah course ID (course-{semester}-{index}) menjadi nama yang readable
 * Support custom names yang di-edit user di app desktop
 * 
 * Format: course-{semester_asli_matkul}-{index_di_semester_itu}
 * Contoh: course-4-7 = Semester 4, matkul index 7 (Praktikum Pemrograman Jaringan)
 * 
 * INTEGRASI DENGAN APP DESKTOP:
 * - App desktop menyimpan custom names di performance_courses (SQLite local)
 * - Master DB menyimpan custom names di user_course_names (PostgreSQL)
 * - Telegram bot membaca custom names dari Master DB
 */

// Import curriculum data (sync dengan app desktop)
const curriculumData = {
  "1": [
    { name: "Agama", sks: 2 },
    { name: "Algoritma dan Struktur Data", sks: 2 },
    { name: "Arsitektur Komputer", sks: 2 },
    { name: "Elektronika Digital 1", sks: 2 },
    { name: "Matematika 1", sks: 2 },
    { name: "Praktikum Algoritma dan Struktur Data", sks: 1 },
    { name: "Praktikum Arsitektur Komputer", sks: 1 },
    { name: "Praktikum Elektronika Digital 1", sks: 1 },
    { name: "Praktikum Sistem Komunikasi", sks: 1 },
    { name: "Sistem Komunikasi", sks: 2 },
    { name: "Workshop Teknologi Web dan Aplikasi", sks: 2 }
  ],
  "2": [
    { name: "Arsitektur Jaringan dan Internet", sks: 2 },
    { name: "Dasar Pemrograman", sks: 2 },
    { name: "Elektronika Digital 2", sks: 2 },
    { name: "Komunikasi Data", sks: 2 },
    { name: "Kreatifitas Mahasiswa 1", sks: 1 },
    { name: "Matematika 2", sks: 2 },
    { name: "Pancasila", sks: 2 },
    { name: "Praktikum Arsitektur Jaringan dan Internet", sks: 1 },
    { name: "Praktikum Dasar Pemrograman", sks: 1 },
    { name: "Praktikum Elektronika Digital 2", sks: 1 },
    { name: "Praktikum Komunikasi Data", sks: 1 },
    { name: "Workshop Basis data", sks: 2 }
  ],
  "3": [
    { name: "Jaringan Nirkabel", sks: 2 },
    { name: "Kewarganegaraan", sks: 2 },
    { name: "Kreatifitas Mahasiswa 2", sks: 1 },
    { name: "Praktikum Jaringan Nirkabel", sks: 1 },
    { name: "Praktikum Sistem Komunikasi Nirkabel", sks: 1 },
    { name: "Praktikum Sistem dan Jaringan Komputer", sks: 1 },
    { name: "Sistem Komunikasi Nirkabel", sks: 2 },
    { name: "Sistem dan Jaringan Komputer", sks: 2 },
    { name: "Statistika", sks: 2 },
    { name: "Workshop Embedded System", sks: 2 },
    { name: "Workshop Pemrograman Lanjut", sks: 2 }
  ],
  "4": [
    { name: "Keamanan Jaringan dan Kriptografi", sks: 2 },
    { name: "Komputasi Bergerak", sks: 2 },
    { name: "Kreatifitas Mahasiswa 3", sks: 1 },
    { name: "Pemrograman Jaringan", sks: 2 },
    { name: "Pengembangan Perangkat Lunak", sks: 2 },
    { name: "Praktikum Keamanan Jaringan dan Kriptografi", sks: 1 },
    { name: "Praktikum Komputasi Bergerak", sks: 1 },
    { name: "Praktikum Pemrograman Jaringan", sks: 1 },
    { name: "Praktikum Pengembangan Perangkat Lunak", sks: 1 },
    { name: "Praktikum Sistem Terdistribusi", sks: 1 },
    { name: "Sistem Terdistribusi", sks: 2 },
    { name: "Workshop Sistem Pendukung Keputusan", sks: 2 }
  ],
  "5": [
    { name: "Administrasi Jaringan 1", sks: 2 },
    { name: "Bahasa Indonesia", sks: 2 },
    { name: "Bahasa Inggris Teknik", sks: 2 },
    { name: "Dasar Komputasi Awan", sks: 2 },
    { name: "MPI-English for academic", sks: 2 },
    { name: "MPI-English for developing vocabulary", sks: 2 },
    { name: "MPI-Etika dan Profesionalisme", sks: 2 },
    { name: "Internet of Things (IoT)", sks: 2 },
    { name: "MPI-K3L dan Standar Internasional", sks: 2 },
    { name: "MPI-Kewirausahaan", sks: 2 },
    { name: "Kreatifitas Mahasiswa 4", sks: 1 },
    { name: "MPI-Manajemen Proyek", sks: 2 },
    { name: "Mobile Ad-Hoc Network (MANET)", sks: 2 },
    { name: "Pemrograman Web dan Aplikasi", sks: 2 },
    { name: "Praktikum Administrasi Jaringan 1", sks: 1 },
    { name: "Praktikum Dasar Komputasi Awan", sks: 1 },
    { name: "Praktikum Internet of Things", sks: 1 },
    { name: "Praktikum Mobile Ad-Hoc Network (MANET)", sks: 1 },
    { name: "Praktikum Pemrograman Web dan Aplikasi", sks: 1 }
  ],
  "6": [
    { name: "MPP-Kerja Praktek 3 Bulan", sks: 10 },
    { name: "MPP-Kerja Praktek 6 Bulan", sks: 20 },
    { name: "MBKM-MBKM: Asistensi Mengajar", sks: 10 },
    { name: "MBKM-MBKM: Asistensi Mengajar", sks: 20 },
    { name: "MBKM-MBKM: KKN Tematik", sks: 10 },
    { name: "MBKM-MBKM: KKN Tematik", sks: 20 },
    { name: "MBKM-MBKM: Kegiatan Wirausaha", sks: 10 },
    { name: "MBKM-MBKM: Kegiatan Wirausaha", sks: 20 },
    { name: "MBKM-MBKM: Magang", sks: 10 },
    { name: "MBKM-MBKM: Magang", sks: 20 },
    { name: "MBKM-MBKM: Penelitian / Riset", sks: 20 },
    { name: "MBKM-MBKM: Penelitian / Riset", sks: 10 },
    { name: "MBKM-MBKM: Pertukaran Pelajar", sks: 10 },
    { name: "MBKM-MBKM: Pertukaran Pelajar", sks: 20 },
    { name: "MBKM-MBKM: Proyek Kemanusiaan", sks: 10 },
    { name: "MBKM-MBKM: Proyek Kemanusiaan", sks: 20 },
    { name: "MBKM-MBKM: Studi Independen", sks: 10 },
    { name: "MBKM-MBKM: Studi Independen", sks: 20 },
    { name: "MBKM-Pengabdian Masyarakat 1", sks: 2 },
    { name: "MBKM-Pengabdian Masyarakat 2", sks: 2 },
    { name: "Proposal Proyek Akhir", sks: 1 },
    { name: "MBKM-Riset Independen 1", sks: 2 },
    { name: "MBKM-Riset Independen 2", sks: 2 }
  ],
  "7": [
    { name: "MPP-Administrasi Jaringan 2", sks: 2 },
    { name: "MPP-Jaringan Bergerak Berbasis Sensor", sks: 2 },
    { name: "MPP-Kerja Praktek 3 Bulan", sks: 10 },
    { name: "MPP-Kerja Praktek 6 Bulan", sks: 20 },
    { name: "MPP-Komputasi Awan Terapan", sks: 2 },
    { name: "MPP-Praktikum Administrasi Jaringan 2", sks: 1 },
    { name: "MPP-Praktikum Jaringan Bergerak Berbasis Sensor", sks: 1 },
    { name: "MPP-Praktikum Komputasi Awan Terapan", sks: 1 },
    { name: "Proyek Akhir-1", sks: 3 },
    { name: "MBKM-Riset Independen 3", sks: 2 },
    { name: "MPP-Workshop Edge Computing", sks: 2 },
    { name: "MPP-Workshop Jaringan Multimedia", sks: 2 },
    { name: "MPP-Workshop Keamanan Jaringan Bergerak", sks: 2 },
    { name: "MPP-Workshop Komputasi Awan untuk IoT", sks: 2 },
    { name: "MPP-Workshop Pemrograman Komputasi Awan", sks: 2 }
  ],
  "8": [
    { name: "Bahasa Inggris Profesional", sks: 2 },
    { name: "MPP-Praktikum Fog Computing", sks: 1 },
    { name: "MPP-Praktikum Sistem Enterprise", sks: 1 },
    { name: "Proyek Akhir-2", sks: 8 },
    { name: "MBKM-Riset Independen 4", sks: 2 },
    { name: "MPP-Sistem Enterprise", sks: 2 },
    { name: "MPP-Teori Fog Computing", sks: 2 },
    { name: "MPP-Workshop Proyek Akhir", sks: 1 }
  ]
};

class CourseMappingService {
  constructor(db) {
    this.db = db;
    this.cache = new Map(); // Cache custom names dari DB
  }

  /**
   * Parse course ID: course-{semester}-{index}
   * Contoh: course-4-7 → semester 4, index 7
   */
  parseCourseId(courseId) {
    const match = courseId.match(/course-(\d+)-(\d+)/);
    if (!match) return null;
    return {
      semester: parseInt(match[1]),
      index: parseInt(match[2])
    };
  }

  /**
   * Get course name dari curriculum
   */
  getDefaultName(semester, index) {
    const courses = curriculumData[semester.toString()];
    if (!courses || !courses[index]) return null;
    return courses[index].name;
  }

  /**
   * Get course SKS dari curriculum
   */
  getDefaultSks(semester, index) {
    const courses = curriculumData[semester.toString()];
    if (!courses || !courses[index]) return 0;
    return courses[index].sks;
  }

  /**
   * Get course name (custom atau default)
   */
  async getCourseName(courseId, userId = null) {
    // 1. Cek cache dulu
    if (this.cache.has(`${userId}-${courseId}`)) {
      return this.cache.get(`${userId}-${courseId}`);
    }

    // 2. Cek di database kalau ada userId
    if (userId && this.db) {
      try {
        const custom = await this.db.query(
          'SELECT custom_name FROM user_course_names WHERE user_id = $1 AND course_id = $2',
          [userId, courseId]
        );
        if (custom.rows.length > 0 && custom.rows[0].custom_name) {
          const name = custom.rows[0].custom_name;
          this.cache.set(`${userId}-${courseId}`, name);
          return name;
        }
      } catch (e) {
        console.log('[CourseMapping] DB error, fallback to default:', e.message);
      }
    }

    // 3. Fallback ke curriculum default
    const parsed = this.parseCourseId(courseId);
    if (parsed) {
      const defaultName = this.getDefaultName(parsed.semester, parsed.index);
      if (defaultName) return defaultName;
    }

    // 4. Kalau semua gagal, return courseId as-is
    return courseId;
  }

  /**
   * Get course ID dari nama matkul
   * Ini untuk mapping dari nama (dari Telegram Bot NLP) ke course ID
   */
  findCourseIdByName(nameQuery) {
    if (!nameQuery) return null;
    
    const normalizedQuery = nameQuery.toLowerCase().trim();
    
    // Cari di semua semester
    for (const [semester, courses] of Object.entries(curriculumData)) {
      for (let index = 0; index < courses.length; index++) {
        const course = courses[index];
        const normalizedName = course.name.toLowerCase();
        
        // Exact match atau partial match
        if (normalizedName === normalizedQuery || 
            normalizedName.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedName)) {
          return {
            courseId: `course-${semester}-${index}`,
            semester: parseInt(semester),
            index,
            name: course.name,
            sks: course.sks
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Get all courses untuk semester tertentu
   */
  async getSemesterCourses(semester, userId = null) {
    const courses = curriculumData[semester.toString()] || [];
    const result = [];

    for (let i = 0; i < courses.length; i++) {
      const courseId = `course-${semester}-${i}`;
      const name = await this.getCourseName(courseId, userId);
      result.push({
        id: courseId,
        name: name,
        sks: courses[i].sks,
        index: i,
        semester
      });
    }

    return result;
  }

  /**
   * Get courses untuk user yang aktif (berdasarkan user.semester)
   * Ini yang ditampilkan di dropdown saat create task
   */
  async getActiveSemesterCourses(userSemester, userId = null) {
    return await this.getSemesterCourses(userSemester, userId);
  }

  /**
   * Set custom course name (dipanggil dari app desktop via API)
   */
  async setCustomName(userId, courseId, customName) {
    if (!this.db) return false;

    try {
      await this.db.query(
        `INSERT INTO user_course_names (user_id, course_id, custom_name, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, course_id) 
         DO UPDATE SET custom_name = $3, updated_at = NOW()`,
        [userId, courseId, customName]
      );
      
      // Update cache
      this.cache.set(`${userId}-${courseId}`, customName);
      return true;
    } catch (e) {
      console.error('[CourseMapping] Error saving custom name:', e);
      return false;
    }
  }

  /**
   * Clear cache untuk user tertentu
   */
  clearUserCache(userId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}-`)) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = { CourseMappingService, curriculumData };
