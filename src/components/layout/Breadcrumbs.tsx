import { Link } from "react-router-dom"
import { CaretRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
    label: string
    href?: string
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[]
    className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    return (
        <nav className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1

                return (
                    <div key={index} className="flex items-center">
                        {index > 0 && (
                            <CaretRight className="mx-1 h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                        {item.href && !isLast ? (
                            <Link
                                to={item.href}
                                className="hover:text-foreground transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className={cn(isLast && "text-foreground font-medium")}>
                                {item.label}
                            </span>
                        )}
                    </div>
                )
            })}
        </nav>
    )
}
