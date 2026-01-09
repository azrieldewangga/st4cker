import { StateCreator } from 'zustand';
import { Course } from '@/types/models';
import { validateData, CourseSchema } from '@/lib/validation';
import curriculumDataJson from '@/lib/curriculum.json';

const curriculumData = curriculumDataJson as Record<string, { sks: number; name: string; id?: string }[]>;

export interface PerformanceSlice {
    courses: Course[];
    grades: Record<string, string>;
    performanceRecords: Course[];

    fetchCourses: () => Promise<void>;
    fetchGrades: () => Promise<void>;
    updateGrade: (courseId: string, grade: string) => Promise<void>;
    addCourse: (semester: number) => Promise<void>;
    updateCourse: (course: Course) => Promise<void>;
    deleteCourse: (id: string) => Promise<void>;
    getSemesterCourses: (semester: number) => Course[];
}

export const createPerformanceSlice: StateCreator<
    PerformanceSlice & { userProfile: any },
    [],
    [],
    PerformanceSlice
> = (set, get) => ({
    courses: [],
    grades: {},
    performanceRecords: [],

    fetchCourses: async () => {
        const state = get() as any;
        const profile = state.userProfile;
        if (!profile) return;

        await get().fetchGrades();
        const mappedCourses = get().getSemesterCourses(profile.semester);
        set({ courses: mappedCourses });
    },

    fetchGrades: async () => {
        const state = get() as any;
        const profile = state.userProfile;
        if (!profile) return;

        const dbCourses = await window.electronAPI.performance.getCourses();
        set({ performanceRecords: dbCourses });

        const gradeMap: Record<string, string> = {};
        dbCourses.forEach((dbGrade: any) => {
            let mappedId = dbGrade.id;
            if (dbGrade.id && dbGrade.id.startsWith('course-')) {
                mappedId = dbGrade.id;
            } else {
                let found = false;
                for (const semKey of Object.keys(curriculumData)) {
                    if (found) break;
                    const semCourses = curriculumData[semKey];
                    if (!semCourses) continue;

                    semCourses.forEach((c, idx) => {
                        if (found) return;
                        if (c.name === dbGrade.name || c.name === dbGrade.id) {
                            mappedId = `course-${semKey}-${idx}`;
                            found = true;
                        }
                    });
                }
            }
            if (mappedId) {
                gradeMap[mappedId] = dbGrade.grade;
            }
        });
        set({ grades: gradeMap });
    },

    updateGrade: async (courseId, grade) => {
        const state = get() as any;
        const profile = state.userProfile;
        if (!profile) return;

        let sks = 3;
        const parts = courseId.split('-');
        if (parts.length === 3) {
            const sem = parts[1];
            const idx = parseInt(parts[2]);
            const cData = curriculumData[sem]?.[idx];
            if (cData) sks = cData.sks;
        }

        const course = get().courses.find(c => c.id === courseId);
        if (course) sks = course.sks || sks;

        await window.electronAPI.performance.upsertCourse({
            id: courseId,
            semester: parts.length === 3 ? parseInt(parts[1]) : profile.semester,
            name: course ? course.name : courseId,
            sks: sks,
            grade: grade,
            location: course?.location || '',
            lecturer: course?.lecturer || '',
            updatedAt: new Date().toISOString()
        });

        get().fetchGrades();
    },

    addCourse: async (semester) => {
        // Implement if needed
    },

    updateCourse: async (course) => {
        const validation = validateData(CourseSchema.partial(), course);
        if (!validation.success) {
            throw new Error(validation.errors[0]);
        }
        await window.electronAPI.performance.upsertCourse(course);
        get().fetchCourses();
    },

    deleteCourse: async (id) => {
        await window.electronAPI.performance.deleteCourse(id);
        get().fetchCourses();
    },

    getSemesterCourses: (semester) => {
        const state = get() as any;
        const semKey = String(semester);
        const jsonCourses = curriculumData[semKey] || [];
        const dbRecords = state.performanceRecords || [];

        const coursesMap = new Map<string, Course>();

        jsonCourses.forEach((jc, idx) => {
            const id = `course-${semKey}-${idx}`;
            coursesMap.set(id, {
                id,
                semester,
                name: jc.name,
                sks: jc.sks,
                grade: '',
                location: '',
                lecturer: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        });

        dbRecords.forEach((dbC: any) => {
            if (dbC.semester === semester) {
                coursesMap.set(dbC.id, dbC);
            }
        });

        return Array.from(coursesMap.values());
    },
});
