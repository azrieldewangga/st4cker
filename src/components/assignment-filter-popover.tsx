import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
    Funnel,
    CircleNotch,
    Tag,
    Book,
    Clock,
} from "@phosphor-icons/react"

export type FilterChipData = { key: string; value: string }

type FilterTemp = {
    status: Set<string>
    type: Set<string>
    course: Set<string>
}

interface AssignmentFilterPopoverProps {
    initialChips?: FilterChipData[]
    onApply: (chips: FilterChipData[]) => void
    onClear: () => void
    courses?: string[]
}

export function AssignmentFilterPopover({
    initialChips,
    onApply,
    onClear,
    courses = []
}: AssignmentFilterPopoverProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [active, setActive] = useState<"status" | "type" | "course">("status")

    const [temp, setTemp] = useState<FilterTemp>(() => ({
        status: new Set<string>(),
        type: new Set<string>(),
        course: new Set<string>(),
    }))

    // Preselect from chips when opening
    useEffect(() => {
        if (!open) return
        const next: FilterTemp = {
            status: new Set<string>(),
            type: new Set<string>(),
            course: new Set<string>(),
        }
        for (const c of initialChips || []) {
            const k = c.key.toLowerCase()
            if (k === "status") next.status.add(c.value.toLowerCase())
            if (k === "type") next.type.add(c.value.toLowerCase())
            if (k === "course") next.course.add(c.value)
        }
        setTemp(next)
    }, [open, initialChips])

    const categories = [
        { id: "status", label: "Status", icon: CircleNotch },
        { id: "type", label: "Type", icon: Tag },
        { id: "course", label: "Course", icon: Book },
    ] as const

    const statusOptions = [
        { id: "todo", label: "To Do", color: "#6b7280" },
        { id: "in-progress", label: "In Progress", color: "#3b82f6" },
        { id: "done", label: "Done", color: "#22c55e" },
        { id: "overdue", label: "Overdue", color: "#ef4444" },
    ]

    const typeOptions = [
        { id: "assignment", label: "Assignment" },
        { id: "quiz", label: "Quiz" },
        { id: "project", label: "Project" },
        { id: "exam", label: "Exam" },
        { id: "other", label: "Other" },
    ]

    const filteredCategories = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return categories
        return categories.filter((c) => c.label.toLowerCase().includes(q))
    }, [categories, query])

    const toggleSet = (set: Set<string>, v: string) => {
        const n = new Set(set)
        if (n.has(v)) n.delete(v)
        else n.add(v)
        return n
    }

    const handleApply = () => {
        const chips: FilterChipData[] = []
        temp.status.forEach((v) => chips.push({ key: "Status", value: capitalize(v) }))
        temp.type.forEach((v) => chips.push({ key: "Type", value: capitalize(v) }))
        temp.course.forEach((v) => chips.push({ key: "Course", value: v }))
        onApply(chips)
        setOpen(false)
    }

    const handleClear = () => {
        setTemp({
            status: new Set<string>(),
            type: new Set<string>(),
            course: new Set<string>(),
        })
        onClear()
    }

    const activeCount = temp.status.size + temp.type.size + temp.course.size

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg border-border/60 px-3 bg-transparent">
                    <Funnel className="h-4 w-4" />
                    Filter
                    {activeCount > 0 && (
                        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                            {activeCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[520px] p-0 rounded-xl">
                <div className="grid grid-cols-[180px_minmax(0,1fr)]">
                    <div className="p-3 border-r border-border/40">
                        <div className="px-1 pb-2">
                            <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" />
                        </div>
                        <div className="space-y-1">
                            {filteredCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent",
                                        active === cat.id && "bg-accent"
                                    )}
                                    onClick={() => setActive(cat.id)}
                                >
                                    <cat.icon className="h-4 w-4" />
                                    <span className="flex-1 text-left">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-3">
                        {active === "status" && (
                            <div className="grid grid-cols-2 gap-2">
                                {statusOptions.map((opt) => (
                                    <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                                        <Checkbox
                                            checked={temp.status.has(opt.id)}
                                            onCheckedChange={() => setTemp((t) => ({ ...t, status: toggleSet(t.status, opt.id) }))}
                                        />
                                        <span className="text-sm flex-1">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {active === "type" && (
                            <div className="grid grid-cols-2 gap-2">
                                {typeOptions.map((opt) => (
                                    <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                                        <Checkbox
                                            checked={temp.type.has(opt.id)}
                                            onCheckedChange={() => setTemp((t) => ({ ...t, type: toggleSet(t.type, opt.id) }))}
                                        />
                                        <span className="text-sm flex-1">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {active === "course" && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {courses.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No courses available</p>
                                ) : (
                                    courses.map((course) => (
                                        <label key={course} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                                            <Checkbox
                                                checked={temp.course.has(course)}
                                                onCheckedChange={() => setTemp((t) => ({ ...t, course: toggleSet(t.course, course) }))}
                                            />
                                            <span className="text-sm flex-1 truncate">{course}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                            <button onClick={handleClear} className="text-sm text-primary hover:underline">
                                Clear
                            </button>
                            <Button size="sm" className="h-8 rounded-lg" onClick={handleApply}>
                                Apply
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

function capitalize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : s
}
