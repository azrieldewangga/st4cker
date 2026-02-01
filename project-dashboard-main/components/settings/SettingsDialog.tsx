"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
    Bell,
    CheckCircle,
    Circle,
    CircleNotch,
    CopySimple,
    CreditCard,
    DiamondsFour,
    Info,
    LockSimple,
    PencilSimpleLine,
    Plus,
    Robot,
    ShieldCheck,
    SlidersHorizontal,
    Sparkle,
    Spinner,
    SquaresFour,
    Star,
    UploadSimple,
    UserCircle,
    UsersThree,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

const settingsSections = [
    {
        id: "personal",
        label: "Personal",
        items: [
            { id: "account", label: "Account" },
            { id: "notifications", label: "Notifications" },
        ],
    },
    {
        id: "workspace",
        label: "Workspace",
        items: [
            { id: "preferences", label: "Preferences" },
            { id: "teammates", label: "Teammates" },
            { id: "identity", label: "Identity" },
            { id: "types", label: "Types" },
            { id: "billing", label: "Plans and billing" },
            { id: "import", label: "Import" },
        ],
    },
    {
        id: "ai",
        label: "AI",
        items: [
            { id: "agents", label: "Agents" },
            { id: "skills", label: "Skills" },
        ],
    },
] as const

const settingsItemIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    account: UserCircle,
    notifications: Bell,
    preferences: SlidersHorizontal,
    teammates: UsersThree,
    identity: ShieldCheck,
    types: SquaresFour,
    billing: CreditCard,
    import: UploadSimple,
    agents: Robot,
    skills: Sparkle,
}

type SettingsItemId = (typeof settingsSections)[number]["items"][number]["id"]

type SettingsDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

