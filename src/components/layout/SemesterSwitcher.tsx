import * as React from "react"

import { cn } from "@/lib/utils"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useStore } from "@/store/useStore"

export function SemesterSwitcher({ className }: React.HTMLAttributes<HTMLDivElement>) {
    const { userProfile } = useStore()
    const currentSem = userProfile?.semester || 1;

    return (
        <Button
            variant="outline"
            role="combobox"
            aria-label="Current Semester"
            className={cn("w-auto justify-start cursor-default opacity-100 hover:bg-background", className)}
        >
            <Avatar className="mr-2 h-5 w-5">
                <AvatarImage
                    src={`https://avatar.vercel.sh/${currentSem}.png`}
                    alt={`Semester ${currentSem}`}
                />
                <AvatarFallback>S{currentSem}</AvatarFallback>
            </Avatar>
            Semester {currentSem}
            {/* Removed Chevrons to indicate it is not a dropdown */}
        </Button>
    )
}
