'use client';

import * as React from 'react';
import { RotateCcw, ArrowUpRight, X } from 'lucide-react';
import { motion, type Transition, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';

const initialNotifications = [
  {
    id: 1,
    title: 'Welcome to st4cker',
    subtitle: 'System ready',
    time: 'just now',
    count: 1,
  }
];

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";


const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' },
};

function NotificationList() {
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);
  const [isVisible, setIsVisible] = useState(true);
  const { notification } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const newNotif = {
        id: Date.now(),
        title: notification.type.toUpperCase(),
        subtitle: notification.message,
        time: 'just now',
        count: 1
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  }, [notification]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-4 right-4 z-50">
          <motion.div
            className="bg-neutral-200 dark:bg-neutral-900 p-3 rounded-3xl w-80 space-y-3 shadow-md relative group"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            whileHover="expanded"
          >
            <button
              onClick={() => setIsVisible(false)}
              className="absolute -top-2 -left-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-sm"
            >
              <X className="size-3" />
            </button>

            <div>
              {notifications.slice(0, 3).map((notification, i) => (
                <motion.div
                  key={notification.id}
                  className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2 shadow-sm hover:shadow-lg transition-shadow duration-200 relative mb-1"
                  variants={getCardVariants(i)}
                  transition={transition}
                  style={{
                    zIndex: notifications.length - i,
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <h1 className="text-sm font-medium truncate flex-1">{notification.title}</h1>
                    {notification.count > 0 && (
                      <div className="flex items-center text-xs gap-0.5 font-medium text-neutral-500 dark:text-neutral-300 whitespace-nowrap">
                        <RotateCcw className="size-3" />
                        <span>{notification.count}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 font-medium truncate">
                    <span>{notification.time}</span>
                    &nbsp;•&nbsp;
                    <span>{notification.subtitle}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="grid flex-1 min-w-0">
                <motion.span
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-300 row-start-1 col-start-1"
                  variants={notificationTextVariants}
                  transition={textSwitchTransition}
                >
                  Notifications
                </motion.span>
                <motion.span
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1 hover:text-primary transition-colors"
                  variants={viewAllTextVariants}
                  transition={textSwitchTransition}
                  onClick={() => {
                    navigate("/?tab=notifications");
                  }}
                >
                  View all <ArrowUpRight className="size-4" />
                </motion.span>
              </div>

              <div className="size-5 rounded-full bg-neutral-400 text-white text-xs flex items-center justify-center font-medium flex-shrink-0 ml-auto">
                {notifications.length}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { NotificationList };
