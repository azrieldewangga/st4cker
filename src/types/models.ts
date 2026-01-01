export interface BaseEntity {
    id: string;
    createdAt: string;
    updatedAt: string;
}

export type AssignmentStatus = 'to-do' | 'progress' | 'done';
export type AssignmentType = 'Laporan Pendahuluan' | 'Laporan Sementara' | 'Laporan Resmi' | 'Tugas';

export interface Assignment extends BaseEntity {
    courseId: string;
    title: string;
    type: AssignmentType;
    deadline: string; // ISO date string
    status: AssignmentStatus;
    note?: string;
    customOrder?: number;
    semester?: number;
}

export interface UserProfile extends BaseEntity {
    name: string;
    semester: number;
    avatar?: string;
    cardLast4?: string;
    major?: string;
}


export interface Course extends BaseEntity {
    name: string;
    semester: number;
    sks?: number;
    grade?: string;
    location?: string;
    lecturer?: string;
}

export interface Transaction extends BaseEntity {
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string; // ISO date string
}

export interface CourseMaterial extends BaseEntity {
    courseId: string;
    type: 'link' | 'file';
    title: string;
    url: string;
}

export interface Subscription extends BaseEntity {
    name: string;
    cost: number;
    dueDay: number;
    lastPaidDate?: string;
}
