import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../context/MessageContext';

const Navigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [userRole, setUserRole] = useState(null);
    const { unreadCount } = useMessages();

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

    // Menú para Comercios (Staff/Admins)
    const businessItems = [
        { path: '/dashboard', label: 'Panel', icon: 'grid_view' },
        { path: '/clients', label: 'Clientes', icon: 'face' },
        { path: '/prizes', label: 'Premios', icon: 'cards' },
        { path: '/subscription', label: 'Plan', icon: 'payments' },
        { path: '/settings', label: 'Ajustes', icon: 'settings' },
        { path: '/platform-admin', label: 'Admin', icon: 'admin_panel_settings', superAdminOnly: true }
    ];

    // Menú para Clientes
    const clientItems = [
        { path: '/my-points', label: 'Puntos', icon: 'token' },
        { path: '/activity-history', label: 'Actividad', icon: 'history' },
        { action: 'messages', label: 'Mensajes', icon: 'mail', showBadge: true }
    ];

    const isClient = userRole === 'client';
    const currentItems = isClient ? clientItems : businessItems;

    // Filtrar por permisos especiales y roles
    const visibleItems = currentItems.filter(item => {
        // 1. Verificar Super Admin
        if (item.superAdminOnly && !user?.is_super_admin) return false;

        // 2. Verificar Miembros de Negocio (Staff vs Owner)
        if (!isClient && userRole !== 'owner' && userRole !== 'manager') {
            // Si es un cajero, solo ve el Panel y la pestaña de Plan
            if (item.path !== '/dashboard' && item.path !== '/subscription') return false;
        }

        // 3. Verificar Expiración (Bloqueo)
        const isExpired = user?.businessStatus?.is_expired && !user?.is_super_admin;
        if (isExpired) {
            // Si está bloqueado por falta de pago, SOLO ve Plan y Salir
            if (item.path !== '/subscription' && item.action !== 'logout') return false;
        }

        return true;
    });

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-2xl border-t border-[#595A5B] flex items-center justify-around px-4 pb-2 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] antialiased">
            {visibleItems.map((item, idx) => {
                const isActive = item.path && location.pathname === item.path;

                const handleClick = () => {
                    if (item.path) {
                        navigate(item.path);
                    } else if (item.action === 'logout') {
                        signOut();
                    } else if (item.action === 'messages') {
                        // Aquí disparamos un evento custom para que MyPoints lo abra
                        window.dispatchEvent(new CustomEvent('open-message-center'));
                    }
                };

                return (
                    <button
                        key={item.path || item.action}
                        onClick={handleClick}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group min-w-[64px] ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <div className={`size-10 rounded-2xl flex items-center justify-center transition-all relative ${isActive ? 'bg-primary/10 shadow-lg shadow-primary/5 border border-primary/20' : 'bg-transparent'}`}>
                            <span className={`material-symbols-outlined !text-[22px] transition-transform ${isActive ? 'font-black scale-110' : 'group-hover:scale-110 font-medium'}`}>
                                {item.icon}
                            </span>

                            {item.showBadge && unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 size-4 bg-primary text-[8px] text-white flex items-center justify-center rounded-full font-black border-2 border-white">
                                    {unreadCount}
                                </span>
                            )}
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
