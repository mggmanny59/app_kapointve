import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const Clients = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientSummary, setClientSummary] = useState(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    const fetchClientSummary = async (client) => {
        setSelectedClient(client);
        setIsLoadingSummary(true);
        try {
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('type, amount_fiat, points_amount')
                .eq('profile_id', client.profile_id)
                .eq('business_id', client.business_id);

            if (error) throw error;

            const summary = transactions.reduce((acc, tx) => {
                if (tx.type === 'EARN') {
                    acc.totalPurchases += 1;
                } else if (tx.type === 'REDEEM') {
                    acc.totalRedeemedPoints += Math.abs(tx.points_amount);
                }
                return acc;
            }, { totalPurchases: 0, totalRedeemedPoints: 0 });

            setClientSummary({
                ...summary,
                currentPoints: client.current_points,
                lifetimePoints: client.total_accumulated_points
            });
        } catch (err) {
            console.error('Error fetching client summary:', err);
        } finally {
            setIsLoadingSummary(false);
        }
    };


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

                // 2. Fetch Business Members (Team) to exclude them
                const { data: teamMembers } = await supabase
                    .from('business_members')
                    .select('profile_id')
                    .eq('business_id', bId);

                const teamIds = teamMembers?.map(m => m.profile_id) || [];

                // 3. Fetch Clients from loyalty_cards
                let query = supabase
                    .from('loyalty_cards')
                    .select('*, profiles(*)')
                    .eq('business_id', bId);

                // Only apply filter if we have team members to exclude
                if (teamIds.length > 0) {
                    query = query.not('profile_id', 'in', `(${teamIds.join(',')})`);
                }

                const { data: clientsData, error } = await query.order('last_activity', { ascending: false });

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
                            onClick={() => fetchClientSummary(client)}
                            className="bg-navy-card p-4 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4 active:bg-white/5 transition-colors cursor-pointer group hover:border-primary/30"
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

            {/* Client Summary Modal - Compact Centered Style */}
            {selectedClient && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy-dark/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-navy-card w-full max-w-[340px] rounded-[2.5rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header & Profile */}
                        <div className="relative p-7 pb-5 bg-gradient-to-b from-white/5 to-transparent border-b border-white/5">
                            <button
                                onClick={() => setSelectedClient(null)}
                                className="absolute top-5 right-5 size-8 rounded-full bg-navy-dark border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all active:scale-90"
                            >
                                <span className="material-symbols-outlined !text-lg">close</span>
                            </button>

                            <div className="flex flex-col items-center">
                                <div className={`size-20 rounded-full mb-4 flex items-center justify-center text-2xl font-black border-4 border-navy-dark bg-primary shadow-[0_0_30px_rgba(57,224,121,0.2)] text-navy-dark`}>
                                    {getInitials(selectedClient.profiles?.full_name)}
                                </div>
                                <h2 className="text-xl font-black text-white tracking-tight leading-tight text-center">{selectedClient.profiles?.full_name}</h2>
                                <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                    <span className="material-symbols-outlined !text-[10px] text-slate-500">phone</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{selectedClient.profiles?.phone || 'Sin contacto'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-7 pt-6 space-y-6">
                            {isLoadingSummary ? (
                                <div className="py-10 flex flex-col items-center justify-center gap-4">
                                    <div className="size-10 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Generando informe...</p>
                                </div>
                            ) : clientSummary && (
                                <>
                                    {/* Main Points Card */}
                                    <div className="text-center space-y-1">
                                        <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em]">Balance Actual</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-4xl font-black text-white">{clientSummary.currentPoints?.toLocaleString()}</span>
                                            <span className="text-sm font-black text-primary uppercase tracking-widest">pts</span>
                                        </div>
                                    </div>

                                    {/* Major Stats Group */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* VISITAS CARD */}
                                        <div className="bg-navy-dark border border-white/5 p-4 rounded-3xl flex flex-col items-center text-center space-y-2">
                                            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                <span className="material-symbols-outlined !text-xl font-black">shopping_bag</span>
                                            </div>
                                            <div>
                                                <p className="text-xl font-black text-white">{clientSummary.totalPurchases}</p>
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Visitas</p>
                                            </div>
                                        </div>

                                        {/* CANJEADOS CARD */}
                                        <div className="bg-navy-dark border border-white/5 p-4 rounded-3xl flex flex-col items-center text-center space-y-2">
                                            <div className="size-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <span className="material-symbols-outlined !text-xl font-black">history</span>
                                            </div>
                                            <div>
                                                <p className="text-xl font-black text-white">{clientSummary.totalRedeemedPoints?.toLocaleString()}</p>
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Canjeados</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TOTAL HISTORICO */}
                                    <div className="bg-navy-dark/50 border border-white/5 p-4 rounded-3xl relative overflow-hidden">
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="size-11 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                                                    <span className="material-symbols-outlined !text-xl font-black">add_moderator</span>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Total Histórico</p>
                                                    <p className="text-lg font-black text-white">{clientSummary.lifetimePoints?.toLocaleString()} <span className="text-[10px] text-orange-500 ml-1">PTS</span></p>
                                                </div>
                                            </div>
                                            <span className="material-symbols-outlined text-white/[0.03] !text-4xl absolute -right-2 top-1/2 -translate-y-1/2 font-black">trending_up</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                onClick={() => setSelectedClient(null)}
                                className="w-full bg-primary text-navy-dark h-14 rounded-full font-black text-[12px] uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(57,224,121,0.2)] active:scale-95 hover:bg-primary/90 transition-all mt-2"
                            >
                                Cerrar Resumen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <Navigation />
        </div>
    );
};

export default Clients;
