import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { Transaction, Course } from "@/types/models";

interface PrintableReportProps {
    type: 'financial' | 'academic';
    month: number;
    year: number;
    semester: number;
}

export function PrintableReport({ type, month, year, semester }: PrintableReportProps) {
    const { userProfile, transactions, getSemesterCourses, currency } = useStore();

    // -- Helpers --
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // -- Financial Report Logic --
    if (type === 'financial') {
        const isYearly = month === -1;
        const reportTitle = isYearly ? `${year} Annual Report` : format(new Date(year, month), 'MMMM yyyy');

        const filteredTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            if (isYearly) return d.getFullYear() === year;
            return d.getMonth() === month && d.getFullYear() === year;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalIncome = filteredTransactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);

        const totalExpense = filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        const netSavings = totalIncome - totalExpense;

        return (
            <div className="w-full max-w-[210mm] mx-auto p-8 font-sans text-black">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Financial Report</h1>
                        <p className="text-lg text-gray-600">{reportTitle}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold">{userProfile?.name || 'Student'}</h2>
                        <p className="text-sm text-gray-500">Generated on {format(new Date(), 'dd MMM yyyy')}</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">Total Income</p>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                    </div>
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">Total Expense</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
                    </div>
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">Net Savings</p>
                        <p className={`text-2xl font-bold ${netSavings >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {formatCurrency(netSavings)}
                        </p>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">Transaction History</h3>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700 uppercase">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {format(new Date(t.date), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-4 py-3 capitalize">{t.category}</td>
                                        <td className="px-4 py-3 text-gray-500">{t.title}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">
                                        No transactions found for this month.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // -- Academic Report Logic --
    if (type === 'academic') {
        const courses = getSemesterCourses(semester);

        // Calculate GPA/IPS for this semester
        // Calculate GPA/IPS for this semester
        const gradePoints: Record<string, number> = {
            'A': 4.00,
            'A-': 3.75,
            'AB': 3.50,
            'B+': 3.25,
            'B': 3.00,
            'BC': 2.50,
            'C': 2.00,
            'D': 1.00,
            'E': 0.00
        };
        let totalSks = 0;
        let totalPoints = 0;

        courses.forEach(c => {
            // Assume we use 'grade' from the course record
            // The store's 'courses' for getSemesterCourses might store grade directly or in a separate map
            // Based on useStore, 'getSemesterCourses' returns performanceRecords items which have { grade, sks, ... }
            if (c.grade && gradePoints[c.grade] !== undefined) {
                totalSks += (c.sks || 0);
                totalPoints += (c.sks || 0) * gradePoints[c.grade];
            }
        });

        const ips = totalSks > 0 ? (totalPoints / totalSks).toFixed(2) : '0.00';

        return (
            <div className="w-full max-w-[210mm] mx-auto p-8 font-sans text-black">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Academic Transcript</h1>
                        <p className="text-lg text-gray-600">Semester {semester}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold">{userProfile?.name || 'Student'}</h2>
                        <p className="text-sm text-gray-500">Generated on {format(new Date(), 'dd MMM yyyy')}</p>
                    </div>
                </div>

                {/* Student Info / GPA Summary */}
                <div className="mb-8 p-6 border rounded-lg bg-gray-50 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-gray-500 uppercase">Student Name</p>
                        <p className="text-lg font-bold">{userProfile?.name}</p>
                        <p className="text-sm text-gray-500 mt-2 uppercase">Major / Program</p>
                        <p className="text-lg font-bold">{userProfile?.major || 'Computer Science'}</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block px-6 py-4 bg-white rounded-lg border shadow-sm">
                            <p className="text-sm text-gray-500 uppercase text-center mb-1">Semester GPA (IPS)</p>
                            <p className="text-4xl font-extrabold text-blue-600 text-center">{ips}</p>
                        </div>
                    </div>
                </div>

                {/* Courses Table */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">Course Results</h3>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700 uppercase">
                            <tr>
                                <th className="px-4 py-3">Course Name</th>
                                <th className="px-4 py-3 text-center">SKS</th>
                                <th className="px-4 py-3 text-center">Grade</th>
                                <th className="px-4 py-3 text-center">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {courses.length > 0 ? (
                                courses.map((c) => {
                                    const points = (gradePoints[c.grade || ''] || 0).toFixed(1);
                                    return (
                                        <tr key={c.id}>
                                            <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                                            <td className="px-4 py-3 text-center">{c.sks}</td>
                                            <td className="px-4 py-3 text-center font-bold">
                                                <span className={`px-2 py-1 rounded ${c.grade?.startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                                                    c.grade?.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                                                        c.grade ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {c.grade || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-500 font-medium">{points}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">
                                        No courses found for this semester.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t-2 border-gray-200">
                            <tr>
                                <td className="px-4 py-3 text-right">Totals</td>
                                <td className="px-4 py-3 text-center">{totalSks}</td>
                                <td className="px-4 py-3 text-center">-</td>
                                <td className="px-4 py-3 text-center">{totalPoints.toFixed(1)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    return null;
}
