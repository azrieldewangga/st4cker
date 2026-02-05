import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIPreferencesState {
    // Dashboard Cashflow Chart preferences
    dashboardChartType: 'bar' | 'line' | 'area';
    dashboardPeriod: '3months' | '6months' | 'year';
    dashboardShowGrid: boolean;
    dashboardShowIncome: boolean;
    dashboardShowExpense: boolean;
    dashboardSmoothCurve: boolean;
    
    // Cashflow page preferences
    cashflowChartType: 'bar' | 'line' | 'area';
    cashflowPeriod: '3months' | '6months' | 'year';
    cashflowShowGrid: boolean;
    cashflowShowIncome: boolean;
    cashflowShowExpense: boolean;
    cashflowSmoothCurve: boolean;
    
    // Actions
    setDashboardChartType: (type: 'bar' | 'line' | 'area') => void;
    setDashboardPeriod: (period: '3months' | '6months' | 'year') => void;
    setDashboardShowGrid: (show: boolean) => void;
    setDashboardShowIncome: (show: boolean) => void;
    setDashboardShowExpense: (show: boolean) => void;
    setDashboardSmoothCurve: (smooth: boolean) => void;
    
    setCashflowChartType: (type: 'bar' | 'line' | 'area') => void;
    setCashflowPeriod: (period: '3months' | '6months' | 'year') => void;
    setCashflowShowGrid: (show: boolean) => void;
    setCashflowShowIncome: (show: boolean) => void;
    setCashflowShowExpense: (show: boolean) => void;
    setCashflowSmoothCurve: (smooth: boolean) => void;
}

export const useUIPreferencesStore = create<UIPreferencesState>()(
    persist(
        (set) => ({
            // Dashboard defaults
            dashboardChartType: 'bar',
            dashboardPeriod: '6months',
            dashboardShowGrid: true,
            dashboardShowIncome: true,
            dashboardShowExpense: true,
            dashboardSmoothCurve: true,
            
            // Cashflow page defaults
            cashflowChartType: 'bar',
            cashflowPeriod: '6months',
            cashflowShowGrid: true,
            cashflowShowIncome: true,
            cashflowShowExpense: true,
            cashflowSmoothCurve: true,
            
            // Dashboard actions
            setDashboardChartType: (type) => set({ dashboardChartType: type }),
            setDashboardPeriod: (period) => set({ dashboardPeriod: period }),
            setDashboardShowGrid: (show) => set({ dashboardShowGrid: show }),
            setDashboardShowIncome: (show) => set({ dashboardShowIncome: show }),
            setDashboardShowExpense: (show) => set({ dashboardShowExpense: show }),
            setDashboardSmoothCurve: (smooth) => set({ dashboardSmoothCurve: smooth }),
            
            // Cashflow actions
            setCashflowChartType: (type) => set({ cashflowChartType: type }),
            setCashflowPeriod: (period) => set({ cashflowPeriod: period }),
            setCashflowShowGrid: (show) => set({ cashflowShowGrid: show }),
            setCashflowShowIncome: (show) => set({ cashflowShowIncome: show }),
            setCashflowShowExpense: (show) => set({ cashflowShowExpense: show }),
            setCashflowSmoothCurve: (smooth) => set({ cashflowSmoothCurve: smooth }),
        }),
        {
            name: 'st4cker-ui-preferences',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
