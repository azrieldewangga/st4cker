import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, Clock, TrendingUp } from "lucide-react";
import { useStore } from "@/store/useStoreNew";
import { PrintableReport } from "@/components/reports/PrintableReport";
import { toast } from "sonner";

export function ReportsTab() {
    const userProfile = useStore(state => state.userProfile);
    const transactions = useStore(state => state.transactions);
    const getSemesterCourses = useStore(state => state.getSemesterCourses);
    const [reportType, setReportType] = useState<'financial' | 'academic' | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedSemester, setSelectedSemester] = useState(userProfile?.semester?.toString() || "1");
    const [recentExports, setRecentExports] = useState<Array<{ name: string, date: Date, type: 'financial' | 'academic' }>>([]);

    const handleExport = (type: 'financial' | 'academic') => {
        // Validation Logic
        if (type === 'financial') {
            const m = parseInt(selectedMonth);
            const y = parseInt(selectedYear);
            const hasData = transactions.some(t => {
                const d = new Date(t.date);
                if (m === -1) return d.getFullYear() === y;
                return d.getMonth() === m && d.getFullYear() === y;
            });

            if (!hasData) {
                toast("Data masih kosong", {
                    description: m === -1
                        ? `No transactions found for ${y}.`
                        : `No transactions found for ${new Date(y, m).toLocaleString('default', { month: 'long', year: 'numeric' })}.`
                });
                return;
            }
        } else if (type === 'academic') {
            const sem = parseInt(selectedSemester);
            const courses = getSemesterCourses(sem);
            if (!courses || courses.length === 0) {
                toast("Data masih kosong", {
                    description: `No course records found for Semester ${sem}.`
                });
                return;
            }

            const hasGrades = courses.some(c => c.grade && c.grade !== '' && c.grade !== '-');
            if (!hasGrades) {
                toast("Data Nilai Kosong", {
                    description: `Belum ada nilai yang diinput untuk Semester ${sem}.`
                });
                return;
            }
        }

        setReportType(type);
        toast.loading("Preparing preview...", { id: 'pdf-gen' });

        // Wait for DOM to render the printable view
        setTimeout(async () => {
            try {
                let filename = 'Report.pdf';
                if (type === 'financial') {
                    const m = parseInt(selectedMonth);
                    const y = parseInt(selectedYear);
                    const dateStr = m === -1 ? `${y}-Annual` : `${new Date(y, m).toLocaleString('default', { month: 'short' })}-${y}`;
                    filename = `Financial-Report-${dateStr}.pdf`;
                } else {
                    filename = `Academic-Transcript-Sem${selectedSemester}.pdf`;
                }

                const result = await window.electronAPI.reports.exportPdf(filename);

                toast.dismiss('pdf-gen');
                if (result.success) {
                    toast("Report PDF Saved", { description: `Saved to ${result.filePath}` });
                    setRecentExports(prev => [{
                        name: filename,
                        date: new Date(),
                        type: type
                    }, ...prev]);
                } else if (result.canceled) {
                    toast.info("Export canceled");
                } else {
                    toast.error("Export Failed", { description: result.error });
                }
            } catch (error) {
                toast.dismiss('pdf-gen');
                toast.error("Failed to generate PDF");
            } finally {
                setReportType(null);
            }
        }, 500);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Generate Reports</h3>

            <div className="grid gap-6 md:grid-cols-2">
                {/* 1. Monthly Financial Report */}
                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                <FileText size={20} />
                            </div>
                            Monthly Financial Report
                        </CardTitle>
                        <CardDescription>
                            Income, expense breakdown, and transaction history for a specific month.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="-1">Full Year</SelectItem>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026].map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="w-full gap-2" onClick={() => handleExport('financial')}>
                            <Printer size={16} />
                            Export PDF
                        </Button>
                    </CardContent>
                </Card>

                {/* 2. Academic Transcript */}
                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                <FileText size={20} />
                            </div>
                            Academic Transcript
                        </CardTitle>
                        <CardDescription>
                            GPA, IPS trend, and course grades summary for a selected semester.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 8 }, (_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            Semester {i + 1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="w-full gap-2" onClick={() => handleExport('academic')}>
                            <Printer size={16} />
                            Export PDF
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity & Stats (Bottom Section) */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Clock size={18} /> Recent Export History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentExports.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Clock size={20} className="text-muted-foreground/50" />
                                </div>
                                <p>No reports exported in this session.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                                {recentExports.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${item.type === 'financial' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                <FileText size={14} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-medium truncate max-w-[150px]" title={item.name}>{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.date.toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            Success
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <TrendingUp size={18} /> Data Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Financial Stats */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Financial Data Points</span>
                                <span className="font-medium">{transactions?.length || 0} Transactions</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: transactions?.length > 0 ? '100%' : '0%' }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Comprehensive financial records ready for reporting.</p>
                        </div>

                        {/* Academic Stats */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Academic Progress</span>
                                <span className="font-medium">Sem {userProfile?.semester || 1} / 8</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((userProfile?.semester || 1) / 8) * 100}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">Track your GPA trends and course performance.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Hidden Printable Area - Only Visible on Print */}
            <div className="hidden print:block absolute top-0 left-0 w-full min-h-screen bg-white z-[9999] p-8 text-black">
                {reportType && (
                    <PrintableReport
                        type={reportType}
                        month={parseInt(selectedMonth)}
                        year={parseInt(selectedYear)}
                        semester={parseInt(selectedSemester)}
                    />
                )}
            </div>

            {/* Print Styles Helper */}
            <style>{`
                @media print {
                    html, body, #root {
                        overflow: visible !important;
                        height: auto !important;
                    }
                    
                    /* Reset layout constraints that might clip content */
                    .h-screen, .w-screen, .overflow-hidden, .flex, .flex-col {
                        height: auto !important;
                        width: auto !important;
                        overflow: visible !important;
                        display: block !important; /* Flatten the layout */
                    }

                    body * {
                        visibility: hidden;
                    }
                    
                    /* The printable area */
                    .print\\:block, .print\\:block * {
                        visibility: visible;
                    }
                    .print\\:block {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        min-height: 100vh;
                        background: white;
                        z-index: 9999;
                        overflow: visible !important;
                    }
                    
                    /* Disable transitions/animations during print */
                    * {
                        transition: none !important;
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
