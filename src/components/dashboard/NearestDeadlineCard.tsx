import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Assignment } from '../../types/models';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import GlassCard from '../shared/GlassCard';

const NearestDeadlineCard = () => {
    const { assignments, fetchAssignments, updateAssignment, courses, userProfile } = useStore();
    const [nearest, setNearest] = useState<Assignment[]>([]);

    useEffect(() => {
        // Ensure data is loaded
        if (assignments.length === 0) fetchAssignments();
    }, [fetchAssignments]);

    useEffect(() => {
        if (!userProfile) return; // Wait for profile

        // Filter not done, sort by date
        // Also Filter by Semester
        let relevantAssignments = assignments;

        if (userProfile.semester) {
            relevantAssignments = relevantAssignments.filter(a => {
                if (a.semester !== undefined && a.semester !== null) {
                    return a.semester === userProfile.semester;
                }
                return false;
            });
        }

        const pending = relevantAssignments
            .filter(a => a.status !== 'done')
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 3);
        setNearest(pending);
    }, [assignments, userProfile, courses]);

    const getTimeLeft = (deadline: string) => {
        const now = new Date();
        const due = new Date(deadline);
        const days = differenceInDays(due, now);

        if (days < 0) return { text: 'Overdue', color: 'text-error' };
        if (days === 0) {
            const hours = differenceInHours(due, now);
            return { text: `${hours}h left`, color: 'text-warning' };
        }
        return { text: `${days}d left`, color: 'text-muted-foreground' };
    };

    return (
        <GlassCard className="h-full">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Clock size={20} className="text-primary" />
                    Deadline Terdekat
                </h2>
                <Link to="/assignments" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    Lihat <ArrowRight size={14} />
                </Link>
            </div>

            <div className="flex flex-col gap-3">
                {nearest.length === 0 ? (
                    <div className="py-8 text-center opacity-50 text-sm">
                        <p>Tidak ada tugas yang terdekat.</p>
                    </div>
                ) : (
                    nearest.map(item => {
                        const timeLeft = getTimeLeft(item.deadline);
                        return (
                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors group">
                                <button
                                    onClick={() => updateAssignment(item.id, { status: 'done' })}
                                    className="rounded-full p-1 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-500/10"
                                    title="Mark Done"
                                >
                                    <CheckCircle size={16} />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium truncate">{(item.title || '').replace(/MW-|MPK-/g, '')}</h4>
                                    <p className="text-xs opacity-60 truncate">{item.type} • {(item.courseId || '').replace(/MW-|MPK-/g, '')}</p>
                                </div>

                                <div className={clsx("text-xs font-bold whitespace-nowrap", timeLeft.color)}>
                                    {timeLeft.text}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </GlassCard>
    );
};

export default NearestDeadlineCard;
