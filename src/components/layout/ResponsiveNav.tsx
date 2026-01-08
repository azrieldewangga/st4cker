import { cn } from "@/lib/utils"
import { NavLink, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function ResponsiveNav({
    className,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    const location = useLocation()

    const links = [
        { href: "/", label: "Dashboard" },
        { href: "/assignments", label: "Assignments" },
        { href: "/performance", label: "Performance" },
        { href: "/schedule", label: "Schedule" },
        { href: "/cashflow", label: "Cashflow" },
    ]

    const currentPath = location.pathname

    return (
        <nav
            className={cn("flex items-center space-x-4 lg:space-x-6", className)}
            {...props}
        >
            {/* Dashboard - Always visible */}
            <NavLink
                to="/"
                className={({ isActive }) =>
                    cn(
                        "text-sm font-medium transition-colors hover:text-primary",
                        isActive ? "text-primary text-bold" : "text-muted-foreground"
                    )
                }
            >
                Dashboard
            </NavLink>

            {/* Assignments - Show on lg+ */}
            <NavLink
                to="/assignments"
                className={({ isActive }) =>
                    cn(
                        "text-sm font-medium transition-colors hover:text-primary hidden lg:block",
                        isActive ? "text-primary text-bold" : "text-muted-foreground"
                    )
                }
            >
                Assignments
            </NavLink>

            {/* Performance - Show on md+ */}
            <NavLink
                to="/performance"
                className={({ isActive }) =>
                    cn(
                        "text-sm font-medium transition-colors hover:text-primary hidden md:block",
                        isActive ? "text-primary text-bold" : "text-muted-foreground"
                    )
                }
            >
                Performance
            </NavLink>

            {/* Schedule - Show on sm+ */}
            <NavLink
                to="/schedule"
                className={({ isActive }) =>
                    cn(
                        "text-sm font-medium transition-colors hover:text-primary hidden sm:block",
                        isActive ? "text-primary text-bold" : "text-muted-foreground"
                    )
                }
            >
                Schedule
            </NavLink>

            {/* Cashflow - Always visible */}
            <NavLink
                to="/cashflow"
                className={({ isActive }) =>
                    cn(
                        "text-sm font-medium transition-colors hover:text-primary",
                        isActive ? "text-primary text-bold" : "text-muted-foreground"
                    )
                }
            >
                Cashflow
            </NavLink>

            {/* Dropdown for hidden items on small screens */}
            {/* Show on < lg screens, contains Assignments */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild className="lg:hidden">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 px-0"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More navigation</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild className="lg:hidden">
                        <NavLink to="/assignments" className="w-full">
                            Assignments
                        </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="md:hidden">
                        <NavLink to="/performance" className="w-full">
                            Performance
                        </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="sm:hidden">
                        <NavLink to="/schedule" className="w-full">
                            Schedule
                        </NavLink>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </nav>
    )
}
