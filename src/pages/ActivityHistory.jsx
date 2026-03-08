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

    useEffect(() => {
        const handleOpenMessages = () => setIsMessageCenterOpen(true);
        window.addEventListener('open-message-center', handleOpenMessages);
        return () => window.removeEventListener('open-message-center', handleOpenMessages);
    }, []);

    const fetchAllTransactions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, businesses(name, logo_url)')
                .eq('profile_id', user.id)
                .order('created_at', { ascending: false });

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
    }, [user]);

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
                    <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">Historial de <span className="text-primary">Actividad</span></h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">TODAS TUS TRANSACCIONES</p>
                </div>
            </header>

            <main className="flex-1 px-6 pt-4">
                {transactions.length > 0 ? (
                    <div className="bg-white rounded-[2rem] border-2 border-[#595A5B] shadow-sm overflow-hidden flex flex-col">
                        {transactions.map((tx, idx) => (
                            <div
                                key={tx.id}
                                className={`py-2.5 px-4 flex items-center justify-between animate-in fade-in duration-300 ${idx !== transactions.length - 1 ? 'border-b border-slate-50' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`size-10 rounded-xl flex items-center justify-center border ${tx.type === 'EARN' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {tx.type === 'EARN' ? 'add_task' : 'redeem'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 tracking-tight">{tx.businesses?.name || 'Comercio'}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {new Date(tx.created_at).toLocaleDateString()} - {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-black text-sm ${tx.type === 'EARN' ? 'text-primary' : 'text-warning'}`}>
                                        {tx.type === 'EARN' ? '+' : ''}{tx.points_amount} pts
                                    </p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mt-0.5">
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
