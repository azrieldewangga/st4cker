import { cn } from "@/lib/utils"
import { NavLink } from "react-router-dom"

export function MainNav({
    className,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    const links = [
        { href: "/", label: "Dashboard" },
        { href: "/assignments", label: "Assignments" },
        { href: "/performance", label: "Performance" },
        { href: "/schedule", label: "Schedule" },
        { href: "/cashflow", label: "Cashflow" },
    ]

    return (
        <nav
            className={cn("flex items-center space-x-4 lg:space-x-6", className)}
            {...props}
        >
            {links.map((link) => (
                <NavLink
                    key={link.href}
                    to={link.href}
                    className={({ isActive }) =>
                        cn(
                            "text-sm font-medium transition-colors hover:text-primary",
                            isActive ? "text-primary text-bold" : "text-muted-foreground"
                        )
                    }
                >
                    {link.label}
                </NavLink>
            ))}
        </nav>
    )
}
