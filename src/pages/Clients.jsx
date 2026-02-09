import React from 'react';
import { useNavigate } from 'react-router-dom';

const Clients = () => {
    const navigate = useNavigate();

    const clients = [
        { id: 1, name: 'Carlos Mendoza', initials: 'CM', lastSeen: 'Hoy', phone: '+58 412-5550123', points: '1,240', color: 'bg-primary/20', textColor: 'text-primary', borderColor: 'border-primary/20' },
        { id: 2, name: 'Maria Silva', initials: 'MS', lastSeen: 'Ayer', phone: '+58 424-9981122', points: '850', color: 'bg-orange-500/20', textColor: 'text-orange-500', borderColor: 'border-orange-500/20' },
        { id: 3, name: 'Jose Rodriguez', initials: 'JR', lastSeen: '3 días', phone: '+58 416-2234455', points: '45', color: 'bg-blue-500/20', textColor: 'text-blue-500', borderColor: 'border-blue-500/20' },
        { id: 4, name: 'Ana Garcia', initials: 'AG', lastSeen: '5 días', phone: '+58 412-8877665', points: '2,100', color: 'bg-purple-500/20', textColor: 'text-purple-500', borderColor: 'border-purple-500/20' },
        { id: 5, name: 'Luis Fernandez', initials: 'LF', lastSeen: '10 días', phone: '+58 424-3322110', points: '320', color: 'bg-primary/20', textColor: 'text-primary', borderColor: 'border-primary/20' },
    ];

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-navy-dark font-display text-white antialiased">
            <header className="pt-8 pb-4 px-6 sticky top-0 bg-navy-dark/80 backdrop-blur-md z-40">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-extrabold tracking-tight">Mis <span className="text-primary">Clientes</span></h1>
                    <div className="flex gap-2">
                        <button className="w-10 h-10 rounded-full bg-navy-card border border-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-300">person_add</span>
                        </button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                        <input
                            className="w-full bg-navy-card border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-primary focus:border-primary placeholder:text-slate-500 outline-none"
                            placeholder="Buscar por nombre o celular..."
                            type="text"
                        />
                    </div>
                    <button className="w-12 h-12 rounded-xl bg-navy-card border border-white/10 flex items-center justify-center text-slate-300">
                        <span className="material-symbols-outlined">tune</span>
                    </button>
                </div>
            </header>

            <div className="px-6 mb-4">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Clientes: 156</span>
                </div>
            </div>

            <main className="px-6 space-y-3">
                {clients.map((client) => (
                    <div
                        key={client.id}
                        className="bg-navy-card p-4 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4 active:bg-white/5 transition-colors cursor-pointer"
                    >
                        <div className={`w-12 h-12 rounded-full ${client.color} flex items-center justify-center border ${client.borderColor} shrink-0`}>
                            <span className={`${client.textColor} font-bold text-lg`}>{client.initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-slate-100 truncate">{client.name}</h3>
                                <span className="text-[10px] text-slate-500 font-medium uppercase">{client.lastSeen}</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">{client.phone}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-accent text-sm">stars</span>
                                <span className="text-sm font-extrabold text-accent">{client.points} pts</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                    </div>
                ))}
            </main>

            {/* Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-50">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">dashboard</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Panel</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-primary">
                    <span className="material-symbols-outlined font-bold">group</span>
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

export default Clients;
