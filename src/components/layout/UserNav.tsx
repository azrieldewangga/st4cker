import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { useStore } from "@/store/useStoreNew"
import { useNavigate } from "react-router-dom"
import { useTheme } from "@/components/theme-provider"
import { Moon, Sun, Laptop } from "lucide-react"
import { useEffect } from "react"

export function UserNav() {
    const userProfile = useStore(state => state.userProfile);
    const navigate = useNavigate()
    const { setTheme } = useTheme()



    // Keyboard Shortcuts Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl key (or Meta for Mac support, though user asked for Windows specific)
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        navigate("/settings?view=preferences");
                        break;
                    case 'p':
                        // Only trigger if specifically Ctrl+P (not print!)
                        e.preventDefault();
                        navigate("/settings?view=profile");
                        break;

                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={userProfile?.avatar} alt={userProfile?.name ?? "User"} />
                        <AvatarFallback>{userProfile?.name?.charAt(0) ?? "U"}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userProfile?.name ?? "Student"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {userProfile?.major ?? "Major not set"}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate("/settings?view=profile")}>
                        Profile
                        <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings?view=preferences")}>
                        Settings
                        <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuGroup>



            </DropdownMenuContent>
        </DropdownMenu >
    )
}
