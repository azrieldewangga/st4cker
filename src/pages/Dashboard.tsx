"use client";

import { useStore } from "@/store/useStoreNew";
import { useUIPreferencesStore } from "@/store/useUIPreferencesStore";
import { useMemo, useState } from "react";
import { format, subDays, isAfter, isSameDay, isToday, eachDayOfInterval, differenceInDays, isPast, setDate, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, subMonths } from "date-fns";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  TooltipProps,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListTodo,
  FolderKanban,
  CheckCircle2,
  GraduationCap,
  Search,
  Filter,
  MoreHorizontal,
  X,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChartLine,
  BarChart2,
  BarChart3,
  LineChartIcon,
  TrendingUp,
  Calendar,
  Grid3X3,
  RefreshCw,
  Check,
  Settings2,
  Download,
  Share2,
  Maximize2,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { ReportsTab } from "@/components/dashboard/ReportsTab";
import { NotificationsTab } from "@/components/dashboard/NotificationsTab";
import { useSearchParams } from "react-router-dom";
import { SkeletonCard } from "@/components/shared/Skeleton";

// ==================== STATS CARDS ====================
function StatsCards() {
  const assignments = useStore((state) => state.assignments);
  const projects = useStore((state) => state.projects);
  const courses = useStore((state) => state.courses);
  const grades = useStore((state) => state.grades);
  const userProfile = useStore((state) => state.userProfile);

  // Filter by current semester
  const currentSemester = userProfile?.semester;

  // Filter assignments by semester
  const relevantAssignments = assignments.filter((a) => {
    if (a.semester !== undefined && a.semester !== null) {
      return a.semester === currentSemester;
    }
    // Fallback: check course semester
    const course = courses.find((c) => c.id === a.courseId);
    return course ? course.semester === currentSemester : true;
  });

  // Filter projects by semester
  const relevantProjects = projects.filter((p) => {
    if (p.semester !== undefined && p.semester !== null) {
      return p.semester === currentSemester;
    }
    return true;
  });

  // Active Tasks (filtered by semester)
  const activeTasks = relevantAssignments.filter((a) => a.status !== "done").length;

  // Active Projects (filtered by semester)
  const activeProjects = relevantProjects.filter((p) => p.status === "active").length;

  // Task Completion Rate dengan Progress Bar
  const totalTasks = relevantAssignments.length;
  const completedTasks = relevantAssignments.filter((a) => a.status === "done").length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // GPA Calculation
  const gradePoints: Record<string, number> = {
    A: 4.0,
    "A-": 3.75,
    AB: 3.5,
    "B+": 3.25,
    B: 3.0,
    BC: 2.5,
    C: 2.0,
    D: 1.0,
    E: 0.0,
  };
  let totalPoints = 0,
    totalSks = 0;
  courses.forEach((course) => {
    const grade = grades[course.id];
    if (grade && gradePoints[grade] !== undefined) {
      totalPoints += gradePoints[grade] * (course.sks || 0);
      totalSks += course.sks || 0;
    }
  });
  const gpa = totalSks > 0 ? (totalPoints / totalSks).toFixed(2) : "0.00";

  const statsData = [
    {
      title: "Active Tasks",
      value: activeTasks.toString(),
      change: activeTasks > 5 ? "+High" : "+Low",
      changeValue: activeTasks > 5 ? "(workload)" : "(on track)",
      isPositive: activeTasks <= 5,
      icon: ListTodo,
      showProgress: false,
    },
    {
      title: "Active Projects",
      value: activeProjects.toString(),
      change: "Active",
      changeValue: ` (${relevantProjects.filter((p) => p.status === "completed").length} completed)`,
      isPositive: true,
      icon: FolderKanban,
      showProgress: false,
    },
    {
      title: "Task Completion",
      value: `${completionRate}%`,
      change: `${completedTasks} of ${totalTasks}`,
      changeValue: " done",
      isPositive: completionRate >= 50,
      icon: CheckCircle2,
      showProgress: true,
      progressValue: completionRate,
    },
    {
      title: "GPA",
      value: gpa,
      change: parseFloat(gpa) >= 3.0 ? "On Track" : "Below",
      changeValue: " Target",
      isPositive: parseFloat(gpa) >= 3.0,
      icon: GraduationCap,
      showProgress: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 rounded-xl border bg-card p-4 sm:p-5">
      {statsData.map((stat, index) => (
        <div key={stat.title} className="flex items-start">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <stat.icon className="size-4" />
              <span className="text-xs font-medium truncate">
                {stat.title}
              </span>
            </div>
            <p className="text-2xl font-semibold leading-tight tracking-tight">
              {stat.value}
            </p>
            {stat.showProgress && (
              <div className="w-full">
                <Progress value={stat.progressValue} className="h-1.5" />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={stat.isPositive ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                {stat.change}{stat.changeValue}
              </span>
              <span className="text-muted-foreground">vs Last Months</span>
            </div>
          </div>
          {index < statsData.length - 1 && (
            <div className="hidden lg:block w-px h-full bg-border mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== LEAD SOURCES CHART (Spending Habit) ====================
const timeRangeLabels = {
  "7days": "Last 7 days",
  "30days": "Last 30 days",
  "90days": "Last 90 days",
};

function LeadSourcesChart() {
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days">("30days");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const transactions = useStore((state) => state.transactions);
  const currency = useStore((state) => state.currency);

  const spendingData = useMemo(() => {
    const now = new Date();
    const daysBack = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
    const startDate = subDays(now, daysBack);

    const expenses = transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        t.type === "expense" &&
        (isAfter(d, startDate) || isSameDay(d, startDate))
      );
    });

    const categoryMap: Record<string, number> = {};
    const allowedCategories = ["Food", "Transport", "Shopping", "Bills", "Subscription", "Others"];
    allowedCategories.forEach((c) => (categoryMap[c] = 0));

    expenses.forEach((t) => {
      let cat = t.category || "Others";
      if (cat === "Education") cat = "Subscription";
      if (allowedCategories.includes(cat)) {
        categoryMap[cat] += Math.abs(Number(t.amount));
      }
    });

    const colors: Record<string, string> = {
      Food: "#35b9e9",
      Transport: "#6e3ff3",
      Shopping: "#375dfb",
      Bills: "#e255f2",
      Subscription: "#10b981",
      Others: "#94a3b8",
    };

    return allowedCategories
      .map((cat) => ({ name: cat, value: categoryMap[cat], color: colors[cat] }))
      .filter((d) => d.value > 0);
  }, [transactions, timeRange]);

  const totalSpending = spendingData.reduce((acc, item) => acc + item.value, 0);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatShort = (val: number) => {
    if (currency === "IDR") {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(2)} JT`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(0)} Rb`;
      }
    } else {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(2)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
    }
    return val.toString();
  };

  const onPieEnter = (_: unknown, index: number) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  const renderActiveShape = (props: unknown) => {
    const typedProps = props as {
      cx: number;
      cy: number;
      innerRadius: number;
      outerRadius: number;
      startAngle: number;
      endAngle: number;
      fill: string;
    };
    return (
      <g>
        <Sector
          cx={typedProps.cx}
          cy={typedProps.cy}
          innerRadius={typedProps.innerRadius}
          outerRadius={typedProps.outerRadius + 8}
          startAngle={typedProps.startAngle}
          endAngle={typedProps.endAngle}
          fill={typedProps.fill}
        />
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 rounded-xl border bg-card w-full xl:w-[340px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Button variant="outline" size="icon" className="size-7 sm:size-8">
            <ChartLine className="size-4 sm:size-[18px] text-muted-foreground" />
          </Button>
          <span className="text-sm sm:text-base font-medium">Spending Habit</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 sm:size-8">
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Time Range</DropdownMenuLabel>
            {(Object.keys(timeRangeLabels) as Array<keyof typeof timeRangeLabels>).map((range) => (
              <DropdownMenuCheckboxItem
                key={range}
                checked={timeRange === range}
                onCheckedChange={() => setTimeRange(range)}
              >
                {timeRangeLabels[range]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Download className="size-4 mr-2" />
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2 className="size-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Maximize2 className="size-4 mr-2" />
              Full Screen
            </DropdownMenuItem>
            <DropdownMenuItem>
              <RefreshCw className="size-4 mr-2" />
              Refresh Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Vertical Layout: Donut center, Labels below */}
      <div className="flex flex-col items-center gap-4">
        {/* Donut Chart */}
        <div className="relative shrink-0 size-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={spendingData}
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="70%"
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {spendingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-semibold">{formatShort(totalSpending)}</span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>

        {/* 2 Column Labels Grid */}
        <div className="w-full max-w-[280px] grid grid-cols-2 gap-x-6 gap-y-2 justify-items-start">
          {spendingData.map((item, index) => (
            <div
              key={item.name}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${activeIndex !== null && activeIndex !== index ? "opacity-50" : ""
                }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div
                className="w-1 h-4 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground leading-none truncate">{item.name}</span>
                <span className="text-xs font-semibold tabular-nums leading-tight">{formatMoney(item.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Settings2 className="size-3" />
        <span>{timeRangeLabels[timeRange]}</span>
      </div>
    </div>
  );
}

// ==================== REVENUE FLOW CHART (Cashflow) ====================
const periodLabels = {
  "3months": "Last 3 Months",
  "6months": "Last 6 Months",
  year: "Full Year",
};

type ChartType = "bar" | "line" | "area";
type TimePeriod = "3months" | "6months" | "year";

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const income = payload.find((p) => p.dataKey === "income")?.value || 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value || 0;
  const diff = Number(income) - Number(expense);

  return (
    <div className="bg-popover border border-border rounded-lg p-2 sm:p-3 shadow-lg">
      <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">{label}</p>
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="size-2 sm:size-2.5 rounded-full" style={{ background: "#6e3ff3" }} />
          <span className="text-[10px] sm:text-sm text-muted-foreground">Income:</span>
          <span className="text-[10px] sm:text-sm font-medium text-foreground">
            Rp {Number(income).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="size-2 sm:size-2.5 rounded-full" style={{ background: "#e255f2" }} />
          <span className="text-[10px] sm:text-sm text-muted-foreground">Expense:</span>
          <span className="text-[10px] sm:text-sm font-medium text-foreground">
            Rp {Number(expense).toLocaleString()}
          </span>
        </div>
        <div className="pt-1 border-t border-border mt-1">
          <span className={`text-[10px] sm:text-xs font-medium ${diff >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {diff >= 0 ? "+" : ""}{diff.toLocaleString()} net
          </span>
        </div>
      </div>
    </div>
  );
}

function getDataForPeriod(data: { month: string; income: number; expense: number }[], period: TimePeriod) {
  switch (period) {
    case "3months":
      return data.slice(-3);
    case "6months":
      return data.slice(-6);
    case "year":
    default:
      return data;
  }
}

function RevenueFlowChart() {
  const [currentInsight, setCurrentInsight] = useState(0);

  const transactions = useStore((state) => state.transactions);
  const currency = useStore((state) => state.currency);
  
  // Use persisted state from separate UI preferences store
  const { 
    dashboardChartType: chartType, 
    dashboardPeriod: period, 
    dashboardShowGrid: showGrid, 
    dashboardShowIncome: showIncome, 
    dashboardShowExpense: showExpense, 
    dashboardSmoothCurve: smoothCurve,
    setDashboardChartType: setChartType,
    setDashboardPeriod: setPeriod,
    setDashboardShowGrid: setShowGrid,
    setDashboardShowIncome: setShowIncome,
    setDashboardShowExpense: setShowExpense,
    setDashboardSmoothCurve: setSmoothCurve
  } = useUIPreferencesStore();

  // Generate monthly data from transactions
  const fullYearData = useMemo(() => {
    const now = new Date();
    const months: { month: string; income: number; expense: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthName = format(monthStart, "MMM");

      const monthTx = transactions.filter((t) => {
        const d = new Date(t.date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      });

      const income = monthTx
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = monthTx
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      months.push({ month: monthName, income, expense });
    }

    return months;
  }, [transactions]);

  const chartData = getDataForPeriod(fullYearData, period);

  const totalIncome = chartData.reduce((acc, item) => acc + item.income, 0);
  const totalExpense = chartData.reduce((acc, item) => acc + item.expense, 0);

  // Helper function to format money - must be defined before useMemo
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Generate insights based on data
  const insights = useMemo(() => {
    const ins: string[] = [];
    if (chartData.length === 0) return ["No data available for the selected period"];

    const maxIncome = chartData.reduce((max, item) => item.income > max.income ? item : max, chartData[0]);
    ins.push(`${maxIncome.month} has the highest income of ${formatMoney(maxIncome.income)}`);

    const maxExpense = chartData.reduce((max, item) => item.expense > max.expense ? item : max, chartData[0]);
    ins.push(`${maxExpense.month} has the highest spending of ${formatMoney(maxExpense.expense)}`);

    const avgIncome = totalIncome / chartData.length;
    ins.push(`Average monthly income is ${formatMoney(avgIncome)}`);

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "0";
    ins.push(`Savings rate is ${savingsRate}% for the selected period`);

    return ins;
  }, [chartData, totalIncome, totalExpense, formatMoney]);

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 rounded-xl border bg-card min-w-0">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1">
          <Button variant="outline" size="icon" className="size-7 sm:size-8">
            <BarChart2 className="size-4 sm:size-[18px] text-muted-foreground" />
          </Button>
          <span className="text-sm sm:text-base font-medium">Cashflow</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 sm:size-3 rounded-full" style={{ background: "#6e3ff3" }} />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 sm:size-3 rounded-full" style={{ background: "#e255f2" }} />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Expense</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 sm:size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Chart Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <BarChart3 className="size-4 mr-2" />
                Chart Type
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setChartType("bar")}>
                  <BarChart3 className="size-4 mr-2" />
                  Bar Chart
                  {chartType === "bar" && <Check className="size-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChartType("line")}>
                  <LineChartIcon className="size-4 mr-2" />
                  Line Chart
                  {chartType === "line" && <Check className="size-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChartType("area")}>
                  <TrendingUp className="size-4 mr-2" />
                  Area Chart
                  {chartType === "area" && <Check className="size-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Calendar className="size-4 mr-2" />
                Time Period
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {(Object.keys(periodLabels) as TimePeriod[]).map((key) => (
                  <DropdownMenuItem key={key} onClick={() => setPeriod(key)}>
                    {periodLabels[key]}
                    {period === key && <Check className="size-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
              <Grid3X3 className="size-4 mr-2" />
              Show Grid Lines
            </DropdownMenuCheckboxItem>
            {(chartType === "line" || chartType === "area") && (
              <DropdownMenuCheckboxItem checked={smoothCurve} onCheckedChange={setSmoothCurve}>
                <TrendingUp className="size-4 mr-2" />
                Smooth Curve
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Data Series</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showIncome} onCheckedChange={setShowIncome}>
              <div className="size-3 rounded-full mr-2" style={{ background: "#6e3ff3" }} />
              Show Income
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showExpense} onCheckedChange={setShowExpense}>
              <div className="size-3 rounded-full mr-2" style={{ background: "#e255f2" }} />
              Show Expense
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setChartType("bar");
                setPeriod("6months");
                setShowGrid(true);
                setShowIncome(true);
                setShowExpense(true);
                setSmoothCurve(true);
              }}
            >
              <RefreshCw className="size-4 mr-2" />
              Reset to Default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-10 flex-1 min-h-0">
        <div className="flex flex-col gap-4 w-full lg:w-[200px] xl:w-[220px] shrink-0">
          <div className="space-y-2 sm:space-y-4">
            <p className="text-xl sm:text-2xl lg:text-[28px] font-semibold leading-tight tracking-tight">
              {formatMoney(totalIncome)}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Income ({periodLabels[period]})</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-semibold">🏆 Best Performing Month</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
              {insights[currentInsight]}
            </p>
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <ChevronLeft
                className="size-3 sm:size-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() =>
                  setCurrentInsight((prev) =>
                    prev === 0 ? insights.length - 1 : prev - 1
                  )
                }
              />
              <div className="flex-1 flex items-center gap-1">
                {insights.map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 h-0.5 rounded-full transition-colors ${index === currentInsight
                      ? "bg-foreground"
                      : "bg-muted-foreground/30"
                      }`}
                  />
                ))}
              </div>
              <ChevronRight
                className="size-3 sm:size-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() =>
                  setCurrentInsight((prev) =>
                    prev === insights.length - 1 ? 0 : prev + 1
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="flex-1 aspect-[16/9] min-w-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} barGap={2}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6e3ff3" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6e3ff3" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e255f2" stopOpacity={1} />
                    <stop offset="100%" stopColor="#e255f2" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5", radius: 4 }} />
                {showIncome && <Bar dataKey="income" fill="url(#incomeGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
                {showExpense && <Bar dataKey="expense" fill="url(#expenseGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={chartData}>
                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d4d4d8" }} />
                {showIncome && (
                  <Line
                    type={smoothCurve ? "monotone" : "linear"}
                    dataKey="income"
                    stroke="#6e3ff3"
                    strokeWidth={2}
                    dot={{ fill: "#6e3ff3", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "#6e3ff3" }}
                  />
                )}
                {showExpense && (
                  <Line
                    type={smoothCurve ? "monotone" : "linear"}
                    dataKey="expense"
                    stroke="#e255f2"
                    strokeWidth={2}
                    dot={{ fill: "#e255f2", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "#e255f2" }}
                  />
                )}
              </LineChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6e3ff3" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6e3ff3" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e255f2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e255f2" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d4d4d8" }} />
                {showIncome && (
                  <Area type={smoothCurve ? "monotone" : "linear"} dataKey="income" stroke="#6e3ff3" strokeWidth={2} fill="url(#incomeAreaGradient)" />
                )}
                {showExpense && (
                  <Area type={smoothCurve ? "monotone" : "linear"} dataKey="expense" stroke="#e255f2" strokeWidth={2} fill="url(#expenseAreaGradient)" />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ==================== ACTIVE TASKS TABLE ====================
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

function ActiveTasksTable() {
  const assignments = useStore((state) => state.assignments);
  const courses = useStore((state) => state.courses);
  const userProfile = useStore((state) => state.userProfile);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Same filtering logic as Assignments page
  const filteredTasks = useMemo(() => {
    let result = [...assignments];

    if (!userProfile) return [];

    // Filter by current semester (same as Assignments page)
    if (userProfile.semester) {
      result = result.filter((a) => {
        if (a.semester !== undefined && a.semester !== null) {
          return a.semester === userProfile.semester;
        }
        return false;
      });
    }

    // Only show active tasks (not done)
    result = result.filter((a) => a.status !== "done");

    // Search filter
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          (a.title && a.title.toLowerCase().includes(s)) ||
          (a.courseId && a.courseId.toLowerCase().includes(s)) ||
          (a.note && a.note.toLowerCase().includes(s))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Sort by deadline (same as Assignments page default)
    result.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return result;
  }, [assignments, userProfile, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTasks.slice(startIndex, startIndex + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const hasActiveFilters = statusFilter !== "all";

  const getCourseName = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    return course?.name || courseId;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "to-do":
      case "pending":
        return <Badge variant="secondary">To Do</Badge>;
      case "progress":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            In Progress
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1">
          <Button variant="outline" size="icon" className="size-7 sm:size-8 shrink-0">
            <ListTodo className="size-4 sm:size-[18px] text-muted-foreground" />
          </Button>
          <span className="text-sm sm:text-base font-medium">Active Tasks</span>
          <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">
            {filteredTasks.length}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 sm:size-5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 w-full sm:w-[160px] lg:w-[200px] h-8 sm:h-9 text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 sm:h-9 gap-1.5 sm:gap-2 ${hasActiveFilters ? "border-primary" : ""}`}
              >
                <Filter className="size-3.5 sm:size-4" />
                <span className="hidden sm:inline">Filter</span>
                {hasActiveFilters && <span className="size-1.5 sm:size-2 rounded-full bg-primary" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={statusFilter === "all"} onCheckedChange={() => setStatusFilter("all")}>
                All Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === "to-do"} onCheckedChange={() => setStatusFilter("to-do")}>
                To Do
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === "progress"} onCheckedChange={() => setStatusFilter("progress")}>
                In Progress
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === "pending"} onCheckedChange={() => setStatusFilter("pending")}>
                Pending
              </DropdownMenuCheckboxItem>
              {hasActiveFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("all")} className="text-destructive">
                    <X className="size-4 mr-2" />
                    Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 pb-3">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Filters:</span>
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 cursor-pointer text-[10px] sm:text-xs h-5 sm:h-6" onClick={() => setStatusFilter("all")}>
              {statusFilter}
              <X className="size-2.5 sm:size-3" />
            </Badge>
          )}
        </div>
      )}

      <div className="px-3 sm:px-6 pb-3 sm:pb-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px] font-medium text-muted-foreground text-xs sm:text-sm">#</TableHead>
              <TableHead className="min-w-[180px] font-medium text-muted-foreground text-xs sm:text-sm">Task Name</TableHead>
              <TableHead className="hidden md:table-cell min-w-[140px] font-medium text-muted-foreground text-xs sm:text-sm">Course</TableHead>
              <TableHead className="min-w-[100px] font-medium text-muted-foreground text-xs sm:text-sm">Status</TableHead>
              <TableHead className="min-w-[90px] font-medium text-muted-foreground text-xs sm:text-sm">Deadline</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                  No active tasks found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedTasks.map((task, index) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium text-xs sm:text-sm">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div className="flex items-center justify-center size-5 sm:size-[26px] rounded-md sm:rounded-lg bg-muted text-[10px] sm:text-sm font-extrabold shrink-0">
                        {task.title?.charAt(0).toUpperCase() || "T"}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-xs sm:text-sm block truncate">{task.title}</span>
                        <span className="text-[10px] text-muted-foreground md:hidden">{getCourseName(task.courseId)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs sm:text-sm">
                    {getCourseName(task.courseId)}
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs sm:text-sm">
                    {format(new Date(task.deadline), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 sm:size-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="size-3.5 sm:size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="size-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pencil className="size-4 mr-2" />
                          Edit Task
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="size-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 border-t">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <span className="hidden sm:inline">Rows per page:</span>
          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">
            {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredTasks.length)} of {filteredTasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-1 mx-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage === totalPages}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================
export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const userProfile = useStore((state) => state.userProfile);
  const isAppReady = useStore((state) => state.isAppReady);

  // Notification Count
  const assignments = useStore((state) => state.assignments);
  const subscriptions = useStore((state) => state.subscriptions);
  const transactions = useStore((state) => state.transactions);
  const courses = useStore((state) => state.courses);
  // userProfile sudah dideklarasikan di atas

  const notificationCount = useMemo(() => {
    let count = 0;
    const now = new Date();
    const currentSemester = userProfile?.semester;

    assignments.forEach((a) => {
      if (a.status === "done") return;
      
      // Filter by semester
      if (a.semester !== undefined && a.semester !== null) {
        if (a.semester !== currentSemester) return;
      } else {
        // Fallback: check course semester
        const course = courses.find((c) => c.id === a.courseId);
        if (course && course.semester !== currentSemester) return;
      }
      
      const dueDate = new Date(a.deadline);
      const daysLeft = differenceInDays(dueDate, now);
      if ((isPast(dueDate) && !isToday(dueDate)) || (daysLeft >= 0 && daysLeft <= 3)) {
        count++;
      }
    });
    subscriptions.forEach((sub) => {
      let candidate = setDate(now, sub.dueDay);
      if (isPast(candidate) && !isToday(candidate)) {
        candidate = addMonths(candidate, 1);
      }
      const isPaid = transactions.some(
        (t) =>
          t.type === "expense" &&
          t.category === "Subscription" &&
          t.title.includes(sub.name) &&
          new Date(t.date).getMonth() === candidate.getMonth() &&
          new Date(t.date).getFullYear() === candidate.getFullYear()
      );
      if (isPaid) return;
      const daysUntil = differenceInDays(candidate, now);
      if (daysUntil >= 0 && daysUntil <= 7) count++;
    });
    return count;
  }, [assignments, subscriptions, transactions, courses, userProfile]);

  if (!isAppReady && !userProfile) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-3rem)]">
      <div className="m-2 border border-border rounded-xl bg-background">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Dashboard</span>
            <ChevronRightIcon className="h-4 w-4" />
            <span className="capitalize">{activeTab}</span>
          </div>
          {notificationCount > 0 && (
            <div className="text-sm text-muted-foreground">
              You have {notificationCount} tasks due soon
            </div>
          )}
        </div>

        {/* Welcome Section & Tabs */}
        <div className="px-6 pt-6 pb-4 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Welcome back, {userProfile?.name || "Student"}</h1>
              <p className="text-sm text-muted-foreground mt-1">Here's what's happening with your semester.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Semester {userProfile?.semester || 1}</Badge>
              <Badge variant="outline" className="text-emerald-600">
                Active
              </Badge>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-border">
            {["overview", "reports", "notifications"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium capitalize relative ${activeTab === tab ? "text-foreground" : "text-muted-foreground"
                  }`}
              >
                {tab}
                {tab === "notifications" && notificationCount > 0 && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{notificationCount}</span>
                )}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <StatsCards />
              <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                <LeadSourcesChart />
                <RevenueFlowChart />
              </div>
              <ActiveTasksTable />
            </div>
          )}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </ScrollArea>
  );
}
