import React from 'react';
import { useStore } from '../../store/useStoreNew';
import { Assignment } from '../../types/models';
import { Clock, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

const TaskCard = ({ task, status }: { task: Assignment; status: 'to-do' | 'progress' | 'done' }) => {
    // Simple priority/color logic based on deadline or type
    const isUrgent = new Date(task.deadline).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000;

    // Status circle color (pale versions)
    const circleColor = status === 'to-do'
        ? 'bg-muted-foreground/30'
        : status === 'progress'
            ? 'bg-warning'
            : 'bg-success';

    return (
        <div className="bg-card/50 hover:bg-card/80 p-3 rounded-xl border border-border transition-all cursor-pointer group shadow-sm hover:shadow-md backdrop-blur-sm">
            <div className="flex justify-between items-start mb-2">
                <span className={clsx(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                    task.type === 'Tugas' && "bg-info/10 text-info",
                    task.type === 'Laporan Resmi' && "bg-secondary/10 text-secondary",
                    task.type === 'Laporan Sementara' && "bg-accent/10 text-accent",
                    !['Tugas', 'Laporan Resmi', 'Laporan Sementara'].includes(task.type) && "bg-muted text-muted-foreground"
                )}>
                    {task.type}
                </span>
                <span className={clsx("w-2.5 h-2.5 rounded-full", circleColor)}></span>
            </div>
            <h4 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                {(task.title || '').replace(/MW-|MPK-/g, '')}
            </h4>
            <div className="flex items-center gap-2 opacity-50 text-xs">
                <Clock size={12} />
                <span>{new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
            </div>
        </div>
    );
};

const TaskBoard = () => {
    const assignments = useStore(state => state.assignments);
    const courses = useStore(state => state.courses);
    const userProfile = useStore(state => state.userProfile);
    const navigate = useNavigate();

    // Filter and sort assignments by status (most recent deadline first)
    const sortByDeadline = (a: Assignment, b: Assignment) =>
        new Date(b.deadline).getTime() - new Date(a.deadline).getTime();

    // Semester Filter
    // If profile is not loaded yet, show nothing or loading to prevent leaking old data
    if (!userProfile) {
        return <div className="flex items-center justify-center h-full text-sm opacity-50">Loading...</div>;
    }

    let relevantAssignments = assignments;
    if (userProfile.semester) {
        relevantAssignments = relevantAssignments.filter(a => {
            // New Logic: Check explicit semester tag
            if (a.semester !== undefined && a.semester !== null) {
                return a.semester === userProfile.semester;
            }
            // Hide legacy untagged data
            return false;
        });
    }

    const todoAll = relevantAssignments.filter(a => a.status === 'to-do').sort(sortByDeadline);
    const progressAll = relevantAssignments.filter(a => a.status === 'progress').sort(sortByDeadline);
    const doneAll = relevantAssignments.filter(a => a.status === 'done').sort(sortByDeadline);

    const todo = todoAll.slice(0, 3);
    const progress = progressAll.slice(0, 3);
    const done = doneAll.slice(0, 3);

    // Calculate progress percentages
    const total = relevantAssignments.length || 1;
    const todoPercent = Math.round((todoAll.length / total) * 100);
    const progressPercent = Math.round((progressAll.length / total) * 100);
    const donePercent = Math.round((doneAll.length / total) * 100);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-lg">Status Tugas</h3>
                <button onClick={() => navigate('/assignments')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    Lihat <ArrowRight size={14} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
                {/* To Do Column */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <div
                            className="text-muted-foreground text-[8px] font-bold"
                            style={{ "--value": todoPercent, "--size": "2rem", "--thickness": "3px" } as React.CSSProperties}
                            role="progressbar"
                        >{todoPercent}%</div>
                        TO DO <span className="bg-muted px-1.5 rounded text-[10px]">{todoAll.length}</span>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                        {todo.map(task => <TaskCard key={task.id} task={task} status="to-do" />)}
                        {todo.length === 0 && <div className="text-xs opacity-30 italic p-2 text-center">Tidak ada tugas yang terdekat</div>}
                    </div>
                </div>

                {/* In Progress Column */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <div
                            className="radial-progress text-warning text-[8px] font-bold"
                            style={{ "--value": progressPercent, "--size": "2rem", "--thickness": "3px" } as React.CSSProperties}
                            role="progressbar"
                        >{progressPercent}%</div>
                        DOING <span className="bg-muted px-1.5 rounded text-[10px]">{progressAll.length}</span>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                        {progress.map(task => <TaskCard key={task.id} task={task} status="progress" />)}
                        {progress.length === 0 && <div className="text-xs opacity-30 italic p-2 text-center">Tidak ada tugas yang terdekat</div>}
                    </div>
                </div>

                {/* Done Column */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <div
                            className="radial-progress text-success text-[8px] font-bold"
                            style={{ "--value": donePercent, "--size": "2rem", "--thickness": "3px" } as React.CSSProperties}
                            role="progressbar"
                        >{donePercent}%</div>
                        DONE <span className="bg-muted px-1.5 rounded text-[10px]">{doneAll.length}</span>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                        {done.map(task => <TaskCard key={task.id} task={task} status="done" />)}
                        {done.length === 0 && <div className="text-xs opacity-30 italic p-2 text-center">Tidak ada tugas yang selesai.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskBoard;

