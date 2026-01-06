import { motion, HTMLMotionProps } from "framer-motion";

interface FadeInProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    fullWidth?: boolean;
}

export function FadeIn({
    children,
    delay = 0,
    duration = 0.5,
    direction = "up",
    fullWidth = false,
    className,
    ...props
}: FadeInProps) {
    const variants = {
        hidden: {
            opacity: 0,
            x: direction === "left" ? -20 : direction === "right" ? 20 : 0,
            y: direction === "up" ? 20 : direction === "down" ? -20 : 0,
        },
        visible: {
            opacity: 1,
            x: 0,
            y: 0,
        },
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible" // Can switch to whileInView if preferred
            variants={variants}
            transition={{
                duration,
                delay,
                ease: "easeOut",
            }}
            className={className}
            style={{ width: fullWidth ? "100%" : "auto" }}
            {...props}
        >
            {children}
        </motion.div>
    );
}
