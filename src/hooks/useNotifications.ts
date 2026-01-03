import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const useNotifications = () => {
    const { assignments } = useStore();
    const processedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const checkDeadlines = () => {
            if (!window.electronAPI?.notifications) return;

            const now = new Date();

            assignments.forEach(assignment => {
                if (assignment.status === 'done') return;

                const deadline = new Date(assignment.deadline);
                const diffMs = deadline.getTime() - now.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);

                // Unique keys for localStorage to prevent spamming
                const key24h = `notif-deadline-${assignment.id}-24h`;
                const key1h = `notif-deadline-${assignment.id}-1h`;

                // Condition 1: 24 Hours Before (Between 23h and 24h)
                if (diffHours > 0 && diffHours <= 24 && diffHours > 23) {
                    if (!localStorage.getItem(key24h)) {
                        window.electronAPI.notifications.send(
                            "Assignment Deadline Tomorrow",
                            `"${assignment.title}" is due in 24 hours.`
                        );
                        localStorage.setItem(key24h, 'true');
                    }
                }

                // Condition 2: 1 Hour Before (Between 0h and 1h)
                if (diffHours > 0 && diffHours <= 1) {
                    if (!localStorage.getItem(key1h)) {
                        window.electronAPI.notifications.send(
                            "Assignment Deadline Soon",
                            `"${assignment.title}" is due in less than 1 hour!`
                        );
                        localStorage.setItem(key1h, 'true');
                    }
                }
            });
        };

        // Initial check
        checkDeadlines();

        // Check every 5 minutes
        const interval = setInterval(checkDeadlines, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [assignments]);
};
