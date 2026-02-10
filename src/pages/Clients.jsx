import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Clients = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchClients = async () => {
            try {
                // 1. Get Business ID
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('business_members(business_id)')
                    .eq('id', user.id)
                    .single();

                const bId = profileData?.business_members?.[0]?.business_id || '00000000-0000-0000-0000-000000000001';


                // 2. Fetch Clients from loyalty_cards
                const { data: clientsData, error } = await supabase
                    .from('loyalty_cards')
                    .select('*, profiles(*)')
                    .eq('business_id', bId)
                    .order('last_activity', { ascending: false });

                if (error) throw error;
                setClients(clientsData || []);
            } catch (err) {
                console.error('Error fetching clients:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchClients();
    }, [user]);

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getLastSeenText = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffInDays < 1) return 'Hoy';
        if (diffInDays === 1) return 'Ayer';
        return `${diffInDays} días`;
    };

    const filteredClients = clients.filter(client =>
        client.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.profiles?.phone?.includes(searchTerm)
    );

    const colors = [
        { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/20' },
        { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/20' },
        { bg: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/20' },
        { bg: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/20' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-navy-dark flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

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
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Clientes: {clients.length}</span>
                </div>
            </div>

            <main className="px-6 space-y-3">
                {filteredClients.length > 0 ? filteredClients.map((client, index) => {
                    const color = colors[index % colors.length];
                    return (
                        <div
                            key={client.id}
                            className="bg-navy-card p-4 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4 active:bg-white/5 transition-colors cursor-pointer"
                        >
                            <div className={`w-12 h-12 rounded-full ${color.bg} flex items-center justify-center border ${color.border} shrink-0`}>
                                <span className={`${color.text} font-bold text-lg`}>{getInitials(client.profiles?.full_name)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-slate-100 truncate">{client.profiles?.full_name || 'Sin nombre'}</h3>
                                    <span className="text-[10px] text-slate-500 font-medium uppercase">{getLastSeenText(client.last_activity)}</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-1">{client.profiles?.phone || 'Sin teléfono'}</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-accent text-sm">stars</span>
                                    <span className="text-sm font-extrabold text-accent">{client.current_points?.toLocaleString() || 0} pts</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                        </div>
                    );
                }) : (
                    <div className="text-center py-10 opacity-50">
                        <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                        <p className="text-sm font-medium">No se encontraron clientes</p>
                    </div>
                )}
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