function TeammatesSettingsPane() {
    const [inviteRole, setInviteRole] = useState("member")

    const teammates = [
        {
            id: "khanh",
            name: "Khánh Dương",
            email: "duongdaikhanh2502@gmail.com",
            status: "Active",
            role: "Admin",
            avatar: "/avatar-profile.jpg",
        },
    ] as const

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Teammates</DialogTitle>
                <DialogDescription className="mt-1">
                    Invite and manage your teammates to collaborate. You can also {" "}
                    <Link href="#" className="text-primary underline underline-offset-4">
                        set up AI agents
                    </Link>{" "}
                    to work alongside your team.
                </DialogDescription>
            </div>

            <Separator />

            <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input placeholder="Invite teammates by email" className="flex-1" />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="sm:w-40">
                            <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button type="button" size="lg" className="sm:w-auto rounded-lg">
                        Invite
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-border">
                <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-muted-foreground">
                    <span className="col-span-6">Name</span>
                    <span className="col-span-3">Status</span>
                    <span className="col-span-3 text-right sm:text-left">Role</span>
                </div>
                <div className="divide-y divide-border">
                    {teammates.map((mate) => (
                        <div key={mate.id} className="grid grid-cols-12 items-center px-4 py-4">
                            <div className="col-span-6 flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={mate.avatar} />
                                    <AvatarFallback>KD</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">{mate.name}</span>
                                    <span className="text-xs text-muted-foreground">{mate.email}</span>
                                </div>
                            </div>
                            <div className="col-span-3 text-sm text-muted-foreground">{mate.status}</div>
                            <div className="col-span-3 text-sm text-foreground text-right sm:text-left">{mate.role}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const [activeItemId, setActiveItemId] = useState<SettingsItemId>("account")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton
                className="sm:max-w-5xl w-full p-0 rounded-3xl overflow-hidden sm:max-h-[85vh] sm:h-[85vh]"
            >
                <div className="flex h-full flex-col sm:flex-row sm:min-h-0">
                    <aside className="w-full border-b border-border/60 bg-muted/40 px-4 py-4 sm:w-64 sm:border-b-0 sm:border-r">
                        <div className="space-y-4 text-sm">
                            {settingsSections.map((section) => (
                                <div key={section.id} className="space-y-1.5">
                                    <div className="text-sm font-semibold text-muted-foreground">
                                        {section.label}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {section.items.map((item) => {
                                            const isActive = item.id === activeItemId
                                            const Icon = settingsItemIcons[item.id]
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setActiveItemId(item.id)}
                                                    className={cn(
                                                        "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-[15px] text-muted-foreground hover:bg-accent hover:text-foreground",
                                                        isActive && "bg-accent text-foreground",
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {Icon && <Icon className="h-4 w-4" />}
                                                        {item.label}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6 sm:min-h-0">
                        {activeItemId === "account" && <AccountSettingsPane />}
                        {activeItemId === "notifications" && <NotificationsSettingsPane />}
                        {activeItemId === "preferences" && <PreferencesSettingsPane />}
                        {activeItemId === "teammates" && <TeammatesSettingsPane />}
                        {activeItemId === "identity" && <IdentitySettingsPane />}
                        {activeItemId === "types" && <TypesSettingsPane />}
                        {activeItemId === "billing" && <BillingSettingsPane />}
                        {activeItemId === "import" && <ImportSettingsPane />}
                        {activeItemId !== "account" &&
                            activeItemId !== "notifications" &&
                            activeItemId !== "preferences" &&
                            activeItemId !== "teammates" &&
                            activeItemId !== "identity" &&
                            activeItemId !== "types" &&
                            activeItemId !== "billing" &&
                            activeItemId !== "import" && (
                                <PlaceholderSettingsPane />
                            )}
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function AccountSettingsPane() {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [photoPreview, setPhotoPreview] = useState("/avatar-profile.jpg")
    const [objectUrl, setObjectUrl] = useState<string | null>(null)
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl)
            }
        }
    }, [objectUrl])

    const handleRequestPhoto = () => {
        fileInputRef.current?.click()
    }

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const nextUrl = URL.createObjectURL(file)
        setPhotoPreview(nextUrl)
        setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return nextUrl
        })
    }

    const handleResetPhoto = () => {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl)
            setObjectUrl(null)
        }
        setPhotoPreview("/avatar-profile.jpg")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Account</DialogTitle>
                <DialogDescription className="mt-1">
                    Manage your personal information and account preferences.
                </DialogDescription>
            </div>

            <Separator />

            <SettingSection title="Information">
                <SettingRow label="Profile photo" description="This image appears across your workspace.">
                    <div className="flex flex-wrap items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={photoPreview} />
                            <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleRequestPhoto}>
                                Change photo
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoChange}
                                aria-label="Upload profile photo"
                            />
                        </div>
                    </div>
                </SettingRow>
                <SettingRow label="Full name">
                    <Input defaultValue="Khánh Dương" className="h-9 text-sm" />
                </SettingRow>
                <SettingRow label="Email address" description="Notifications will be sent to this address.">
                    <Input defaultValue="duongdaikhanh2502@gmail.com" type="email" className="h-9 text-sm" readOnly />
                </SettingRow>
                <SettingRow label="Password" description="Last changed 2 months ago.">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span>••••••••</span>
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                            Set password
                        </Button>
                    </div>
                </SettingRow>
            </SettingSection>

            <Separator />

            <SettingSection title="Appearance">
                <SettingRow label="Theme">
                    <Select
                        value={isMounted ? theme ?? "system" : "system"}
                        onValueChange={(value) => setTheme(value)}
                    >
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="system">System default</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>
                <SettingRow
                    label="Open links in app"
                    description="When you click a link to Dart, open it in the app if possible."
                >
                    <Switch defaultChecked />
                </SettingRow>
            </SettingSection>

            <Separator />

            <SettingSection title="Location and time">
                <SettingRow label="Timezone">
                    <Select defaultValue="asia-saigon">
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asia-saigon">Saigon, Asia</SelectItem>
                            <SelectItem value="asia-bangkok">Bangkok, Asia</SelectItem>
                            <SelectItem value="utc">UTC</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>
                <SettingRow
                    label="Start weeks on"
                    description="The first day of the week in your calendars."
                >
                    <Select defaultValue="monday">
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monday">Monday</SelectItem>
                            <SelectItem value="sunday">Sunday</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>
            </SettingSection>

            <Separator />

            <SettingSection title="Authentication">
                <SettingRow
                    label="Token"
                    description="Manage your API key, a bearer authentication token."
                >
                    <Button variant="outline" size="sm" className="h-8 gap-2 px-3 text-xs">
                        + Create authentication token
                    </Button>
                </SettingRow>
                <SettingRow label="User ID" description="Share this ID if you contact support.">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input value="7nsqk2c2v1R" readOnly className="font-mono text-sm" />
                        <Button variant="ghost" size="icon-sm" className="shrink-0">
                            <CopySimple className="h-4 w-4" />
                        </Button>
                    </div>
                </SettingRow>
            </SettingSection>
        </div>
    )
}

