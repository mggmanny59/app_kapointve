import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NavigationAdmin = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const adminNavItems = [
        { path: '/platform-admin', label: 'Comercios', icon: 'storefront' },
        { path: '/platform-reports', label: 'Métricas', icon: 'monitoring' },
        { path: '/platform-broadcast', label: 'Global Push', icon: 'campaign' },
        { path: '/platform-settings', label: 'Sistema', icon: 'settings_applications' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/95 backdrop-blur-2xl border-t border-white/5 flex items-center justify-around px-4 pb-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            {adminNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        {isActive && (
                            <div className="absolute -top-10 w-12 h-12 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                        )}
                        <div className={`size-10 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(57,224,121,0.2)]' : 'bg-transparent'}`}>
                            <span className={`material-symbols-outlined !text-2xl ${isActive ? 'font-bold scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                {item.icon}
                            </span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default NavigationAdmin;
