import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../context/MessageContext';
import { sendPushToProfile } from '../lib/pushNotifications';
import NavigationAdmin from '../components/NavigationAdmin';
import SendNotificationModal from '../components/SendNotificationModal';

const PlatformControl = () => {
    const { signOut } = useAuth();
    const { sendMessage } = useMessages();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ active: 0, pending: 0, blocked: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState({ show: false, biz: null, type: null });
    const [selectedBiz, setSelectedBiz] = useState(null); // New state for detailed view
    const [editData, setEditData] = useState({}); // State for editing values
    const [isSaving, setIsSaving] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [pushTarget, setPushTarget] = useState({ businessId: null, name: 'Global' });
    const [pendingPayments, setPendingPayments] = useState([]);
    const [allPayments, setAllPayments] = useState([]);
    const [activeSection, setActiveSection] = useState('businesses');
    const [paymentModal, setPaymentModal] = useState({ show: false, payment: null, daysToAdd: 30, plan: 'KPOINT PLUS' });
    const { showNotification } = useNotification();
    const navigate = useNavigate();

    const fetchLogs = async (businessId) => {
        try {
            setLoadingLogs(true);
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAuditLogs(data || []);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
            showNotification('success', 'Sesión Cerrada', 'Has salido del Centro de Control.');
        } catch (err) {
            showNotification('error', 'Error', 'No se pudo cerrar la sesión.');
        }
    };

    const fetchBusinesses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('businesses')
                .select('*, profiles(full_name, email)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setBusinesses(data || []);

            // Calculate Stats
            const active = data.filter(b => b.registration_status === 'OK' && b.is_active).length;
            const pending = data.filter(b => b.registration_status === 'PENDING').length;
            const blocked = data.filter(b => b.registration_status === 'OK' && !b.is_active).length;
            setStats({ active, pending, blocked });

        } catch (err) {
            console.error('Error fetching businesses:', err);
            showNotification('error', 'Error', 'No se pudieron cargar los comercios.');
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        try {
            // Fetch Pending
            const { data: pending, error: pError } = await supabase
                .from('subscription_payments')
                .select('*, businesses(name, rif, created_at, subscription_expiry, owner_id)')
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });
            if (pError) throw pError;
            setPendingPayments(pending || []);

            // Fetch All Recent
            const { data: all, error: aError } = await supabase
                .from('subscription_payments')
                .select('*, businesses(name, created_at, subscription_expiry)')
                .order('created_at', { ascending: false })
                .limit(20);
            if (aError) throw aError;
            setAllPayments(all || []);
        } catch (err) {
            console.error('Error fetching payments:', err);
        }
    };

    useEffect(() => {
        fetchBusinesses();
        fetchPayments();
    }, []);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const updateBusinessDetails = async () => {
        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('businesses')
                .update({
                    name: editData.name,
                    rif: editData.rif,
                    business_code: editData.business_code,
                    address: editData.address,
                    points_per_dollar: parseInt(editData.points_per_dollar),
                    currency_symbol: editData.currency_symbol,
                    subscription_expiry: editData.subscription_expiry ? new Date(editData.subscription_expiry).toISOString() : null,
                    subscription_plan: editData.subscription_plan
                })
                .eq('id', selectedBiz.id);

            if (error) throw error;
            showNotification('success', 'Éxito', 'Configuración del nodo actualizada.');
            fetchBusinesses();
            // Refresh local selectedBiz to reflect changes if staying in detail view
            setSelectedBiz({ ...selectedBiz, ...editData });
        } catch (err) {
            console.error('Error updating business:', err);
            showNotification('error', 'Error', 'No se pudieron guardar los cambios.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateStatus = async (id, updates) => {
        try {
            const { error } = await supabase
                .from('businesses')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showNotification('success', 'Actualizado', 'El estado del comercio ha sido actualizado.');
            setConfirmModal({ show: false, biz: null, type: null });
            fetchBusinesses();
        } catch (err) {
            showNotification('error', 'Error', 'No se pudo actualizar el estado.');
        }
    };

    const handleProcessPayment = async (status) => {
        try {
            const paymentId = paymentModal.payment.id;
            const businessId = paymentModal.payment.business_id;

            // Actualizar estado del pago
            const { error: paymentError } = await supabase
                .from('subscription_payments')
                .update({ status })
                .eq('id', paymentId);
            if (paymentError) throw paymentError;

            // Si es aprobado, extender la suscripción del negocio
            if (status === 'APPROVED') {
                const b = paymentModal.payment.businesses;
                const currentDate = b?.subscription_expiry ? new Date(b.subscription_expiry) : new Date();
                const newExpiry = new Date(Math.max(currentDate.getTime(), new Date().getTime()));
                newExpiry.setDate(newExpiry.getDate() + parseInt(paymentModal.daysToAdd));

                const { error: bizError } = await supabase
                    .from('businesses')
                    .update({
                        subscription_expiry: newExpiry.toISOString(),
                        subscription_plan: paymentModal.plan,
                        is_active: true
                    })
                    .eq('id', businessId);
                if (bizError) throw bizError;

                // 2. Enviar Notificación Interna y Push al Dueño
                const ownerId = b?.owner_id;
                if (ownerId) {
                    const title = "Pago Procesado";
                    const message = "Tu pago ha sido procesado y tu cuenta ya se encuentra activa. ¡Gracias por tu confianza!";
                    
                    // Notificación Interna
                    await sendMessage(businessId, ownerId, title, message, 'GENERAL');

                    // Push Notification (Prioritaria)
                    await sendPushToProfile({
                        profileId: ownerId,
                        title: title,
                        message: message,
                        url: '/subscription'
                    });
                }
            }

            showNotification('success', 'Pago Procesado', `El pago fue ${status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}.`);
            setPaymentModal({ show: false, payment: null, daysToAdd: 30, plan: 'KPOINT PLUS' });
            fetchPayments();
            fetchBusinesses();
        } catch (error) {
            console.error('Error processing payment:', error);
            showNotification('error', 'Error', 'Ocurrió un error al procesar el pago.');
        }
    };

    const filteredBusinesses = businesses.filter(b =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.rif?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingRequests = businesses.filter(b => b.registration_status === 'PENDING');

    if (loading && businesses.length === 0) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-display pb-32 antialiased">
            {/* Dark Header Area */}
            <div className="bg-[#1e2836] rounded-b-[2rem] px-6 pt-10 pb-8 relative z-10 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h1 className="flex items-center text-xl font-bold text-white tracking-tight leading-none gap-1">
                            <span className="text-primary italic font-black">KP</span>
                            KPannel
                        </h1>
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Super Admin Panel</h2>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 !text-[20px] font-black">search</span>
                        <input
                            type="text"
                            placeholder={activeSection === 'businesses' ? "Search businesses..." : "Search payments..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white h-12 pl-12 pr-4 rounded-xl text-[15px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="size-12 rounded-xl bg-[#2e3b4e] border border-white/5 flex items-center justify-center text-white relative active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined !text-xl">logout</span>
                    </button>
                </div>

                {/* Section Tabs */}
                <div className="flex mt-8 bg-[#2e3b4e] p-1 rounded-2xl gap-1">
                    <button 
                        onClick={() => setActiveSection('businesses')}
                        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeSection === 'businesses' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined !text-lg">storefront</span>
                        Comercios
                    </button>
                    <button 
                        onClick={() => setActiveSection('subscriptions')}
                        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeSection === 'subscriptions' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined !text-lg">payments</span>
                        Suscripciones
                        {pendingPayments.length > 0 && (
                            <span className="size-5 bg-white text-primary text-[10px] rounded-full flex items-center justify-center animate-pulse">
                                {pendingPayments.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {activeSection === 'businesses' ? (
                <>
                    {/* Stats Cards Row */}
                    <div className="px-6 -mt-4 relative z-20 overflow-x-auto pb-4 custom-scrollbar-mini">
                <div className="flex gap-4 min-w-[max-content]">
                    {/* Active Card */}
                    <div className="bg-white rounded-[1.2rem] p-4 w-36 shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-10 rounded-xl bg-[#ff8228] flex items-center justify-center text-white shadow-sm shrink-0">
                                <span className="material-symbols-outlined !text-[20px]">groups</span>
                            </div>
                            <svg className="w-12 h-6 text-[#ff8228] opacity-50" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 18 L12 8 L20 14 L38 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="flex items-end gap-2 mt-4 mb-1">
                            <h3 className="text-[28px] font-bold text-slate-900 leading-none">{stats.active}</h3>
                            <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md mb-1">+5%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Active Businesses</p>
                    </div>

                    {/* Pending Card */}
                    <div className="bg-white rounded-[1.2rem] p-4 w-36 shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-10 rounded-xl bg-[#f5b027] flex items-center justify-center text-white shadow-sm shrink-0">
                                <span className="material-symbols-outlined !text-[20px]">schedule</span>
                            </div>
                            <svg className="w-12 h-6 text-[#f5b027] opacity-50" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 14 L10 16 L18 8 L28 14 L38 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="flex items-end gap-2 mt-4 mb-1">
                            <h3 className="text-[28px] font-bold text-slate-900 leading-none">{stats.pending}</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Pending Businesses</p>
                    </div>

                    {/* Blocked Card */}
                    <div className="bg-white rounded-[1.2rem] p-4 w-36 shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-10 rounded-xl bg-[#ef4444] flex items-center justify-center text-white shadow-sm shrink-0">
                                <span className="material-symbols-outlined !text-[20px]">block</span>
                            </div>
                            <svg className="w-12 h-6 text-[#ef4444] opacity-50" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 6 L12 12 L22 4 L38 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="flex items-end gap-2 mt-4 mb-1">
                            <h3 className="text-[28px] font-bold text-slate-900 leading-none">{stats.blocked}</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Blocked Businesses</p>
                    </div>
                </div>
            </div>

            {/* Pendientes - Only visible if there are pending items, modeled like the alert boxes */}
            {(pendingRequests.length > 0 || pendingPayments.length > 0) && (
                <div className="px-5 mt-2 space-y-3 mb-6">
                    {pendingRequests.map(biz => (
                        <div key={biz.id} className="bg-white border-l-4 border-l-[#f5b027] rounded-[1rem] p-3 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="leading-tight">
                                    <h3 className="text-sm font-bold text-slate-900 truncate">{biz.name}</h3>
                                    <span className="text-[11px] text-slate-500 font-medium">New registration request</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirmModal({ show: true, biz, type: 'APPROVE' })} className="size-9 rounded-lg bg-[#f5b027] text-white flex items-center justify-center hover:bg-amber-500 active:scale-90 transition-all shadow-sm">
                                    <span className="material-symbols-outlined !text-sm">check</span>
                                </button>
                                <button onClick={() => setConfirmModal({ show: true, biz, type: 'REJECT' })} className="size-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all">
                                    <span className="material-symbols-outlined !text-sm">close</span>
                                </button>
                            </div>
                        </div>
                    ))}

                    {pendingPayments.map(payment => (
                        <div key={payment.id} className="bg-white border-l-4 border-l-green-500 rounded-[1rem] p-3 flex items-center justify-between shadow-sm">
                            <div className="leading-tight flex-1">
                                <h3 className="text-sm font-bold text-slate-900 truncate">{payment.businesses?.name}</h3>
                                <span className="text-[11px] text-slate-500 font-medium">Payment verification: ${payment.amount_usd}</span>
                            </div>
                            <button
                                onClick={() => setPaymentModal({ show: true, payment, daysToAdd: 30, plan: 'KPOINT PLUS' })}
                                className="px-4 h-9 rounded-lg bg-green-500 text-white font-bold text-[11px] uppercase tracking-wider hover:bg-green-600 active:scale-95 transition-all shadow-sm"
                            >
                                Process
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Business List */}
            <div className="px-5 mt-2 pb-10">
                <h2 className="text-[17px] font-bold text-slate-900 tracking-[-0.01em] mb-4">
                    Business Overview ({filteredBusinesses.length} Total)
                </h2>

                <div className="flex justify-between items-center text-[12px] font-medium text-slate-500 px-3 mb-3">
                    <span className="flex-1">Business Name</span>
                    <span className="w-[72px] text-left">Plan</span>
                    <span className="w-24 text-center">Quick Actions</span>
                </div>

                <div className="space-y-3">
                    {filteredBusinesses.map((biz) => (
                        <div
                            key={biz.id}
                            onClick={() => {
                                setSelectedBiz(biz);
                                setEditData({
                                    name: biz.name || '',
                                    rif: biz.rif || '',
                                    business_code: biz.business_code || '',
                                    address: biz.address || '',
                                    points_per_dollar: biz.points_per_dollar || 10,
                                    currency_symbol: biz.currency_symbol || '$',
                                    subscription_expiry: biz.subscription_expiry ? biz.subscription_expiry.split('T')[0] : '',
                                    subscription_plan: biz.subscription_plan || 'FREE'
                                });
                            }}
                            className="bg-white p-3.5 rounded-[1.2rem] flex items-center justify-between cursor-pointer shadow-sm border border-slate-100 active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                <div className="size-10 rounded-full bg-slate-100 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                    {biz.logo_url ? (
                                        <img src={biz.logo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-slate-400 !text-xl">store</span>
                                    )}
                                </div>
                                <div className="min-w-0 leading-tight">
                                    <h4 className="font-bold text-slate-900 text-[14px] truncate">{biz.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="size-4 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                            <span className="material-symbols-outlined text-slate-500 !text-[12px]">person</span>
                                        </div>
                                        <p className="text-[11.5px] text-slate-600 truncate font-medium">{biz.profiles?.full_name?.split(' ')[0] || 'Admin'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-[72px] shrink-0 flex items-center justify-start">
                                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
                                    <span className={`size-2 rounded-full ${!biz.is_active ? 'bg-slate-300' : 'bg-green-500'}`}></span>
                                    {biz.is_active ? 'Online' : 'Offline'}
                                </span>
                            </div>

                            <div className="w-24 shrink-0 flex items-center justify-end gap-2 pr-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPushTarget({ 
                                            businessId: biz.id, 
                                            name: biz.name,
                                            ownerClient: {
                                                profile_id: biz.owner_id,
                                                full_name: biz.name // Usamos el nombre del comercio u owner
                                            }
                                        });
                                        setIsNotificationModalOpen(true);
                                    }}
                                    className="size-9 rounded-xl bg-[#ff8228] text-white flex items-center justify-center active:scale-90 transition-all shadow-sm shadow-[#ff8228]/20"
                                >
                                    <span className="material-symbols-outlined !text-[17px] !font-light rounded-full border border-white p-0.5">notifications</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newStatus = !biz.is_active;
                                        setConfirmModal({
                                            show: true,
                                            biz,
                                            type: newStatus ? 'APPROVE' : 'REJECT',
                                            customMessage: newStatus ? `¿Reactivar el nodo "${biz.name}"?` : `¿Bloquear nodo "${biz.name}"?`
                                        });
                                    }}
                                    className="size-9 rounded-xl bg-[#ff8228] text-white flex items-center justify-center active:scale-90 transition-all shadow-sm shadow-[#ff8228]/20"
                                >
                                    <span className="material-symbols-outlined !text-[17px] !font-light rounded-full border border-white p-0.5">
                                        {biz.is_active ? 'block' : 'lock_open'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredBusinesses.length === 0 && (
                        <div className="text-center py-6 text-sm text-slate-500 font-medium">
                            No businesses found.
                        </div>
                    )}
                </div>
            </div>
            </>
            ) : (
                <div className="px-5 mt-6 pb-20 space-y-8">
                    {/* Header de Suscripciones */}
                    <div className="flex items-center justify-between px-1">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Centro de Pagos</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Verificación de suscripciones</p>
                        </div>
                        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase block leading-none mb-1">Pendientes</span>
                            <span className="text-lg font-black text-primary leading-none">{pendingPayments.length}</span>
                        </div>
                    </div>

                    {/* Pagos Pendientes (High Priority) */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
                            Validación Requerida
                        </h3>
                        {pendingPayments.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {pendingPayments.map(payment => (
                                    <div key={payment.id} className="bg-white border-2 border-primary/20 rounded-[1.5rem] p-4 flex flex-col gap-4 shadow-md relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-10 -mt-10"></div>
                                        
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="leading-tight flex-1">
                                                <h3 className="text-[15px] font-black text-slate-900 truncate">{payment.businesses?.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{payment.payment_method}</span>
                                                    <span className="text-[10px] font-mono font-bold text-primary">#{payment.reference_number}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-900 leading-none">${payment.amount_usd}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Vía {payment.bcv_rate} Bs/$</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 relative z-10">
                                            <button
                                                onClick={() => setPaymentModal({ show: true, payment, daysToAdd: 30, plan: 'KPOINT PLUS' })}
                                                className="flex-1 h-11 rounded-xl bg-primary text-white font-black text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-lg">verified</span>
                                                PROCESAR AHORA
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center space-y-3">
                                <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto">
                                    <span className="material-symbols-outlined !text-3xl">done_all</span>
                                </div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No hay pagos pendientes de revisión</p>
                            </div>
                        )}
                    </div>

                    {/* Historial de Pagos Recientes */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Historial de Transacciones (Últimos 20)</h3>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Comercio</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {allPayments.map(pay => (
                                            <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="text-[12px] font-bold text-slate-900 truncate max-w-[120px]">{pay.businesses?.name}</p>
                                                    <p className="text-[9px] font-mono text-slate-400">Ref: {pay.reference_number}</p>
                                                </td>
                                                <td className="px-4 py-3 text-[12px] font-black text-slate-900">
                                                    ${pay.amount_usd}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                        pay.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                                                        pay.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {pay.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[10px] font-medium text-slate-500">
                                                    {new Date(pay.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Admin Navigation Bar */}
            <NavigationAdmin />

            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-full max-w-sm bg-white border-2 border-[#595A5B] rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
                        <div className={`size-20 rounded-[2rem] mx-auto mb-8 flex items-center justify-center border shadow-xl ${confirmModal.type === 'APPROVE' ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-red-50 border-red-100 text-red-500'}`}>
                            <span className="material-symbols-outlined !text-4xl font-black">
                                {confirmModal.type === 'APPROVE' ? 'verified_user' : 'report'}
                            </span>
                        </div>
                        <h3 className="text-2xl font-black text-center text-slate-900 mb-2 uppercase tracking-tight">
                            {confirmModal.type === 'APPROVE' ? '¿Autorizar Acceso?' : '¿Atención!'}
                        </h3>
                        <p className="text-sm text-center text-slate-400 font-bold mb-10 leading-relaxed px-2">
                            {confirmModal.customMessage || (confirmModal.type === 'APPROVE'
                                ? `¿Confirmas la activación de "${confirmModal.biz?.name}"? Podrá operar de inmediato.`
                                : `¿Confirmas que deseas rechazar la solicitud de "${confirmModal.biz?.name}"?`)}
                        </p>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    if (confirmModal.type === 'APPROVE') {
                                        const expiry = new Date();
                                        expiry.setDate(expiry.getDate() + 30);
                                        updateStatus(confirmModal.biz.id, {
                                            registration_status: 'OK',
                                            is_active: true,
                                            subscription_plan: 'BASIC',
                                            subscription_expiry: expiry.toISOString()
                                        });
                                    } else {
                                        updateStatus(confirmModal.biz.id, {
                                            registration_status: confirmModal.biz.registration_status === 'PENDING' ? 'REJECTED' : confirmModal.biz.registration_status,
                                            is_active: false
                                        });
                                    }
                                }}
                                className={`w-full h-16 rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl transition-all active:scale-[0.97] ${confirmModal.type === 'APPROVE' ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-900 text-white shadow-slate-200'}`}
                            >
                                {confirmModal.type === 'APPROVE'
                                    ? (confirmModal.biz?.registration_status === 'PENDING' ? 'AUTORIZAR AHORA' : 'REACTIVAR ACCESO')
                                    : (confirmModal.biz?.registration_status === 'PENDING' ? 'RECHAZAR SOLICITUD' : 'BLOQUEAR ACCESO')}
                            </button>
                            <button
                                onClick={() => setConfirmModal({ show: false, biz: null, type: null })}
                                className="w-full h-14 rounded-full font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all active:scale-95"
                            >
                                VOLVER AL PANEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Business Details View (Full Screen) */}
            {selectedBiz && (
                <div className="fixed inset-0 z-[200] bg-slate-50 animate-in slide-in-from-right duration-300 flex flex-col font-display text-slate-900 overflow-hidden">
                    {/* Header Prominente con el Logo */}
                    <div className="relative h-[30vh] md:h-[35vh] w-full shrink-0 overflow-hidden bg-slate-900">
                        {/* Fondo con Blur del logo o gradiente */}
                        {selectedBiz.logo_url ? (
                            <img
                                src={selectedBiz.logo_url}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-125"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-[#ff6a00]/30"></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-slate-50"></div>

                        {/* Botón Volver */}
                        <button
                            onClick={() => setSelectedBiz(null)}
                            className="absolute top-8 left-6 size-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-95 transition-all z-20"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>

                        {/* Logo Centrado */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                            <div className="size-32 rounded-[2.5rem] bg-white p-5 border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden animate-in zoom-in-50 duration-500">
                                {selectedBiz.logo_url ? (
                                    <img src={selectedBiz.logo_url} alt={selectedBiz.name} className="w-full h-full object-contain" />
                                ) : (
                                    <span className="material-symbols-outlined !text-6xl text-primary font-black">store</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tech-Oriented Dashboard Content */}
                    <div className="flex-1 bg-slate-50 px-4 md:px-6 pb-24 overflow-y-auto -mt-8 relative z-10 custom-scrollbar rounded-t-[2rem] border-t border-white/60 shadow-2xl">
                        <div className="max-w-4xl mx-auto pt-8">
                            
                            {/* SECTION: SYSTEM_MANIFEST (Non-Editable Core Data) */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-black text-primary font-mono tracking-widest uppercase opacity-70">0x01 // SYSTEM_MANIFEST</span>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>
                                
                                <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-6">
                                    {/* UUID Field */}
                                    <div className="md:col-span-2">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">NODE_UID (READ_ONLY)</label>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 group/id">
                                            <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover/id:text-primary transition-colors">fingerprint</span>
                                            <code className="text-[11px] font-mono font-bold text-slate-500 tracking-tighter truncate">
                                                {selectedBiz.id}
                                            </code>
                                        </div>
                                    </div>

                                    {/* Registration Status */}
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">AUTH_STATUS</label>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className={`h-2 w-2 rounded-full ${selectedBiz.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-red-500 animate-pulse'}`}></div>
                                            <p className="text-[11px] font-black text-slate-900 font-mono tracking-tight uppercase">
                                                {selectedBiz.registration_status} // {selectedBiz.is_active ? 'LIVE' : 'LOCKED'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Administrative Metadata */}
                                    <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-50">
                                        <div>
                                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">SYS_ENTRY_DATE</label>
                                            <p className="text-[10px] font-mono font-bold text-slate-600 uppercase">
                                                {new Date(selectedBiz.created_at).toLocaleDateString('es-VE')}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">AUTH_BY_NODE</label>
                                            <p className="text-[10px] font-mono font-bold text-slate-600 uppercase truncate">
                                                {selectedBiz.profiles?.full_name?.split(' ')[0] || 'KOS_ROOT'}
                                            </p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">MGMT_UPLINK</label>
                                            <p className="text-[10px] font-mono font-bold text-slate-600 truncate">
                                                {selectedBiz.profiles?.email || 'OFFLINE'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: NODE_CONFIGURATION (Editable Data) */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-black text-[#ff6a00] font-mono tracking-widest uppercase opacity-70">0x02 // NODE_CONFIGURATION</span>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>

                                <div className="bg-white rounded-2xl border-2 border-slate-900/[0.08] p-5 shadow-inner gap-4 grid grid-cols-1 md:grid-cols-2">
                                    {/* Business Name */}
                                    <div className="md:col-span-2">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span className="size-1 bg-[#ff6a00] rounded-full"></span>
                                            DISPLAY_LABEL
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={editData.name}
                                            onChange={handleEditChange}
                                            placeholder="NODE_NAME"
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-[15px] text-slate-900 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all"
                                        />
                                    </div>

                                    {/* RIF / Tax ID */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span className="size-1 bg-[#ff6a00] rounded-full"></span>
                                            TAX_IDENTIFIER
                                        </label>
                                        <input
                                            type="text"
                                            name="rif"
                                            value={editData.rif}
                                            onChange={handleEditChange}
                                            placeholder="V-00000000-0"
                                            className="w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-mono font-bold text-[13px] text-slate-900 focus:outline-none focus:border-primary/40 transition-all font-mono"
                                        />
                                    </div>

                                    {/* Access Key */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span className="size-1 bg-[#ff6a00] rounded-full"></span>
                                            AUTH_KEY_UPLINK
                                        </label>
                                        <input
                                            type="text"
                                            name="business_code"
                                            value={editData.business_code}
                                            onChange={handleEditChange}
                                            placeholder="SECURE_KEY"
                                            className="w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-mono font-black text-[13px] text-primary tracking-widest focus:outline-none focus:border-primary/40 transition-all uppercase"
                                        />
                                    </div>

                                    {/* Physical Headquarters */}
                                    <div className="md:col-span-2">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span className="size-1 bg-[#ff6a00] rounded-full"></span>
                                            GEOLOCATION_STRING
                                        </label>
                                        <textarea
                                            name="address"
                                            value={editData.address}
                                            onChange={handleEditChange}
                                            rows="2"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-[12px] text-slate-600 focus:outline-none focus:border-primary/40 transition-all resize-none"
                                            placeholder="Enter physical address..."
                                        />
                                    </div>

                                    {/* Fidelity Parameters */}
                                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                        <div className="flex-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">EXCHANGE_RATE (PTS/$)</label>
                                            <input
                                                type="number"
                                                name="points_per_dollar"
                                                value={editData.points_per_dollar}
                                                onChange={handleEditChange}
                                                className="w-full bg-transparent font-mono font-black text-lg text-slate-900 focus:outline-none"
                                            />
                                        </div>
                                        <div className="w-16 h-px bg-slate-200 rotate-90 opacity-40"></div>
                                        <div className="flex-1 pl-4 text-right">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">CURRENCY_BASE</label>
                                            <select
                                                name="currency_symbol"
                                                value={editData.currency_symbol}
                                                onChange={handleEditChange}
                                                className="bg-transparent font-black text-lg text-slate-900 focus:outline-none text-right appearance-none"
                                            >
                                                <option value="$">$ (USD)</option>
                                                <option value="€">€ (EUR)</option>
                                                <option value="Bs">Bs (VES)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Subscription Management (Editable) */}
                                    <div className="bg-[#1e2836] p-4 rounded-xl shadow-lg flex flex-col justify-between">
                                        <div className="flex justify-between items-start mb-2">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">BILLING_MANIFEST</label>
                                            <select
                                                name="subscription_plan"
                                                value={editData.subscription_plan}
                                                onChange={handleEditChange}
                                                className="bg-primary/20 text-primary border border-primary/20 text-[10px] font-black rounded-lg px-2 py-1 focus:outline-none outline-none"
                                            >
                                                <option className="bg-[#1e2836]" value="FREE">FREE_PLAN</option>
                                                <option className="bg-[#1e2836]" value="BASIC">BASIC_NODE</option>
                                                <option className="bg-[#1e2836]" value="PLUS">KPOINT_PLUS</option>
                                                <option className="bg-[#1e2836]" value="PRO">ENTERPRISE_PRO</option>
                                            </select>
                                        </div>
                                        <div className="pt-2">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">EXPIRATION_MARK (EDITABLE)</label>
                                            <input
                                                type="date"
                                                name="subscription_expiry"
                                                value={editData.subscription_expiry}
                                                onChange={handleEditChange}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 font-mono text-xs font-black text-white focus:outline-none focus:border-primary transition-all color-scheme-dark"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: RAW_METADATA */}
                            {selectedBiz.registration_data && Object.keys(selectedBiz.registration_data).length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-black text-slate-400 font-mono tracking-[0.3em] uppercase opacity-50">0x03 // CORE_BLOB_STRUCTURE</span>
                                        <div className="h-px flex-1 bg-slate-100"></div>
                                    </div>
                                    <div className="bg-[#0f172a] p-5 rounded-2xl border border-white/5 relative group overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                                        <pre className="font-mono text-[9px] text-slate-500 leading-normal uppercase whitespace-pre-wrap">
                                            {JSON.stringify(selectedBiz.registration_data, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* CORE ACTIONS */}
                            <div className="flex flex-col md:flex-row gap-3 pt-6 border-t border-slate-100 pb-12">
                                <button
                                    onClick={updateBusinessDetails}
                                    disabled={isSaving}
                                    className="flex-1 h-14 bg-primary text-white rounded-[1.2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <div className="animate-spin size-5 border-2 border-white/30 border-t-white rounded-full"></div>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-xl">commit</span>
                                            DEPLOY_CHANGES
                                        </>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => {
                                        fetchLogs(selectedBiz.id);
                                        setShowLogs(true);
                                    }}
                                    className="h-14 md:w-32 bg-white border-2 border-slate-900 text-slate-900 rounded-[1.2rem] font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-lg">terminal</span>
                                    LOGS
                                </button>
                                
                                <button
                                    onClick={() => setSelectedBiz(null)}
                                    className="h-14 md:w-20 bg-slate-100 text-slate-400 rounded-[1.2rem] font-black text-[10px] flex items-center justify-center hover:text-slate-900 transition-all"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel de Logs (Slide-over) */}
            <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-black shadow-2xl z-[310] transform transition-transform duration-500 ease-in-out border-l border-slate-800 ${showLogs ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    {/* Header del Log */}
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-black">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined">data_object</span>
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-widest">Technical Logs</h3>
                                <p className="text-[10px] text-slate-500 font-mono">{selectedBiz?.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowLogs(false)}
                            className="size-10 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                    </div>

                    {/* Contenido de los Logs */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Stream: audit_trail_v1.0</p>

                        {loadingLogs ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="animate-spin size-8 border-t-2 border-primary rounded-full"></div>
                                <p className="text-[10px] text-slate-500 font-mono animate-pulse tracking-widest uppercase">Fetching Stream...</p>
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <div className="py-20 text-center space-y-2">
                                <span className="material-symbols-outlined text-slate-800 !text-5xl">terminal</span>
                                <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">No activity logged yet</p>
                            </div>
                        ) : (
                            auditLogs.map((log, idx) => (
                                <div key={log.id || idx} className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 hover:border-slate-700 transition-colors group">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-0.5 size-7 rounded-lg flex items-center justify-center ${log.type === 'SUCCESS' ? 'bg-green-500/10 text-green-500' :
                                            log.type === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                                                log.type === 'ERROR' ? 'bg-red-500/10 text-red-500' :
                                                    'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            <span className="material-symbols-outlined !text-[16px]">
                                                {log.type === 'SUCCESS' ? 'check_circle' :
                                                    log.type === 'WARNING' ? 'warning' :
                                                        log.type === 'ERROR' ? 'error' : 'info'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${log.type === 'SUCCESS' ? 'bg-green-500/20 text-green-400' :
                                                    log.type === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                                                        log.type === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {log.label}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">
                                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                                {log.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer con Metadatos */}
                    <div className="p-6 border-t border-slate-800 bg-slate-900/80">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            <span>Status: Monitoring</span>
                            <div className="flex items-center gap-2">
                                <div className="size-1.5 bg-primary rounded-full animate-pulse"></div>
                                <span>Live Feed Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay para cerrar al hacer clic fuera */}
            {showLogs && (
                <div
                    onClick={() => setShowLogs(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] transition-opacity"
                />
            )}

            {/* Notification Modal */}
            <SendNotificationModal
                isOpen={isNotificationModalOpen}
                onClose={() => setIsNotificationModalOpen(false)}
                businessId={pushTarget.businessId}
                targetClient={pushTarget.ownerClient}
            />

            {/* Payment Processing Modal */}
            {paymentModal.show && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-full max-w-sm bg-white border-2 border-[#595A5B] rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
                        {/* Status Icon */}
                        <div className="size-20 rounded-[2rem] mx-auto mb-8 flex items-center justify-center border shadow-xl bg-green-500/10 border-green-500/20 text-green-600">
                            <span className="material-symbols-outlined !text-4xl font-black">payments</span>
                        </div>
                        
                        <h3 className="text-2xl font-black text-center text-slate-900 mb-2 uppercase tracking-tight">Procesar Pago</h3>
                        <p className="text-xs text-center text-slate-400 font-bold mb-8 uppercase tracking-widest">{paymentModal.payment?.businesses?.name}</p>

                        <div className="space-y-6 mb-10">
                            {/* Registration Info */}
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Registro</span>
                                <span className="text-xs font-black text-slate-900">
                                    {paymentModal.payment?.businesses?.created_at ? new Date(paymentModal.payment.businesses.created_at).toLocaleDateString('es-VE') : 'N/A'}
                                </span>
                            </div>

                            <div className="h-px w-full bg-slate-100"></div>

                            {/* Payment Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Referencia</span>
                                    <span className="text-sm font-black text-slate-900">#{paymentModal.payment?.reference_number}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Validado</span>
                                    <span className="text-sm font-black text-primary">${paymentModal.payment?.amount_usd} USD</span>
                                </div>
                            </div>

                            <div className="h-px w-full bg-slate-100"></div>

                            {/* Options */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Añadir Tiempo</label>
                                    <select
                                        value={paymentModal.daysToAdd}
                                        onChange={(e) => setPaymentModal({ ...paymentModal, daysToAdd: e.target.value })}
                                        className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 text-sm font-black text-slate-900 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all appearance-none bg-[url('https://api.iconify.design/material-symbols:expand-more.svg?color=%2394a3b8')] bg-no-repeat bg-[position:calc(100%-1rem)_center] pr-10"
                                    >
                                        <option value={30}>1 Mes (30 días)</option>
                                        <option value={90}>3 Meses (90 días)</option>
                                        <option value={180}>6 Meses (180 días)</option>
                                        <option value={365}>1 Año (365 días)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Plan de Acceso</label>
                                    <select
                                        value={paymentModal.plan}
                                        onChange={(e) => setPaymentModal({ ...paymentModal, plan: e.target.value })}
                                        className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 text-sm font-black text-slate-900 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all appearance-none bg-[url('https://api.iconify.design/material-symbols:expand-more.svg?color=%2394a3b8')] bg-no-repeat bg-[position:calc(100%-1rem)_center] pr-10"
                                    >
                                        <option value="KPOINT PLUS">KPOINT PLUS</option>
                                        <option value="KPOINT PRO">KPOINT PRO</option>
                                        <option value="KPOINT ENTERPRISE">KPOINT ENTERPRISE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="h-px w-full bg-slate-100"></div>

                            {/* Expiration Extension */}
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Próxima Expiración</span>
                                <span className="text-sm font-black text-green-600">
                                    {(() => {
                                        const b = paymentModal.payment?.businesses;
                                        const currentDate = b?.subscription_expiry ? new Date(b.subscription_expiry) : new Date();
                                        const newExpiry = new Date(Math.max(currentDate.getTime(), new Date().getTime()));
                                        newExpiry.setDate(newExpiry.getDate() + parseInt(paymentModal.daysToAdd));
                                        return newExpiry.toLocaleDateString('es-VE');
                                    })()}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => handleProcessPayment('APPROVED')}
                                className="w-full h-16 rounded-[2rem] bg-green-500 text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-green-500/20 active:scale-[0.97] transition-all outline-none"
                            >
                                APROBAR Y EXTENDER
                            </button>
                            <button
                                onClick={() => handleProcessPayment('REJECTED')}
                                className="w-full h-14 rounded-full font-black text-[11px] uppercase tracking-widest text-red-500 hover:bg-red-50 active:scale-95 transition-all outline-none"
                            >
                                RECHAZAR PAGO
                            </button>
                            <button
                                onClick={() => setPaymentModal({ show: false, payment: null, daysToAdd: 30, plan: 'KPOINT PLUS' })}
                                className="w-full h-10 rounded-full font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all outline-none"
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformControl;
