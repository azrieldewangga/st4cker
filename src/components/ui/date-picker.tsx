"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

function formatDate(date: Date | undefined) {
    if (!date) {
        return ""
    }

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function isValidDate(date: Date | undefined) {
    if (!date) {
        return false
    }
    return !isNaN(date.getTime())
}

interface DatePickerProps {
    date?: Date;
    setDate: (date?: Date) => void;
    placeholder?: string;
    className?: string;
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className }: DatePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [month, setMonth] = React.useState<Date | undefined>(date)
    const [value, setValue] = React.useState(formatDate(date))

    // Sync internal value when external date changes
    React.useEffect(() => {
        setValue(formatDate(date))
        setMonth(date)
    }, [date])

    return (
        <div className={cn("relative flex gap-2", className)}>
            <Input
                value={value}
                placeholder={placeholder}
                className="bg-transparent pr-10 border-input"
                onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    setValue(e.target.value)
                    if (isValidDate(newDate)) {
                        setDate(newDate)
                        setMonth(newDate)
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setOpen(true)
                    }
                }}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                    >
                        <CalendarIcon className="size-3.5" />
                        <span className="sr-only">Select date</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="end"
                    alignOffset={-8}
                    sideOffset={10}
                >
                    <Calendar
                        mode="single"
                        selected={date}
                        captionLayout="dropdown"
                        month={month}
                        onMonthChange={setMonth}
                        fromYear={2020}
                        toYear={2030}
                        formatters={{
                            formatMonthDropdown: (month) =>
                                month.toLocaleString("en-US", { month: "short" })
                        }}
                        onSelect={(newDate) => {
                            setDate(newDate)
                            setValue(formatDate(newDate))
                            setOpen(false)
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
