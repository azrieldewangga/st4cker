interface ProgressCircleProps {
    progress: number
    color?: string // Optional now - will use dynamic color if not provided
    size?: number
    strokeWidth?: number
}

function getProgressColor(progress: number): string {
    // Dynamic color based on progress percentage
    if (progress <= 25) {
        return "#eab308" // Yellow-500
    } else if (progress <= 50) {
        return "#f97316" // Orange-500
    } else if (progress <= 75) {
        return "#3b82f6" // Blue-500
    } else {
        return "#22c55e" // Green-500
    }
}

export function ProgressCircle({ progress, color, size = 18, strokeWidth = 2 }: ProgressCircleProps) {
    const s = Math.round(size)
    const r = Math.floor((s - strokeWidth) / 2)
    const cx = s / 2
    const cy = s / 2

    const circumference = 2 * Math.PI * r
    const dashOffset = circumference * (1 - progress / 100)
    
    // Use provided color or dynamic color based on progress
    const strokeColor = color || getProgressColor(progress)

    return (
        <div className="relative flex items-center justify-center" style={{ width: s, height: s }}>
            <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
                {/* Background ring */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-border"
                />

                {/* Progress ring */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    style={{
                        transition: "stroke-dashoffset 0.3s ease",
                    }}
                />
            </svg>
        </div>
    )
}
