import React, { useEffect } from 'react';
import { useStore } from '../../store/useStoreNew';
import { LayoutDashboard, BookOpen, GraduationCap, Calendar, CreditCard } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ThemeToggler } from '@/components/ui/animated/ThemeToggler';

const Sidebar = () => {
    const userProfile = useStore(state => state.userProfile);
    const fetchUserProfile = useStore(state => state.fetchUserProfile);
    const theme = useStore(state => state.theme);
    const setTheme = useStore(state => state.setTheme);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUserProfile();
    }, []);

    // Theme Management - Sync on Mount
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);



    const menus = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { name: 'Assignments', icon: BookOpen, path: '/assignments' },
        { name: 'Performance', icon: GraduationCap, path: '/performance' },
        { name: 'Schedule', icon: Calendar, path: '/schedule' },
        { name: 'Cashflow', icon: CreditCard, path: '/cashflow' },
    ];

    return (
        <div className="drawer-side h-full z-20">
            <label htmlFor="main-drawer" className="drawer-overlay"></label>
            <aside className="bg-base-200 w-20 h-full flex flex-col items-center py-4 transition-colors duration-300 border-r border-base-300">

                <ul className="flex flex-col w-full flex-1 gap-2 items-center pt-2">
                    {menus.map((menu) => (
                        <li key={menu.name} className="w-full flex justify-center px-2">
                            <NavLink
                                to={menu.path}
                                className={({ isActive }) => clsx(
                                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                                    isActive ? "bg-primary text-primary-content shadow-lg shadow-primary/30" : "hover:bg-base-300 text-base-content/70 hover:text-base-content"
                                )}
                                title={menu.name}
                            >
                                <menu.icon size={20} />
                            </NavLink>
                        </li>
                    ))}
                </ul>

                <div className="p-4 flex flex-col gap-6 items-center w-full">
                    {/* Theme Controller (JS Based) */}
                    <ThemeToggler />



                    {/* User profile - Avatar only */}
                    <div
                        onClick={() => navigate('/settings')}
                        className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
                        title="Settings"
                    >
                        <div className="avatar online">
                            <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img src={userProfile?.avatar || "https://ui-avatars.com/api/?name=User"} alt="Avatar" />
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </div >
    );
};

export default Sidebar;
