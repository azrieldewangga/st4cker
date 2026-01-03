import { Assignment, Subscription } from "@/types/models";
import { isSameDay, addDays, isPast, differenceInDays } from "date-fns";

const NOTIFICATION_KEY = "campusdash-notifications-last-checked";

export const NotificationService = {
    async checkDeadlineNotifications(
        assignments: Assignment[],
        subscriptions: Subscription[]
    ) {
        if (!window.electronAPI?.notifications) return;

        const lastChecked = localStorage.getItem(NOTIFICATION_KEY);
        const now = new Date();
        const todayStr = now.toDateString();

        // Check user preference
        const isEnabled = localStorage.getItem('notifications-enabled') !== 'false';
        if (!isEnabled) {
            console.log("Notifications are disabled by user.");
            return;
        }

        // Only check once per day to avoid spam
        if (lastChecked === todayStr) {
            console.log("Notifications already checked today.");
            return;
        }

        console.log("Checking notifications...");

        // 1. Check Assignments
        const todoAssignments = assignments.filter(a => a.status !== 'done');
        let urgentCount = 0;

        todoAssignments.forEach(assignment => {
            const deadline = new Date(assignment.deadline);

            // Check if deadline is today
            if (differenceInDays(deadline, now) === 0 && !isPast(deadline)) {
                urgentCount++;
                window.electronAPI.notifications.send(
                    "Assignment Due Today! 🚨",
                    `"${assignment.title}" is due today. Don't forget to submit!`
                );
            }
            // Check if deadline is tomorrow
            else if (differenceInDays(deadline, now) === 1) {
                window.electronAPI.notifications.send(
                    "Assignment Due Tomorrow ⚠️",
                    `"${assignment.title}" is due tomorrow.`
                );
            }
        });

        // 2. Check Subscriptions
        subscriptions.forEach(sub => {
            const today = now.getDate();
            // Simple check: if due day is today
            if (sub.dueDay === today) {
                window.electronAPI.notifications.send(
                    "Subscription Payment Due 💸",
                    `"${sub.name}" payment is due today.`
                );
            }
            // Check if due tomorrow (simple logic, imperfect for month transitions but good enough for MVP)
            else if (sub.dueDay === today + 1) {
                window.electronAPI.notifications.send(
                    "Subscription Due Tomorrow 📅",
                    `"${sub.name}" payment is coming up.`
                );
            }
        });

        // Save check time
        localStorage.setItem(NOTIFICATION_KEY, todayStr);
    },

    // Allow manual test triggering
    testNotification() {
        if (window.electronAPI?.notifications) {
            window.electronAPI.notifications.send("Test Notification 🔔", "This is a test notification from st4cker.");
        } else {
            console.warn("Notification API not available");
        }
    }
};
