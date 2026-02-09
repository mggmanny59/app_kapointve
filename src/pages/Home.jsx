import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                setProfile(data);
            } catch (err) {
                console.error('Error fetching profile:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchProfile();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-navy-dark flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-navy-dark font-display text-white antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-xl border border-white/10">
                        <span className="material-symbols-outlined text-primary">storefront</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight"><span className="text-accent">K</span>Point</h1>
                        <p className="text-xs text-slate-400 font-bold leading-tight">Tu monedero digital de recompensas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="w-10 h-10 rounded-full bg-navy-card border border-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-300">notifications</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-navy-card border border-white/10 flex items-center justify-center hover:text-red-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            <main className="px-6 space-y-6">
                {/* Welcome Section (Optional addition to the provided design for UX) */}
                <div className="flex flex-col">
                    <h2 className="text-xl font-extrabold text-white">
                        Hola, <span className="text-primary">{profile?.full_name?.split(' ')[0] || 'Kioskero'}</span> 👋
                    </h2>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-navy-card p-3 rounded-2xl border border-white/5 shadow-lg">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ventas Hoy</p>
                        <p className="text-lg font-extrabold text-white">$142</p>
                    </div>
                    <div className="bg-navy-card p-3 rounded-2xl border border-white/5 shadow-lg">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Puntos</p>
                        <p className="text-lg font-extrabold text-primary">2.4k</p>
                    </div>
                    <div className="bg-navy-card p-3 rounded-2xl border border-white/5 shadow-lg">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Nuevos</p>
                        <p className="text-lg font-extrabold text-accent">12</p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-navy-card p-5 rounded-3xl border border-white/5 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Actividad 7 Días</h2>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">+15% vs sem. ant.</span>
                    </div>
                    <div className="relative h-40 w-full flex items-end justify-between gap-1">
                        <div className="absolute inset-0 chart-gradient rounded-xl overflow-hidden"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[40%] opacity-40 z-10"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[60%] opacity-60 z-10"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[85%] opacity-80 z-10"></div>
                        <div className="w-2 bg-accent rounded-t-full h-[100%] z-10"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[70%] opacity-80 z-10"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[55%] opacity-60 z-10"></div>
                        <div className="w-2 bg-primary rounded-t-full h-[90%] opacity-90 z-10"></div>
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-500 uppercase">
                        <span>Lun</span>
                        <span>Mar</span>
                        <span>Mié</span>
                        <span>Jue</span>
                        <span>Vie</span>
                        <span>Sáb</span>
                        <span>Dom</span>
                    </div>
                </div>

                {/* Action Button */}
                <button className="w-full bg-primary hover:bg-primary/90 text-navy-dark h-16 rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(57,224,121,0.3)] active:scale-[0.98] transition-all">
                    <span className="material-symbols-outlined font-black !text-3xl">qr_code_scanner</span>
                    <span className="text-lg font-extrabold uppercase tracking-tight">Escanear QR de Cliente</span>
                </button>

                {/* Activity Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Actividad Reciente</h2>
                        <a className="text-xs font-bold text-accent" href="#">Ver todo</a>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-navy-card rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary !text-xl">add_task</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Carlos Mendoza</p>
                                    <p className="text-[11px] text-slate-400">Hace 2 minutos</p>
                                </div>
                            </div>
                            <p className="text-sm font-extrabold text-primary">+25 pts</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-navy-card rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-accent !text-xl">stars</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Maria Silva</p>
                                    <p className="text-[11px] text-slate-400">Hace 15 minutos</p>
                                </div>
                            </div>
                            <p className="text-sm font-extrabold text-accent">+50 pts</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-navy-card rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary !text-xl">add_task</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Jose Rodriguez</p>
                                    <p className="text-[11px] text-slate-400">Hace 42 minutos</p>
                                </div>
                            </div>
                            <p className="text-sm font-extrabold text-primary">+15 pts</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-50">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-1 text-primary"
                >
                    <span className="material-symbols-outlined font-bold">dashboard</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Panel</span>
                </button>
                <button
                    onClick={() => navigate('/clients')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">group</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Clientes</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-500">
                    <span className="material-symbols-outlined">featured_seasonal_and_gifts</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Premios</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-500">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes</span>
                </button>
            </nav>
        </div>
    );
};

export default Home;
