import { Search, X } from 'lucide-react';
import { useState } from 'react';
import SearchResults from './SearchResults';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";

const TopBar = () => {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="flex h-16 items-center border-b px-4 bg-background">
            <div className="flex-1">
                {/* Global Search */}
                <div className="relative w-full max-w-md hidden md:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Cari tugas, matkul..."
                            className="w-full pl-9 pr-8 rounded-full bg-muted/50 focus:bg-background transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-muted"
                            >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Clear search</span>
                            </Button>
                        )}
                    </div>

                    {searchQuery && <SearchResults query={searchQuery} closeSearch={() => setSearchQuery('')} />}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <ThemeTogglerButton modes={['light', 'dark']} />
            </div>

            {/* Quick Add Removed as per cleanup request and missing store action */}
        </div>
    );
};

export default TopBar;
