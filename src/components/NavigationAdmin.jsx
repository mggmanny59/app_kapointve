import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavigationAdmin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (err) {
            console.error('Error logging out:', err);
        }
    };

    const adminNavItems = [
        { path: '/platform-admin', label: 'Comercios', icon: 'storefront' },
        { path: '/platform-reports', label: 'Métricas', icon: 'monitoring' },
        { path: '/platform-broadcast', label: 'Global Push', icon: 'campaign' },
        { path: '/platform-settings', label: 'Sistema', icon: 'settings_applications' },
        { action: 'logout', label: 'Salir', icon: 'logout' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-t border-[#595A5B] flex items-center justify-around px-4 pb-2 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] antialiased">
            {adminNavItems.map((item) => {
                const isActive = item.path && location.pathname === item.path;
                const isLogout = item.action === 'logout';
                
                return (
                    <button
                        key={item.path || item.action}
                        onClick={isLogout ? handleLogout : () => navigate(item.path)}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group min-w-[64px] ${
                            isActive ? 'text-primary' : 
                            isLogout ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <div className={`size-11 rounded-2xl flex items-center justify-center transition-all ${
                            isActive ? 'bg-primary/10 shadow-lg shadow-primary/10 border border-primary/20' : 
                            isLogout ? 'bg-red-50' : 'bg-transparent'
                        }`}>
                            <span className={`material-symbols-outlined !text-2xl ${isActive ? 'font-black scale-105' : 'group-hover:scale-110 font-medium'} transition-transform`}>
                                {item.icon}
                            </span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none transition-all ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default NavigationAdmin;
