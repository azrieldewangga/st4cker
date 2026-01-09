import { StateCreator } from 'zustand';
import { getUSDRate, refreshExchangeRate as refreshRate } from '@/services/exchangeRate';
import { EXCHANGE_RATES, ANALYTICS_CONFIG, isDev } from '@/lib/constants';

export interface SettingsSlice {
    currency: 'IDR' | 'USD';
    setCurrency: (currency: 'IDR' | 'USD') => void;

    exchangeRate: number;
    fetchExchangeRate: () => Promise<void>;
    refreshExchangeRate: () => Promise<void>;

    theme: string;
    autoTheme: boolean;
    themeSchedule: { start: string; end: string };
    setTheme: (theme: string) => void;
    setAutoTheme: (enabled: boolean) => void;
    setThemeSchedule: (schedule: { start: string; end: string }) => void;

    monthlyLimit: number;
    setMonthlyLimit: (limit: number) => void;

    isHistoryWindowOpen: boolean;
    setHistoryWindowOpen: (isOpen: boolean) => void;

    isSearchOpen: boolean;
    setSearchOpen: (isOpen: boolean) => void;
}

export const createSettingsSlice: StateCreator<
    SettingsSlice,
    [],
    [],
    SettingsSlice
> = (set, get) => ({
    currency: 'IDR',
    setCurrency: (currency) => set({ currency }),

    exchangeRate: EXCHANGE_RATES.FALLBACK_IDR_TO_USD,
    fetchExchangeRate: async () => {
        try {
            const rate = await getUSDRate();
            set({ exchangeRate: rate });
            if (isDev) console.log('[SettingsSlice] Exchange rate updated:', rate);
        } catch (error) {
            console.error('[SettingsSlice] Failed to fetch exchange rate:', error);
        }
    },
    refreshExchangeRate: async () => {
        try {
            const rate = await refreshRate();
            set({ exchangeRate: rate });
            if (isDev) console.log('[SettingsSlice] Exchange rate refreshed:', rate);
        } catch (error) {
            console.error('[SettingsSlice] Failed to refresh exchange rate:', error);
        }
    },

    theme: localStorage.getItem('theme') || 'system',
    autoTheme: localStorage.getItem('auto-theme') === 'true',
    themeSchedule: JSON.parse(localStorage.getItem('theme-schedule') || '{"start":"18:00","end":"06:00"}'),

    setTheme: (theme) => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        set({ theme });
    },

    setAutoTheme: (enabled) => {
        set({ autoTheme: enabled });
        localStorage.setItem('auto-theme', String(enabled));
    },

    setThemeSchedule: (schedule) => {
        set({ themeSchedule: schedule });
        localStorage.setItem('theme-schedule', JSON.stringify(schedule));
    },

    monthlyLimit: parseInt(localStorage.getItem('monthlyLimit') || String(ANALYTICS_CONFIG.DEFAULT_MONTHLY_LIMIT)),
    setMonthlyLimit: (limit) => {
        localStorage.setItem('monthlyLimit', limit.toString());
        set({ monthlyLimit: limit });
    },

    isHistoryWindowOpen: false,
    setHistoryWindowOpen: (isOpen) => set({ isHistoryWindowOpen: isOpen }),

    isSearchOpen: false,
    setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
});
