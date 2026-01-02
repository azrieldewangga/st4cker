import { Input } from "@/components/ui/input"

export function Search({ onClick }: { onClick?: () => void }) {
    return (
        <div onClick={onClick} className="cursor-pointer">
            <Input
                type="search"
                placeholder="Search... (Ctrl+F)"
                className="md:w-[100px] lg:w-[300px] pointer-events-none" // prevent typing, force click
                readOnly
            />
        </div>
    )
}
