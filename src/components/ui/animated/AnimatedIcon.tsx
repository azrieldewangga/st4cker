import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface AnimatedIconProps {
    icon?: LucideIcon;
    children?: React.ReactNode; // Support <AnimatedIcon><Trash2 /></AnimatedIcon>
    className?: string;
}

export function AnimatedIcon({ icon: Icon, children, className }: AnimatedIconProps) {
    return (
        <motion.div
            className={className}
            whileHover={{
                rotate: [0, -10, 10, -10, 10, 0],
                scale: 1.1,
            }}
            transition={{
                duration: 0.5,
                ease: "easeInOut",
            }}
        >
            {Icon ? <Icon className="w-full h-full" /> : children}
        </motion.div>
    );
}
