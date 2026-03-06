import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        const fetchRole = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('business_members')
                .select('role')
                .eq('profile_id', user.id)
                .maybeSingle();

            setUserRole(data?.role || 'client');
        };
        fetchRole();
    }, [user]);

    const navItems = [
        { path: '/dashboard', label: 'Panel', icon: 'grid_view' },
        { path: '/clients', label: 'Clientes', icon: 'face' },
        { path: '/prizes', label: 'Premios', icon: 'cards' },
        { path: '/settings', label: 'Ajustes', icon: 'settings' },
        { path: '/platform-admin', label: 'Admin', icon: 'admin_panel_settings', superAdminOnly: true }
    ];

    // Filter items based on role and super admin status
    const visibleItems = navItems.filter(item => {
        if (item.superAdminOnly && !user?.is_super_admin) return false;
        if (item.adminOnly && userRole === 'cashier') return false;
        return true;
    });

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-2xl border-t border-[#595A5B] flex items-center justify-around px-4 pb-2 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] antialiased">
            {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group min-w-[64px] ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <div className={`size-10 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-primary/10 shadow-lg shadow-primary/5 border border-primary/20' : 'bg-transparent'}`}>
                            <span className={`material-symbols-outlined !text-[22px] transition-transform ${isActive ? 'font-black scale-110' : 'group-hover:scale-110 font-medium'}`}>
                                {item.icon}
                            </span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none transition-all ${isActive ? 'opacity-100' : 'opacity-85'}`}>
                            {item.label}
                        </span>
                        {isActive && (
                            <div className="absolute -bottom-1 size-1 bg-primary rounded-full shadow-[0_0_8px_rgba(255,101,14,0.6)]" />
                        )}
                    </button>
                );
            })}
        </nav>
    );
};

export default Navigation;