function PreferencesSettingsPane() {
    const [copied, setCopied] = useState(false)
    const workspaceName = "Jason's Workspace"
    const workspaceId = "p2r2nVMXkdxl"

    useEffect(() => {
        if (!copied) return
        const t = setTimeout(() => setCopied(false), 1500)
        return () => clearTimeout(t)
    }, [copied])

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(workspaceId)
            setCopied(true)
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Preferences</DialogTitle>
                <DialogDescription className="mt-1">
                    Manage your workspace details, and set global workspace preferences.
                </DialogDescription>
            </div>

            <Separator />

            <SettingSection title="Information">
                <SettingRow label="Workspace" description="This is the name shown across the workspace.">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-inner">
                            <img src="/logo-wrapper.png" alt="Workspace" className="h-7 w-7" />
                        </div>
                        <Input defaultValue={workspaceName} className="h-9 text-sm" />
                    </div>
                </SettingRow>
            </SettingSection>

            <Separator />

            <SettingSection title="Preferences">
                <SettingRow label="Workspace ID" description="Use this ID when connecting integrations.">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input readOnly value={workspaceId} className="font-mono text-sm" />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleCopyId}
                        >
                            <CopySimple className="h-4 w-4" />
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    </div>
                </SettingRow>
            </SettingSection>
        </div>
    )
}

