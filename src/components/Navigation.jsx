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
        { path: '/dashboard', label: 'Panel', icon: 'dashboard' },
        { path: '/clients', label: 'Clientes', icon: 'group' },
        { path: '/prizes', label: 'Premios', icon: 'featured_seasonal_and_gifts', adminOnly: true },
        { path: '/settings', label: 'Ajustes', icon: 'settings' }
    ];

    // Filter items based on role
    const visibleItems = navItems.filter(item => {
        if (item.adminOnly && userRole === 'cashier') return false;
        return true;
    });

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-50">
            {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-primary' : 'text-slate-500 hover:text-primary/70'
                            }`}
                    >
                        <span className={`material-symbols-outlined ${isActive ? 'font-bold' : ''}`}>
                            {item.icon}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default Navigation;
