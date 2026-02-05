import { useState } from "react"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgressCircle } from "@/components/progress-circle"
import {
    MagnifyingGlass,
    House,
    ListChecks,
    CurrencyCircleDollar,
    ChartBar,
    CalendarBlank,
    Gear,
    CaretRight,
    CaretUpDown,
    CaretDown,
} from "@phosphor-icons/react"
import { useStore } from "@/store/useStoreNew"
import LogProgressDialog from "@/components/projects/LogProgressDialog"
import { Clock, Trash2 } from "lucide-react"
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type NavItemId = 'dashboard' | 'assignments' | 'cashflow' | 'performance' | 'schedule'

interface NavItem {
    id: NavItemId
    label: string
    badge?: number
}

const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'cashflow', label: 'Cashflow' },
    { id: 'performance', label: 'Performance' },
    { id: 'schedule', label: 'Schedule' },
]

const navItemIcons: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
    dashboard: House,
    assignments: ListChecks,
    cashflow: CurrencyCircleDollar,
    performance: ChartBar,
    schedule: CalendarBlank,
}

export function AppSidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const pathname = location.pathname
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isProjectsOpen, setIsProjectsOpen] = useState(true)

    // Get data from store
    const userProfile = useStore(state => state.userProfile)
    const projects = useStore(state => state.projects)
    const assignments = useStore(state => state.assignments)
    const setSearchOpen = useStore(state => state.setSearchOpen)
    const deleteProject = useStore(state => state.deleteProject)
    const undo = useStore(state => state.undo)

    const [logProgressProjectId, setLogProgressProjectId] = useState<string | null>(null)
    const [projectToDelete, setProjectToDelete] = useState<{ id: string, title: string } | null>(null)

    const handleDelete = async () => {
        if (!projectToDelete) return
        await deleteProject(projectToDelete.id)
        toast.success("Project Deleted", {
            description: `"${projectToDelete.title}" has been removed.`,
            action: { label: "Undo", onClick: () => undo() },
        })
        setProjectToDelete(null)
        if (pathname === `/projects/${projectToDelete.id}`) {
            navigate('/assignments')
        }
    }

    // Count assignments due within 7 days
    const assignmentsDueCount = assignments.filter(a => {
        if (a.status === 'done') return false
        const deadline = new Date(a.deadline)
        const now = new Date()
        const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        return diffDays <= 7 && diffDays >= 0
    }).length

    // Get active projects (not completed)
    const activeProjects = projects
        .filter(p => p.status === 'active')
        .slice(0, 5)
        .map(p => ({
            id: p.id,
            name: p.title,
            progress: p.totalProgress,
            color: p.priority === 'high' ? '#ef4444' : p.priority === 'medium' ? '#f59e0b' : '#22c55e'
        }))

    const getHrefForNavItem = (id: NavItemId): string => {
        if (id === 'dashboard') return '/'
        return `/${id}`
    }

    const isItemActive = (id: NavItemId): boolean => {
        if (id === 'dashboard') {
            return pathname === '/'
        }
        return pathname.startsWith(`/${id}`)
    }

    const userName = userProfile?.name || 'User'
    const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    return (
        <Sidebar className="border-border/40 border-r-0 shadow-none border-none">
            <SidebarHeader className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-800 text-primary-foreground shadow-[inset_0_-5px_6.6px_0_rgba(0,0,0,0.25)]">
                            <span className="text-sm font-bold">S</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">St4cker</span>
                            <span className="text-xs text-muted-foreground">Semester {userProfile?.semester || 1}</span>
                        </div>
                    </div>
                    <button className="rounded-md p-1 hover:bg-accent">
                        <CaretUpDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-0 gap-0">
                <SidebarGroup>
                    <div className="relative px-0 py-0">
                        <MagnifyingGlass className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search"
                            className="h-9 rounded-lg bg-muted/50 pl-8 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20 border-border border shadow-none cursor-pointer"
                            onClick={() => setSearchOpen(true)}
                            readOnly
                        />
                        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                            <span className="text-xs">⌘</span>F
                        </kbd>
                    </div>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const href = getHrefForNavItem(item.id)
                                const active = isItemActive(item.id)
                                const Icon = navItemIcons[item.id]
                                // Show badge for assignments if there are items due soon
                                const badgeCount = item.id === 'assignments' && assignmentsDueCount > 0
                                    ? assignmentsDueCount
                                    : undefined

                                return (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active}
                                            className="h-9 rounded-lg px-3 font-normal text-muted-foreground"
                                        >
                                            <Link to={href}>
                                                {Icon && <Icon className="h-[18px] w-[18px]" />}
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        {badgeCount && (
                                            <SidebarMenuBadge className="bg-blue-500/20 text-blue-400 rounded-full px-2">
                                                {badgeCount}
                                            </SidebarMenuBadge>
                                        )}
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <Collapsible open={isProjectsOpen} onOpenChange={setIsProjectsOpen}>
                        <CollapsibleTrigger asChild>
                            <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center justify-between w-full group">
                                <span>Active Projects</span>
                                <CaretDown className={`h-3 w-3 transition-transform duration-200 ${isProjectsOpen ? '' : '-rotate-90'}`} />
                            </SidebarGroupLabel>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {activeProjects.length > 0 ? (
                                        activeProjects.map((project) => {
                                            const isProjectActive = pathname === `/projects/${project.id}`
                                            return (
                                            <SidebarMenuItem key={project.id}>
                                                <SidebarMenuButton 
                                                    asChild 
                                                    isActive={isProjectActive}
                                                    className="h-9 rounded-lg px-3 group"
                                                >
                                                    <Link to={`/projects/${project.id}`}>
                                                        <ProgressCircle progress={project.progress} size={18} />
                                                        <span className="flex-1 truncate text-sm">{project.name}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 rounded p-1 hover:bg-accent focus:opacity-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <span className="text-muted-foreground text-lg leading-none">···</span>
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setLogProgressProjectId(project.id)}>
                                                            <Clock className="w-4 h-4 mr-2" />
                                                            Log Progress
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setProjectToDelete({ id: project.id, title: project.name })}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </SidebarMenuItem>
                                        )
                                        })
                                    ) : (
                                        <SidebarMenuItem>
                                            <span className="px-3 py-2 text-xs text-muted-foreground italic">
                                                No active projects
                                            </span>
                                        </SidebarMenuItem>
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarGroup>
            </SidebarContent>

            <LogProgressDialog
                isOpen={logProgressProjectId !== null}
                onClose={() => setLogProgressProjectId(null)}
                projectId={logProgressProjectId || ''}
                currentProgress={projects.find(p => p.id === logProgressProjectId)?.totalProgress || 0}
            />

            <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the project
                            "{projectToDelete?.title}" and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SidebarFooter className="border-t border-border/40 p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            className="h-9 rounded-lg px-3 text-muted-foreground"
                            asChild
                        >
                            <Link to="/settings">
                                <Gear className="h-[18px] w-[18px]" />
                                <span>Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                </SidebarMenu>

                <Link to="/settings?view=profile" className="mt-2 flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={userProfile?.avatar} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col">
                        <span className="text-sm font-medium">{userName}</span>
                        <span className="text-xs text-muted-foreground">{userProfile?.major || 'Student'}</span>
                    </div>
                    <CaretRight className="h-4 w-4 text-muted-foreground" />
                </Link>
            </SidebarFooter>
        </Sidebar>
    )
}