function IdentitySettingsPane() {
    const samlLink = "#"
    const scimLink = "#"

    const identityCards = [
        {
            id: "saml",
            title: "SAML SSO",
            description:
                "Allow users to log in with SAML single sign-on (SSO). Read the help center article for configuration steps.",
            helpHref: samlLink,
            toggleLabel: "Enable SAML SSO",
            enabled: false,
        },
        {
            id: "scim",
            title: "SCIM",
            description:
                "Use SCIM provisioning to automatically create, update, and delete users. Read the help center article for configuration steps.",
            helpHref: scimLink,
            toggleLabel: "Enable SCIM",
            enabled: false,
        },
    ] as const

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Identity</DialogTitle>
                <DialogDescription className="mt-1">
                    Secure and streamline user access. Enable SAML SSO for single sign-on and SCIM provisioning for automated account management.
                </DialogDescription>
            </div>

            <Separator />

            <div className="space-y-6">
                {identityCards.map((card) => (
                    <div key={card.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{card.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {card.description.split("help center article")[0]}
                            <Link href={card.helpHref} className="text-primary underline underline-offset-4">
                                help center article
                            </Link>{" "}
                            {card.description.split("help center article")[1]}
                        </p>
                        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                            <span className="text-sm text-foreground">{card.toggleLabel}</span>
                            <Switch disabled={!card.enabled} defaultChecked={card.enabled} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2">
                    See plans
                </Button>
                <Button size="sm" className="gap-2">
                    <DiamondsFour className="h-4 w-4" />
                    Upgrade
                </Button>
            </div>
        </div>
    )
}

function BillingSettingsPane() {
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")

    const plans = [
        {
            id: "personal",
            name: "Personal",
            price: "$0",
            period: "per teammate per month",
            badge: null as string | null,
            highlight: true,
            ctaLabel: "Current plan",
        },
        {
            id: "premium",
            name: "Premium",
            price: "$8",
            period: "per teammate per month",
            badge: "-20%",
            highlight: false,
            ctaLabel: "Upgrade",
        },
        {
            id: "business",
            name: "Business",
            price: "$12",
            period: "per teammate per month",
            badge: "-20%",
            highlight: false,
            ctaLabel: "Upgrade",
        },
    ] as const

    const features = [
        { id: "teammates", label: "Teammates", values: ["Up to 4", "Unlimited", "Unlimited"] },
        { id: "tasks", label: "Tasks", values: ["Unlimited", "Unlimited", "Unlimited"] },
        { id: "docs", label: "Docs", values: ["Unlimited", "Unlimited", "Unlimited"] },
        { id: "storage", label: "Storage", values: ["Unlimited", "Unlimited", "Unlimited"] },
        { id: "ai-model", label: "AI model usage", values: ["Unlimited", "Unlimited", "Unlimited"] },
        {
            id: "ai-agents",
            label: "AI agents",
            values: [false, true, true],
        },
        {
            id: "ai-execution",
            label: "AI task execution",
            values: [false, true, true],
        },
        {
            id: "ai-reporting",
            label: "AI reporting",
            values: [false, true, true],
        },
        {
            id: "ai-filling",
            label: "AI task property filling",
            values: [false, true, true],
        },
    ] as const

    const renderValue = (value: string | boolean) => {
        if (typeof value === "string") {
            return <span className="text-sm text-foreground">{value}</span>
        }
        if (value) {
            return <CheckCircle className="h-4 w-4 text-emerald-500" weight="fill" />
        }
        return <span className="text-sm text-muted-foreground">—</span>
    }

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Plans and billing</DialogTitle>
                <DialogDescription className="mt-1">
                    Manage your subscription and billing preferences. Review your current plan, compare features, and
                    adjust your plan as your team grows.
                </DialogDescription>
            </div>

            <Separator />

            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-foreground">Billing period</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={cn("font-medium", billingPeriod === "monthly" && "text-primary")}>Monthly</span>
                            <Switch
                                checked={billingPeriod === "annual"}
                                onCheckedChange={(checked) => setBillingPeriod(checked ? "annual" : "monthly")}
                            />
                            <span className={cn("font-medium", billingPeriod === "annual" && "text-primary")}>Annually</span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background/60">
                    <div className="grid grid-cols-4 border-b border-border bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground">
                        <div></div>
                        {plans.map((plan) => (
                            <div key={plan.id} className="px-3">
                                <div className="flex items-center gap-2">
                                    <span>{plan.name}</span>
                                    {plan.badge && (
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                            {plan.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-2xl font-semibold">{plan.price}</span>
                                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                                </div>
                                <div className="mt-3">
                                    <Button
                                        variant={plan.highlight ? "outline" : "outline"}
                                        size="sm"
                                        className={cn(
                                            "h-8 w-full text-xs",
                                            plan.highlight
                                                ? "border-primary/60 bg-primary/10 text-primary"
                                                : "border-border bg-transparent text-foreground",
                                        )}
                                    >
                                        {plan.ctaLabel}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="divide-y divide-border/80 text-xs">
                        {features.map((feature) => (
                            <div key={feature.id} className="grid grid-cols-4 items-center px-4 py-3">
                                <div className="pr-4 text-sm text-foreground">{feature.label}</div>
                                {feature.values.map((val, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-center border-l border-border/70 px-3 text-center"
                                    >
                                        {renderValue(val)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ImportSettingsPane() {
    const steps = [
        { id: 1, label: "Upload" },
        { id: 2, label: "Select header" },
        { id: 3, label: "Map columns" },
    ] as const

    const columns = [
        { name: "ID", required: false },
        { name: "Title", required: true },
        { name: "Dartboard", required: false },
        { name: "Status", required: false },
        { name: "Description", required: false },
        { name: "Parent ID", required: false },
        { name: "Assignee emails", required: false },
        { name: "Tags", required: false },
        { name: "Priority", required: false },
    ] as const

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Import</DialogTitle>
                <DialogDescription className="mt-1">
                    Bring your existing data into Dart in just a few steps. Upload your file, map your properties, and
                    import tasks seamlessly.
                </DialogDescription>
            </div>

            <Separator />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {steps.map((step, index) => {
                        const isActive = step.id === 1
                        const isLast = index === steps.length - 1
                        const StepIcon = isActive ? CheckCircle : Circle
                        return (
                            <div key={step.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                                <button
                                    type="button"
                                    className={cn(
                                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1",
                                        isActive
                                            ? "border-primary/50 bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground",
                                    )}
                                >
                                    <StepIcon className="h-4 w-4" weight={isActive ? "fill" : "regular"} />
                                    <span className="text-xs font-semibold">{step.id}.</span>
                                    <span>{step.label}</span>
                                </button>
                                {!isLast && <span className="text-sm">›</span>}
                            </div>
                        )
                    })}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center transition hover:border-primary/50 hover:bg-primary/5">
                        <input type="file" className="sr-only" />
                        <UploadSimple className="h-6 w-6 text-primary" />
                        <p className="text-sm font-medium text-foreground">Browse or drag your file here</p>
                        <p className="text-[11px] text-muted-foreground">CSV or XLSX up to 10MB</p>
                    </label>

                    <div className="rounded-2xl border border-border/70 bg-card/70">
                        <div className="grid grid-cols-[minmax(0,1fr)_100px] border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                            <span>Expected column</span>
                            <span className="text-right">Required</span>
                        </div>
                        <div className="divide-y divide-border/70">
                            {columns.map((column) => (
                                <div key={column.name} className="flex items-center justify-between px-4 py-3 text-sm">
                                    <div className="flex items-center gap-2 text-foreground">
                                        <span>{column.name}</span>
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="text-muted-foreground">
                                        {column.required ? <CheckCircle className="h-4 w-4 text-primary" weight="fill" /> : "—"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TypesSettingsPane() {
    const typeNav = [
        { id: "task", label: "Task", icon: "☑" },
        { id: "project", label: "Project", icon: "▲" },
        { id: "workstream", label: "Workstream", icon: "★" },
    ] as const
    const [activeType, setActiveType] = useState<(typeof typeNav)[number]["id"]>("task")

    const workflowGroups = [
        {
            id: "unstarted",
            label: "Unstarted",
            steps: [{ id: "todo", label: "To-do", description: "Tasks that are not started yet", state: "todo", locked: true }],
        },
        {
            id: "started",
            label: "Started",
            steps: [{ id: "doing", label: "Doing", description: "Tasks that are in progress", state: "doing", locked: false }],
        },
        {
            id: "finished",
            label: "Finished",
            steps: [{ id: "done", label: "Done", description: "Tasks that are done", state: "done", locked: true }],
        },
        { id: "canceled", label: "Canceled", steps: [] },
    ] as const

    const stepIcon = (state?: string) => {
        switch (state) {
            case "doing":
                return { Icon: CircleNotch, className: "text-blue-500" }
            case "done":
                return { Icon: CheckCircle, className: "text-green-500" }
            default:
                return { Icon: Spinner, className: "text-muted-foreground" }
        }
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="border-b border-border/60 bg-card/70 lg:border-b-0 lg:border-r">
                    <div className="px-4 py-3 border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Types
                    </div>
                    <div>
                        {typeNav.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveType(item.id)}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm transition",
                                    activeType === item.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted/40",
                                )}
                            >
                                <span className="text-base">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6 bg-background/40 p-6">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Edit type</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <label className="text-xs font-medium text-muted-foreground">Name</label>
                            <Input value={typeNav.find((t) => t.id === activeType)?.label} readOnly className="h-9 text-sm" />
                        </div>
                    </div>

                    <Separator className="bg-border/80" />

                    <div className="space-y-4 pt-2">
                        <p className="text-sm font-semibold text-foreground">Workflow</p>
                        <div className="space-y-6">
                            {workflowGroups.map((group) => (
                                <div key={group.id} className="space-y-3">
                                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <span>{group.label}</span>
                                        <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {group.steps.length > 0 && (
                                        <div className="space-y-2">
                                            {group.steps.map((step) => {
                                                const { Icon, className } = stepIcon(step.state)
                                                return (
                                                    <div
                                                        key={step.id}
                                                        className="flex items-center gap-4 rounded-2xl bg-muted/20 px-4 py-3"
                                                    >
                                                        <span className={cn("flex h-6 w-6 items-center justify-center", className)}>
                                                            <Icon className="h-4 w-4" weight={step.state === "doing" ? "bold" : "regular"} />
                                                        </span>
                                                        <div className="flex flex-1 items-center gap-4 text-sm text-foreground">
                                                            <span className="font-medium">{step.label}</span>
                                                            <span className="flex-1 text-left text-muted-foreground">{step.description}</span>
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            {step.locked ? (
                                                                <LockSimple className="h-4 w-4" />
                                                            ) : step.id === "doing" ? null : (
                                                                <Plus className="h-4 w-4" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NotificationsSettingsPane() {
    const methodItems = [
        {
            id: "in-app",
            title: "In-app",
            description: "Notifications will go into your Dart Inbox",
            enabled: true,
        },
        {
            id: "email",
            title: "Email",
            description: "You will receive emails about Dart events",
            enabled: true,
        },
    ] as const

    const detailCards = [
        {
            id: "recommended",
            title: "Recommended settings",
            description: "Stick with defaults so you never miss an important update and avoid spam.",
            icon: Star,
            highlighted: true,
        },
        {
            id: "custom",
            title: "Custom settings",
            description: "Fine-tune notifications to only receive updates you care about.",
            icon: PencilSimpleLine,
            highlighted: false,
        },
    ] as const

    return (
        <div className="space-y-8">
            <div>
                <DialogTitle className="text-xl">Notifications</DialogTitle>
                <DialogDescription className="mt-1">
                    Stay in the loop without the noise. Choose where you get updates, and customize which activities trigger notifications.
                </DialogDescription>
            </div>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Methods</h3>
                <div className="space-y-3">
                    {methodItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-3"
                        >
                            <div className="flex flex-col">
                                <span className="text-sm text-foreground">{item.title}</span>
                                <span className="text-xs text-muted-foreground">{item.description}</span>
                            </div>
                            <Switch defaultChecked={item.enabled} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {detailCards.map((card) => (
                        <button
                            key={card.id}
                            type="button"
                            className={cn(
                                "flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition shadow-sm",
                                card.highlighted
                                    ? "border-primary/40 bg-primary/5 text-foreground"
                                    : "border-border bg-card/60 text-foreground",
                            )}
                        >
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full",
                                        card.highlighted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    <card.icon className="h-4 w-4" />
                                </span>
                                {card.title}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {card.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function PlaceholderSettingsPane() {
    return (
        <div className="flex h-full flex-col items-start justify-center gap-2">
            <DialogTitle className="text-xl">Settings preview</DialogTitle>
            <DialogDescription>
                This area is reserved for additional settings pages in the full product.
            </DialogDescription>
        </div>
    )
}

function SettingSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-4">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="space-y-5">{children}</div>
        </section>
    )
}

function SettingRow({
    label,
    description,
    children,
}: {
    label: string
    description?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-10 sm:grid sm:grid-cols-[minmax(0,250px)_minmax(0,1fr)] sm:items-center sm:gap-6">
            <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{label}</div>
                {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
            </div>
            <div className="flex flex-col gap-2 text-sm text-foreground">{children}</div>
        </div>
    )
}
