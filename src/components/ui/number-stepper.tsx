import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NumberStepperProps {
    value: number | string;
    onChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    placeholder?: string;
}

export function NumberStepper({ value, onChange, min = 0, max, step = 1, className, placeholder, ...props }: NumberStepperProps) {
    const handleIncrement = (e: React.MouseEvent) => {
        e.preventDefault();
        const currentVal = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value;
        const newVal = currentVal + step;
        if (max !== undefined && newVal > max) return;
        // Format with thousand separator
        onChange(newVal.toLocaleString('en-US', { maximumFractionDigits: 0 }));
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.preventDefault();
        const currentVal = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value;
        const newVal = currentVal - step;
        if (min !== undefined && newVal < min) return;
        // Format with thousand separator
        onChange(newVal.toLocaleString('en-US', { maximumFractionDigits: 0 }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        // Remove all non-digit characters
        const numericValue = input.replace(/\D/g, '');
        // Format with thousand separators
        if (numericValue === '') {
            onChange('');
            return;
        }
        const formatted = parseInt(numericValue).toLocaleString('en-US');
        onChange(formatted);
    };

    return (
        <div className={cn("flex items-center group", className)}>
            <Input
                type="text"
                value={value}
                onChange={handleInputChange}
                className="rounded-r-none border-r-0 text-center font-mono focus-visible:ring-1 focus-visible:ring-offset-0 bg-background/50 focus:bg-background transition-colors focus:z-10"
                placeholder={placeholder}
            />
            <div className="flex items-center border border-input rounded-r-md bg-muted/20 h-9">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-9 rounded-none border-r hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:z-10 focus-visible:ring-1 focus-visible:ring-inset"
                    onClick={handleDecrement}
                    type="button"
                    disabled={min !== undefined && (typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value) <= min}
                >
                    <Minus className="h-3 w-3" />
                    <span className="sr-only">Decrease</span>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-9 rounded-none rounded-r-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:z-10 focus-visible:ring-1 focus-visible:ring-inset"
                    onClick={handleIncrement}
                    type="button"
                    disabled={max !== undefined && (typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value) >= max}
                >
                    <Plus className="h-3 w-3" />
                    <span className="sr-only">Increase</span>
                </Button>
            </div>
        </div>
    )
}
