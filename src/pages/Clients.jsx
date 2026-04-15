import React, { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import SendNotificationModal from '../components/SendNotificationModal';

const Clients = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientSummary, setClientSummary] = useState(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [recentTransactions, setRecentTransactions] = useState([]);

    // Notification Modal States
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [notificationTarget, setNotificationTarget] = useState(null); // null means broadcast
    const [currentBusinessId, setCurrentBusinessId] = useState(null);

    const fetchClientSummary = async (client) => {
        setSelectedClient(client);
        setIsLoadingSummary(true);
        try {
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*, rewards(name)')
                .eq('profile_id', client.profile_id)
                .eq('business_id', client.business_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecentTransactions(transactions || []);

            const summary = transactions.reduce((acc, tx) => {
                if (tx.type === 'EARN') {
                    acc.totalPurchases += 1;
                    acc.totalPurchasedAmount = (acc.totalPurchasedAmount || 0) + (Number(tx.amount_fiat) || 0);
                } else if (tx.type === 'REDEEM') {
                    acc.totalRedeemedPoints += Math.abs(tx.points_amount);
                }
                return acc;
            }, { totalPurchases: 0, totalRedeemedPoints: 0, totalPurchasedAmount: 0 });

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
                setCurrentBusinessId(bId);

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

        if (user) {
            fetchClients();
            
            // Set up Realtime listener for this business transactions to keep clients updated
            const setupRealtime = async () => {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('business_members(business_id)')
                    .eq('id', user.id)
                    .single();
                
                const bId = profileData?.business_members?.[0]?.business_id;
                if (bId) {
                    const channel = supabase.channel(`business-clients-${bId}`)
                        .on('postgres_changes', {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'transactions',
                            filter: `business_id=eq.${bId}`
                        }, () => {
                            setTimeout(() => fetchClients(), 1000); // 1s delay for trigger processing
                        })
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'loyalty_cards',
                            filter: `business_id=eq.${bId}`
                        }, () => {
                            fetchClients();
                        })
                        .subscribe();
                        
                    return channel;
                }
                return null;
            };
            
            let currentChannel = null;
            setupRealtime().then(channel => {
                if (channel) currentChannel = channel;
            });
            
            return () => {
                if (currentChannel) supabase.removeChannel(currentChannel);
            };
        }
    }, [user]);

    const [filterType, setFilterType] = useState('all'); // 'all', 'vip', 'new', 'active'

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

    const getClientTier = (points) => {
        const total = points || 0;
        if (total > 1500) return { name: 'VIP (Platinum)', class: 'text-primary', level: 3 };
        if (total >= 550) return { name: 'GOLD (Frecuente)', class: 'text-amber-500', level: 2 };
        return { name: 'BRONCE (Nuevo)', class: 'text-slate-400', level: 1 };
    };

    const filteredClients = clients.filter(client => {
        const matchSearch = client.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.profiles?.phone?.includes(searchTerm);

        if (!matchSearch) return false;

        const tier = getClientTier(client.total_accumulated_points);
        if (filterType === 'vip') return tier.level === 3;
        if (filterType === 'gold') return tier.level === 2;
        if (filterType === 'new') return tier.level === 1;
        if (filterType === 'active') return getLastSeenText(client.last_activity) === 'Hoy';

        return true;
    });

    const colors = [
        { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/20' },
        { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/20' },
        { bg: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/20' },
        { bg: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/20' },
    ];

    const [showFilters, setShowFilters] = useState(false);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
                <Icon name="refresh" className="animate-spin text-primary !w-10 !h-10" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#f8fafc] font-display text-slate-900 antialiased">
            <header className="pt-8 pb-4 px-6 sticky top-0 bg-[#f8fafc]/80 backdrop-blur-md z-40 border-b border-[#595A5B]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 shadow-sm border-2 border-[#595A5B]" style={{ borderRadius: '12px' }}>
                            <Icon name="groups" className="text-primary !w-6 !h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Clientes</h2>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">CLIENTES AFILIADOS</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setNotificationTarget(null);
                                setIsNotificationModalOpen(true);
                            }}
                            className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-90 shadow-sm"
                            title="Comunicado Masivo"
                        >
                            <Icon name="campaign" className="!w-5 !h-5" />
                        </button>

                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 !w-5 !h-5" />
                            <input
                                className="w-full bg-white border-2 border-[#595A5B] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 placeholder:text-slate-400 outline-none transition-all shadow-sm"
                                placeholder="Buscar por nombre o celular..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center shadow-sm active:scale-95 transition-all ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-[#595A5B]'}`}
                        >
                            <Icon name="tune" />
                        </button>
                    </div>

                    {showFilters && (
                        <div className="flex gap-2 py-1 overflow-x-auto no-scrollbar animate-in slide-in-from-top-2 duration-300">
                            {[
                                { id: 'all', label: 'Todos', icon: 'groups' },
                                { id: 'vip', label: 'VIP', icon: 'stars' },
                                { id: 'gold', label: 'Gold', icon: 'workspace_premium' },
                                { id: 'new', label: 'Bronce / Nuevos', icon: 'fiber_new' },
                                { id: 'active', label: 'Hoy', icon: 'schedule' }
                            ].map(btn => {
                                // Dynamic active styles per tier
                                let activeStyles = 'bg-primary/10 border-primary text-primary'; // Default/VIP
                                if (btn.id === 'gold') activeStyles = 'bg-amber-100/50 border-amber-500 text-amber-600';
                                if (btn.id === 'new') activeStyles = 'bg-slate-100 border-slate-400 text-slate-500';

                                return (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilterType(btn.id)}
                                        className={`flex items-center gap-2 px-4 h-9 rounded-xl border-2 whitespace-nowrap text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${filterType === btn.id 
                                            ? `${activeStyles} shadow-sm` 
                                            : 'bg-white border-[#595A5B] text-slate-500'}`}
                                    >
                                        <span className="material-symbols-outlined !text-base">{btn.icon}</span>
                                        {btn.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </header>

            <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Panel de Clientes • {clients.length} Registrados</span>
                </div>
            </div>

            <main className="px-6 space-y-4">
                {filteredClients.length > 0 ? filteredClients.map((client, index) => {
                    const isToday = getLastSeenText(client.last_activity) === 'Hoy';
                    
                    // Higher contrast soft colors for cards
                    const cardStyles = [
                        { bg: 'bg-[#FFEFDB]', border: 'border-[#595A5B]' }, // Suave Naranja (más contraste)
                        { bg: 'bg-[#E3F2FD]', border: 'border-[#595A5B]' }  // Suave Azul (más contraste)
                    ];
                    const currentStyle = cardStyles[index % cardStyles.length];
                    
                    // Avatar colors logic
                    const avatarColor = index % 2 === 0 
                        ? { bg: 'bg-white', text: 'text-orange-500', border: 'border-[#595A5B]' }
                        : { bg: 'bg-white', text: 'text-blue-500', border: 'border-[#595A5B]' };

                    const tier = getClientTier(client.total_accumulated_points);
                    
                    return (
                        <div
                            key={client.id}
                            onClick={() => fetchClientSummary(client)}
                            className={`${currentStyle.bg} p-4 rounded-[1.75rem] border-2 ${currentStyle.border} shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer group hover:shadow-lg hover:-translate-y-0.5`}
                        >
                            {/* Avatar Section Tighter */}
                            <div className="relative shrink-0">
                                <div className={`relative w-14 h-14 rounded-2xl ${avatarColor.bg} flex items-center justify-center border-2 ${avatarColor.border} shadow-sm transition-transform duration-500 group-hover:scale-105`}>
                                    <span className={`${avatarColor.text} font-black text-xl tracking-tighter`}>
                                        {getInitials(client.profiles?.full_name)}
                                    </span>
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-white border border-[#595A5B] flex items-center justify-center shadow-sm">
                                    <span className={`size-2 rounded-full ${isToday ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                </div>
                            </div>

                            {/* Client Info */}
                            <div className="flex-1 min-w-0 py-1">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className="font-black text-slate-900 truncate tracking-tight text-lg group-hover:text-primary transition-colors duration-300">
                                        {client.profiles?.full_name || 'Nuevo Cliente'}
                                    </h3>
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border-2 shadow-sm transition-colors ${
                                        isToday 
                                        ? 'bg-green-50 border-green-500/30 text-green-600' 
                                        : 'bg-slate-50 border-[#595A5B] text-slate-500'
                                    }`}>
                                        {getLastSeenText(client.last_activity)}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-slate-500 mb-2">
                                    <Icon name="phone_iphone" className="!w-[14] !h-[14] opacity-40" />
                                    <p className="text-[12px] font-bold tracking-tight">
                                        {client.profiles?.phone || 'Sin número'}
                                    </p>
                                </div>
                                
                                {/* Points Badge - KPIDashboard style */}
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#0F172A] px-3.5 py-1.5 rounded-[1rem] flex items-center gap-2.5 shadow-lg border border-[#1E293B]">
                                        <div className="flex -space-x-1">
                                            <Icon name="stars" className="text-warning !w-[14] !h-[14] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                        </div>
                                        <span className="text-[13px] font-black text-white tracking-tighter flex items-baseline gap-1">
                                            {client.current_points?.toLocaleString() || 0}
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">pts</span>
                                        </span>
                                    </div>
                                    
                                    {/* Visual level progress */}
                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center px-0.5">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nivel {tier.level}</span>
                                            <span className={`text-[8px] font-black uppercase ${tier.class}`}>{tier.name}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                            <div 
                                                className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all duration-1000"
                                                style={{ width: `${Math.min(((client.total_accumulated_points || 0) / 1500) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20 px-10 bg-white rounded-[2rem] border border-dashed border-[#595A5B] shadow-sm">
                        <Icon name="person_off" className="text-slate-200 !text-6xl mb-4" />
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron clientes</p>
                    </div>
                )}
            </main>

            {/* Client Summary Modal */}
            {selectedClient && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                    {/* Top Action Bar */}
                    <div className="sticky top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-white/80 backdrop-blur-md border-b border-[#595A5B]">
                        <div className="size-11" />
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 shadow-sm border-2 border-[#595A5B]" style={{ borderRadius: '12px' }}>
                                <Icon name="person_search" className="text-primary !w-5 !h-5" />
                            </div>
                            <h1 className="text-lg font-black text-slate-800 tracking-tight">Detalle del Cliente</h1>
                        </div>
                        <div className="size-11" />
                    </div>

                    <div className="p-6 space-y-8 pb-32">
                        {/* Compact Orange Profile Card */}
                        <div className="relative overflow-hidden bg-[rgb(255,101,14)] p-5 rounded-[1.5rem] shadow-xl shadow-orange-500/10 text-white">
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-black tracking-tight truncate">{selectedClient.profiles?.full_name}</h2>
                                    <p className="text-[11px] font-bold opacity-80 truncate">{selectedClient.profiles?.email || selectedClient.profiles?.phone || 'sin-contacto@email.com'}</p>
                                </div>
                                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30 shrink-0 ml-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">Miembro {getClientTier(selectedClient.total_accumulated_points).name.split(' ')[0]}</span>
                                </div>
                            </div>
                        </div>

                        {isLoadingSummary ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="size-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">Cargando perfil...</p>
                            </div>
                        ) : clientSummary && (
                            <div className="space-y-8">
                                {/* Key Stats Section */}
                                <div className="space-y-4">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">ESTADÍSTICAS CLAVE</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white border-2 border-[#595A5B] p-6 rounded-[1.5rem] shadow-sm flex flex-col gap-3">
                                            <div className="flex items-center gap-2 text-primary">
                                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Icon name="stars" className="!w-4 !h-4" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider">Puntos Totales</span>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-2xl font-black text-slate-900">{clientSummary.currentPoints?.toLocaleString()}</p>
                                                <div className="flex items-center gap-1 text-[#10b981]">
                                                    <Icon name="trending_up" className="!w-[14] !h-[14]" />
                                                    <span className="text-[10px] font-bold">+150 este mes</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white border-2 border-[#595A5B] p-6 rounded-[1.5rem] shadow-sm flex flex-col gap-3">
                                            <div className="flex items-center gap-2 text-[#2563EB]">
                                                <div className="size-8 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <Icon name="payments" className="!w-4 !h-4" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider">Compras Totales</span>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-2xl font-black text-slate-900">${clientSummary.totalPurchasedAmount?.toLocaleString() || '0.00'}</p>
                                                <div className="flex items-center gap-1 text-[#10b981]">
                                                    <Icon name="trending_up" className="!w-[14] !h-[14]" />
                                                    <span className="text-[10px] font-bold">+5% vs avg</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Visits Section */}
                                <div className="bg-white border-2 border-[#595A5B] p-6 rounded-[1.5rem] shadow-sm space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                                                <Icon name="calendar_today" className="!w-5 !h-5" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Visitas Totales</span>
                                        </div>
                                        <p className="text-2xl font-black text-slate-900">{clientSummary.totalPurchases}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#2563EB] rounded-full transition-all duration-1000"
                                                style={{ width: `${Math.min((clientSummary.totalPurchases / 20) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 text-center">Próxima recompensa a las 20 visitas</p>
                                    </div>
                                </div>

                                {/* Recent Activity Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">ACTIVIDAD RECIENTE</h3>
                                        <button className="text-[11px] font-black text-primary uppercase tracking-wider">Ver todo</button>
                                    </div>
                                    <div className="space-y-3">
                                        {recentTransactions.slice(0, 3).map((tx) => (
                                            <div key={tx.id} className="bg-white p-4 rounded-[1.25rem] border-2 border-[#595A5B] shadow-sm flex items-center gap-4">
                                                <div className={`size-12 rounded-[1rem] flex items-center justify-center shrink-0 ${tx.type === 'EARN' ? 'bg-blue-50 text-[#2563EB]' : 'bg-orange-50 text-orange-500'}`}>
                                                    <span className="material-symbols-outlined">
                                                        {tx.type === 'EARN' ? 'shopping_bag' : 'redeem'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate tracking-tight">
                                                        {tx.type === 'EARN' ? 'Compra en Tienda' : tx.rewards?.name || 'Recompensa Canjeada'}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                                                        {new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(tx.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-black text-slate-900">
                                                        {tx.type === 'EARN' ? `$${tx.amount_fiat || '0.00'}` : (tx.rewards?.name || 'Canje')}
                                                    </p>
                                                    <p className={`text-[11px] font-black ${tx.type === 'EARN' ? 'text-primary' : 'text-slate-500'}`}>
                                                        {tx.type === 'EARN' ? '+' : '-'}{Math.abs(tx.points_amount)} pts
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Fixed Action Footer */}
                    <div className="sticky bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-md border-t border-slate-100 flex gap-4 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                        <button
                            onClick={() => {
                                setNotificationTarget(selectedClient);
                                setIsNotificationModalOpen(true);
                            }}
                            className="flex-1 bg-primary text-white h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="send" className="!w-5 !h-5" />
                            Mensaje
                        </button>
                        <button
                            onClick={() => setSelectedClient(null)}
                            className="flex-1 bg-slate-100 text-slate-600 h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] active:scale-95 transition-all"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <Navigation />

            {/* Notification Sender Modal */}
            <SendNotificationModal
                isOpen={isNotificationModalOpen}
                onClose={() => setIsNotificationModalOpen(false)}
                businessId={currentBusinessId}
                targetClient={notificationTarget}
            />
        </div>
    );
};

export default Clients;
