import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";

export function ThemeToggler() {
    const { setTheme, theme } = useStore();

    // Use a reference to get the button position for the circle animation
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const toggleTheme = React.useCallback(
        async (newTheme: 'light' | 'dark' | 'system') => { // Updated type to match Store
            // @ts-ignore - View Transition API is experimental/new
            if (!document.startViewTransition) {
                setTheme(newTheme);
                return;
            }

            try {
                // @ts-ignore
                const transition = document.startViewTransition(async () => {
                    setTheme(newTheme);
                    // Explicitly update DOM for instant visual feedback inside the snapshot if needed
                    // But useStore effect in Sidebar or App should handle it.
                    // If latency is an issue, we might need to set attribute here mechanically too.
                    document.documentElement.setAttribute('data-theme', newTheme);
                    if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                        document.documentElement.classList.remove('light');
                    } else {
                        document.documentElement.classList.add('light');
                        document.documentElement.classList.remove('dark');
                    }
                });

                // Calculate center from button
                const rect = buttonRef.current?.getBoundingClientRect();
                const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
                const y = rect ? rect.top + rect.height / 2 : 0;

                const right = window.innerWidth - x;
                const bottom = window.innerHeight - y;
                const maxRadius = Math.hypot(
                    Math.max(x, right),
                    Math.max(y, bottom)
                );

                await transition.ready;

                // Animate the clip-path
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${maxRadius}px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration: 500,
                        easing: "ease-in-out",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
            } catch (error) {
                console.error("Theme toggle error:", error);
                setTheme(newTheme);
            }
        },
        [setTheme]
    );

    const nextTheme = theme === "dark" ? "light" : "dark";

    return (
        <Button
            ref={buttonRef}
            variant="ghost"
            size="icon"
            onClick={() => toggleTheme(nextTheme)}
            className="rounded-full w-10 h-10"
            aria-label="Toggle theme"
            title={`Switch to ${nextTheme} mode`}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
    );
}
