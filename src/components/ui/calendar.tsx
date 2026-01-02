"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import type { DropdownOption } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-4", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 relative",
                month: "space-y-4",
                month_caption: "flex justify-center relative items-center w-full h-7 px-8",
                caption_label: "text-sm font-medium hidden",
                nav: "flex items-center absolute inset-x-0 top-0 h-7 justify-between pointer-events-none z-10",
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 pointer-events-auto absolute left-1"
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 pointer-events-auto absolute -right-3"
                ),
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                    "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
                week: "flex w-full mt-[3px]",
                day: cn(
                    "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                ),
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground"
                ),
                range_end: "day-range-end",
                selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
                today: "bg-accent/50 text-accent-foreground rounded-md",
                outside:
                    "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                disabled: "text-muted-foreground opacity-50",
                range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                hidden: "invisible",

                dropdowns: "flex items-center justify-center gap-1",
                ...classNames,
            }}
            components={{
                CaptionLabel: () => null,

                Dropdown: ({ options, value, onChange, ...props }) => {
                    const opts = options as DropdownOption[] | undefined
                    const currentValue = value?.toString() ?? ""
                    const selectedOption = opts?.find((opt) => opt.value.toString() === currentValue)
                    const displayLabel = selectedOption?.label ?? ""

                    const handleChange = (newValue: string) => {
                        const changeEvent = {
                            target: { value: newValue },
                        } as React.ChangeEvent<HTMLSelectElement>
                        onChange?.(changeEvent)
                    }

                    return (
                        <Select value={currentValue} onValueChange={handleChange}>
                            <SelectTrigger className="px-2 focus:ring-0 h-7 w-auto min-w-0 text-sm font-medium gap-0.5 bg-transparent border border-input shadow-sm hover:bg-accent hover:text-accent-foreground items-center justify-center leading-none">
                                <span className="truncate leading-none">{displayLabel}</span>
                            </SelectTrigger>
                            <SelectContent position="popper" className="max-h-[200px] overflow-y-auto z-50">
                                {opts?.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value.toString()}
                                        disabled={option.disabled}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )
                },
                Chevron: ({ orientation }) => {
                    const Icon = orientation === "left" ? ChevronLeft : ChevronRight
                    return <Icon className="h-4 w-4" />
                },
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
