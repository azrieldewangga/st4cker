import { ReactNode } from "react"
import { Breadcrumbs } from "./Breadcrumbs"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
    label: string
    href?: string
}

interface PageHeaderProps {
    breadcrumbs?: BreadcrumbItem[]
    title?: string
    description?: string
    actions?: ReactNode
    className?: string
}

export function PageHeader({
    breadcrumbs,
    title,
    description,
    actions,
    className
}: PageHeaderProps) {
    return (
        <div className={cn("flex items-center justify-between gap-4", className)}>
            <div className="flex items-center gap-3">
                {breadcrumbs && (
                    <div className="hidden sm:block">
                        <Breadcrumbs items={breadcrumbs} />
                    </div>
                )}
                {title && !breadcrumbs && (
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                        {description && (
                            <p className="text-muted-foreground">{description}</p>
                        )}
                    </div>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    )
}
