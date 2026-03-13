import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';
import MessageCenter from '../components/MessageCenter';

const ActivityHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
    
    // Filtros
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(today);
    const [selectedOperator, setSelectedOperator] = useState(''); // Estado temporal para el selector
    
    const [appliedFilters, setAppliedFilters] = useState({ 
        start: '', 
        end: today, 
        operatorId: '' 
    });

    const [operators, setOperators] = useState([]);
    const [userBizId, setUserBizId] = useState(null);

    useEffect(() => {
        const handleOpenMessages = () => setIsMessageCenterOpen(true);
        window.addEventListener('open-message-center', handleOpenMessages);
        return () => window.removeEventListener('open-message-center', handleOpenMessages);
    }, []);

    const fetchAllTransactions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Verificar perfil y obtener negocio/rol
            const { data: profileData } = await supabase
                .from('profiles')
                .select('business_members(business_id, role, businesses(name))')
                .eq('id', user.id)
                .single();

            const memberInfo = profileData?.business_members?.[0];
            const bizId = memberInfo?.business_id;
            setUserBizId(bizId);
            const isStaff = memberInfo?.role && ['owner', 'manager', 'cashier'].includes(memberInfo.role);

            // 2. Si es staff, cargar lista de operadores (solo una vez)
            if (isStaff && operators.length === 0) {
                const { data: staffData } = await supabase
                    .from('business_members')
                    .select('profile_id, profiles(full_name)')
                    .eq('business_id', bizId);
                
                const ops = staffData?.map(m => ({
                    id: m.profile_id,
                    name: m.profiles?.full_name || 'Sin nombre'
                })) || [];
                setOperators(ops);
            }

            // 3. Preparar consulta base
            let query;
            if (isStaff) {
                query = supabase
                    .from('transactions')
                    .select('*, customer:profiles!profile_id(full_name), staff:profiles!staff_id(full_name)')
                    .eq('business_id', bizId);
            } else {
                query = supabase
                    .from('transactions')
                    .select('*, businesses(name, logo_url)')
                    .eq('profile_id', user.id);
            }

            // 4. Aplicar filtros aplicados
            if (appliedFilters.start) {
                query = query.gte('created_at', `${appliedFilters.start}T00:00:00Z`);
            }
            if (appliedFilters.end) {
                query = query.lte('created_at', `${appliedFilters.end}T23:59:59Z`);
            }
            if (appliedFilters.operatorId) {
                query = query.eq('staff_id', appliedFilters.operatorId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            showNotification('error', 'Error', 'No se pudieron cargar las actividades.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllTransactions();
    }, [user, appliedFilters]);

    const handleApplyFilters = () => {
        setAppliedFilters({ 
            start: startDate, 
            end: endDate, 
            operatorId: selectedOperator 
        });
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate(today);
        setSelectedOperator('');
        setAppliedFilters({ 
            start: '', 
            end: today, 
            operatorId: '' 
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#F0F2F5] font-display text-slate-900 antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center gap-4 sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">Últimos <span className="text-primary">Movimientos</span></h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">HISTORIAL COMPLETO</p>
                </div>
            </header>

            <main className="flex-1 px-6 pt-4">
                {/* Panel de Control de Filtros */}
                <div className="space-y-3 mb-8">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border-2 border-[#595A5B] rounded-2xl p-3 shadow-sm flex flex-col gap-1 transition-all focus-within:border-primary">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Desde</label>
                            <input 
                                type="date" 
                                className="text-sm font-black text-slate-800 bg-transparent outline-none appearance-none w-full"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="bg-white border-2 border-[#595A5B] rounded-2xl p-3 shadow-sm flex flex-col gap-1 transition-all focus-within:border-primary">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Hasta</label>
                            <input 
                                type="date" 
                                className="text-sm font-black text-slate-800 bg-transparent outline-none appearance-none w-full"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Selector de Operador (ListBox) */}
                    {operators.length > 0 && (
                        <div className="bg-white border-2 border-[#595A5B] rounded-2xl p-3 shadow-sm flex flex-col gap-1 transition-all focus-within:border-primary">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Operador</label>
                            <select 
                                className="text-sm font-black text-slate-800 bg-transparent outline-none w-full"
                                value={selectedOperator}
                                onChange={(e) => setSelectedOperator(e.target.value)}
                            >
                                <option value="">Todos los operadores</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleApplyFilters}
                            className="flex-1 bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                            Aplicar Filtro
                        </button>
                        <button 
                            onClick={handleClearFilters}
                            className="w-12 bg-white border-2 border-[#595A5B] text-slate-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                            title="Limpiar filtros"
                        >
                            <span className="material-symbols-outlined">filter_alt_off</span>
                        </button>
                    </div>
                </div>

                {/* Listado Directo (Sin Tarjetas) */}
                {transactions.length > 0 ? (
                    <div className="flex flex-col">
                        {transactions.map((tx, idx) => (
                            <div
                                key={tx.id}
                                className={`py-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300 ${idx !== transactions.length - 1 ? 'border-b-2 border-slate-200' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`size-11 rounded-full flex items-center justify-center border-2 shrink-0 ${tx.type === 'EARN' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-warning/5 text-warning border-warning/20'}`}>
                                        <span className="material-symbols-outlined text-2xl font-bold">
                                            {tx.type === 'EARN' ? 'add_task' : 'celebration'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[15px] font-black text-slate-900 truncate tracking-tight leading-none mb-1.5">
                                            {tx.customer?.full_name || tx.businesses?.name || 'Transacción'}
                                        </p>
                                        <div className="flex flex-col gap-0.5">
                                            {tx.staff?.full_name && (
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight">
                                                    Atendido por: {tx.staff.full_name}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-slate-400 font-bold">
                                                {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <p className={`font-black text-[16px] leading-none ${tx.type === 'EARN' ? 'text-primary' : 'text-warning'}`}>
                                        {tx.type === 'EARN' ? '+' : ''}{tx.points_amount} pts
                                    </p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.15em] mt-1.5 opacity-80">
                                        {tx.type === 'EARN' ? 'ACUMULADO' : 'CANJEADO'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 font-black">history</span>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Aún no tienes actividad registrada</p>
                    </div>
                )}
            </main>

            <Navigation />
            <MessageCenter
                isOpen={isMessageCenterOpen}
                onClose={() => setIsMessageCenterOpen(false)}
            />
        </div>
    );
};

export default ActivityHistory;
