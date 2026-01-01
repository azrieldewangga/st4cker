import React from 'react';
import { useStore } from '../../store/useStore';
import { Assignment } from '../../types/models';
import { BookOpen, GraduationCap, Calendar, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SearchResultsProps {
    query: string;
    closeSearch: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ query, closeSearch }) => {
    const { assignments } = useStore();

    if (!query) return null;

    const lowerQuery = query.toLowerCase();

    // Filter Logic
    const filteredAssignments = assignments.filter(a =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.courseId.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit 5

    // Dummy logic for other modules
    const filteredCourses = [].filter((c: any) => c.name.includes(lowerQuery));

    const hasResults = filteredAssignments.length > 0 || filteredCourses.length > 0;

    return (
        <div className="absolute top-full mt-2 left-0 w-full bg-popover shadow-xl rounded-lg border border-border z-50 max-h-96 overflow-y-auto">
            {!hasResults ? (
                <div className="p-4 text-center opacity-50">No results found for "{query}"</div>
            ) : (
                <div className="py-2">
                    {/* Assignments Group */}
                    {filteredAssignments.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-xs font-bold opacity-50 uppercase tracking-wider bg-muted/50">
                                Assignments
                            </div>
                            {filteredAssignments.map(item => (
                                <Link
                                    key={item.id}
                                    to="/assignments"
                                    onClick={closeSearch}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                                >
                                    <BookOpen size={16} className="opacity-70" />
                                    <div>
                                        <div className="font-medium text-sm">{item.title}</div>
                                        <div className="text-xs opacity-50">{item.courseId} • {item.deadline.split('T')[0]}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Dummy Other Groups */}
                    {/* Can extend here */}
                </div>
            )}
        </div>
    );
};

export default SearchResults;
