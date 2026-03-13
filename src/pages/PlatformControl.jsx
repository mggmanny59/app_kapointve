import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavigationAdmin from '../components/NavigationAdmin';
import SendNotificationModal from '../components/SendNotificationModal';

const PlatformControl = () => {
    const { signOut } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ active: 0, pending: 0, blocked: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState({ show: false, biz: null, type: null });
    const [selectedBiz, setSelectedBiz] = useState(null); // New state for detailed view
    const [showLogs, setShowLogs] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [pushTarget, setPushTarget] = useState({ businessId: null, name: 'Global' });
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

    useEffect(() => {
        fetchBusinesses();
    }, []);

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
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-display pb-32 antialiased">
            {/* Header */}
            <div className="p-8 bg-white border-b border-[#595A5B] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="flex justify-between items-center mb-10 relative z-10">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter">
                            <span className="text-primary italic">K</span>
                            <span className="text-slate-900">Pannel</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-black tracking-[0.3em] uppercase mt-1">Plataforma de Control Maestro</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setPushTarget({ businessId: null, name: 'Global' });
                                setIsNotificationModalOpen(true);
                            }}
                            className="size-12 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center active:scale-90 transition-all text-primary hover:bg-primary hover:text-white shadow-sm"
                            title="Comunicado Global"
                        >
                            <span className="material-symbols-outlined font-black">campaign</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="size-12 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center active:scale-90 transition-all text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 shadow-sm"
                            title="Cerrar Panel"
                        >
                            <span className="material-symbols-outlined font-black">logout</span>
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 relative z-10">
                    <div className="bg-white border-2 border-[#595A5B] rounded-[2rem] p-6 text-center shadow-sm hover:shadow-md transition-all">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Activos</p>
                        <p className="text-4xl font-black text-primary tabular-nums">{stats.active}</p>
                    </div>
                    <div className="bg-white border-2 border-[#595A5B] rounded-[2rem] p-6 text-center shadow-sm hover:shadow-md border-b-4 border-b-warning transition-all">
                        <p className="text-[9px] text-warning font-black uppercase tracking-[0.2em] mb-2">Pendientes</p>
                        <p className="text-4xl font-black text-warning tabular-nums">{stats.pending}</p>
                    </div>
                    <div className="bg-white border-2 border-[#595A5B] rounded-[2rem] p-6 text-center shadow-sm hover:shadow-md transition-all">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Bloqueos</p>
                        <p className="text-4xl font-black text-red-500 tabular-nums">{stats.blocked}</p>
                    </div>
                </div>
            </div>

            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
                <div className="px-8 mt-10">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <span className="size-2 rounded-full bg-warning animate-pulse ring-4 ring-warning/20"></span>
                        <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Solicitudes Nuevas</h2>
                    </div>

                    <div className="space-y-4">
                        {pendingRequests.map(biz => (
                            <div key={biz.id} className="bg-white border-2 border-[#595A5B] p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 animate-in slide-in-from-right duration-500 border-l-8 border-l-warning">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight">{biz.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">RIF: {biz.rif || 'NO DEFINIDO'}</p>
                                    </div>
                                    <span className="px-4 py-1.5 bg-warning/10 text-warning text-[9px] font-black rounded-full uppercase tracking-widest border border-warning/20">
                                        REVISIÓN
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmModal({ show: true, biz, type: 'APPROVE' })}
                                        className="flex-1 bg-primary text-white h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                        <span className="material-symbols-outlined !text-xl font-black">verified</span>
                                        Aprobar Comercio
                                    </button>
                                    <button
                                        onClick={() => setConfirmModal({ show: true, biz, type: 'REJECT' })}
                                        className="size-14 bg-white border-2 border-[#595A5B] text-slate-400 rounded-2xl flex items-center justify-center active:scale-95 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm"
                                    >
                                        <span className="material-symbols-outlined font-black">block</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Management Section */}
            <div className="px-8 mt-12 pb-10">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Gestionar Directorio</h2>
                    <span className="text-[10px] font-black text-slate-300 bg-white border-2 border-[#595A5B] px-3 py-1 rounded-full">{filteredBusinesses.length} Comercios</span>
                </div>

                {/* Search Bar */}
                <div className="relative mb-8">
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o RIF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border-2 border-[#595A5B] h-16 pl-14 pr-8 rounded-[1.5rem] text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all shadow-sm"
                    />
                </div>

                <div className="space-y-4">
                    {filteredBusinesses.map(biz => (
                        <div
                            key={biz.id}
                            onClick={() => setSelectedBiz(biz)}
                            className="bg-white p-5 rounded-[2rem] border-2 border-[#595A5B] flex items-center justify-between group hover:border-primary/20 hover:shadow-lg hover:shadow-slate-200/50 transition-all shadow-sm cursor-pointer"
                        >
                            <div className="flex items-center gap-5 min-w-0">
                                <div className={`size-14 rounded-3xl flex items-center justify-center ${biz.is_active ? 'bg-primary/5 text-primary' : 'bg-red-50/5 text-red-500'} border-2 border-[#595A5B] shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined !text-3xl font-black">
                                        {biz.is_active ? 'store' : 'storefront'}
                                    </span>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <h4 className="font-black text-slate-900 text-[15px] truncate tracking-tight">{biz.name}</h4>
                                    <div className="flex items-center gap-3">
                                        {!biz.is_active ? (
                                            <span className="text-[8px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-100">
                                                Bloqueado
                                            </span>
                                        ) : biz.registration_status === 'PENDING' ? (
                                            <span className="text-[8px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-warning/10">
                                                Pendiente
                                            </span>
                                        ) : (
                                            <span className="text-[8px] bg-primary/5 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-primary-light/10">
                                                Online
                                            </span>
                                        )}
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">RIF: {biz.rif || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPushTarget({ businessId: biz.id, name: biz.name });
                                    setIsNotificationModalOpen(true);
                                }}
                                className="size-11 rounded-full bg-primary/5 text-primary hover:bg-primary hover:text-white border border-primary/20 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                                title="Enviar Aviso"
                            >
                                <span className="material-symbols-outlined !text-lg font-black">campaign</span>
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent opening details modal
                                    const newStatus = !biz.is_active;
                                    if (newStatus) {
                                        setConfirmModal({
                                            show: true,
                                            biz,
                                            type: 'APPROVE',
                                            customMessage: `¿Reactivar el acceso de "${biz.name}"?`
                                        });
                                    } else {
                                        setConfirmModal({
                                            show: true,
                                            biz,
                                            type: 'REJECT',
                                            customMessage: `¿Bloquear el acceso para "${biz.name}"? Sus operaciones quedarán suspendidas.`
                                        });
                                    }
                                }}
                                className={`size-11 rounded-full flex items-center justify-center transition-all active:scale-[0.85] shadow-sm ${biz.is_active
                                    ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100'
                                    : 'bg-primary/5 text-primary hover:bg-primary hover:text-white border border-primary/20'
                                    }`}
                                title={biz.is_active ? 'Bloquear' : 'Desbloquear'}
                            >
                                <span className="material-symbols-outlined !text-lg font-black">
                                    {biz.is_active ? 'block' : 'lock_open'}
                                </span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
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
                                        updateStatus(confirmModal.biz.id, {
                                            registration_status: 'OK',
                                            is_active: true
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

                    {/* Contenido del Dashboard Técnico */}
                    <div className="flex-1 bg-slate-50 px-4 md:px-8 pb-32 overflow-y-auto -mt-10 relative z-10 custom-scrollbar rounded-t-[2.5rem] border-t border-white/40 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.1)]">
                        <div className="max-w-5xl mx-auto pt-12">
                            {/* Title Section Compacted */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b-2 border-slate-100 pb-6">
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2.5 w-2.5 rounded-full ${selectedBiz.is_active ? 'bg-primary shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'} animate-pulse`}></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                            NODE: {selectedBiz.is_active ? 'ACTIVE' : 'LOCKED'}
                                        </p>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight truncate px-0.5" title={selectedBiz.name}>
                                        {selectedBiz.name}
                                    </h2>

                                    {/* UUID Highlighted Compact */}
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border-2 border-[#595A5B]/20 hover:border-[#595A5B]/60 transition-colors group/uuid">
                                        <span className="material-symbols-outlined text-[12px] text-slate-400 group-hover/uuid:text-primary transition-colors">fingerprint</span>
                                        <p className="text-[10px] font-black text-slate-500 font-mono tracking-tighter tabular-nums">
                                            <span className="text-slate-300 mr-2 text-[8px] tracking-widest uppercase">UUID</span>
                                            {selectedBiz.id}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 shrink-0">
                                    <div className="bg-white border-2 border-[#595A5B] px-4 py-3 rounded-xl shadow-sm min-w-[120px]">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Registration</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xl font-black text-primary tracking-tighter">{selectedBiz.registration_status}</p>
                                            <span className="material-symbols-outlined text-primary-light/30 text-sm">verified</span>
                                        </div>
                                    </div>
                                    <div className="bg-white border-2 border-[#595A5B] px-4 py-3 rounded-xl shadow-sm min-w-[120px]">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Plan</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xl font-black text-slate-900 tracking-tighter font-mono">{selectedBiz.subscription_plan || 'FREE'}</p>
                                            <span className="material-symbols-outlined text-slate-200 text-sm">workspace_premium</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                                {/* Left Column: Core Data */}
                                <div className="lg:col-span-2 space-y-4">
                                    {/* Primary Identifiers Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-white border shadow-sm rounded-xl p-4 border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">RIF / Tax ID</label>
                                                <span className="material-symbols-outlined text-slate-300 text-sm">fingerprint</span>
                                            </div>
                                            <p className="text-base font-black text-slate-900 tracking-tight font-mono">{selectedBiz.rif || 'UNREGISTERED'}</p>
                                        </div>
                                        <div className="bg-white border shadow-sm rounded-xl p-4 border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Access Key</label>
                                                <span className="material-symbols-outlined text-primary text-sm">key</span>
                                            </div>
                                            <p className="text-base font-black text-primary tracking-widest font-mono">{selectedBiz.business_code || '---'}</p>
                                        </div>
                                    </div>

                                    {/* Location & Context */}
                                    <div className="space-y-3">
                                        <div className="bg-white border shadow-sm rounded-xl p-5 border-slate-200">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="material-symbols-outlined text-slate-400 text-sm">location_on</span>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Physical Headquarters</label>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed border-l-2 border-slate-100 pl-4 py-1">
                                                {selectedBiz.address || 'No physical address provided.'}
                                            </p>
                                        </div>

                                        {/* Affiliation Highlight */}
                                        <div className="bg-[#1E293B] rounded-xl p-5 shadow-xl relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
                                            <div className="relative flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined text-sm">analytics</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">System Entry Date</p>
                                                        <p className="text-base font-black text-white tracking-tight">
                                                            {new Date(selectedBiz.created_at).toLocaleDateString('es-VE', {
                                                                day: 'numeric', month: 'long', year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-mono text-primary font-black">
                                                        {new Date(selectedBiz.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fidelity Parameters */}
                                    <div className="pt-1">
                                        <div className="bg-slate-100/50 p-5 rounded-xl border border-slate-200 space-y-4">
                                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Fidelity Parameters</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-black">
                                                        <span className="material-symbols-outlined !text-lg">stars</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Rate (Pts/$)</p>
                                                        <p className="font-black text-slate-900 text-sm tabular-nums">{selectedBiz.points_per_dollar || 10}.00</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 font-black">
                                                        <span className="material-symbols-outlined !text-lg">payments</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Currency Base</p>
                                                        <p className="font-black text-slate-900 text-sm">{selectedBiz.currency_symbol || '$'} USD</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Management & Meta */}
                                <div className="space-y-4">
                                    {/* Owner Information Card */}
                                    <div className="bg-white border shadow-sm rounded-xl overflow-hidden border-slate-200">
                                        <div className="bg-slate-900 p-3 border-b border-slate-800">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Administration Node</p>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <span className="material-symbols-outlined text-slate-300 text-sm">account_box</span>
                                                <div className="min-w-0">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">Assigned Manager</label>
                                                    <p className="font-black text-slate-900 text-[12px] break-words leading-tight uppercase">
                                                        {selectedBiz.profiles?.full_name || 'UNDEFINED'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="h-px bg-slate-50"></div>
                                            <div className="flex items-start gap-3">
                                                <span className="material-symbols-outlined text-slate-300 text-sm">alternate_email</span>
                                                <div className="min-w-0">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">Management Contact</label>
                                                    <p className="font-bold text-slate-600 text-[11px] break-all leading-tight">
                                                        {selectedBiz.profiles?.email || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subscription Management */}
                                    <div className="bg-white border shadow-sm rounded-xl p-5 border-slate-200 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Billing Cycle</label>
                                            <span className="material-symbols-outlined text-slate-200 text-xs">published_with_changes</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2.5 rounded-full ${selectedBiz.subscription_expiry ? 'bg-primary' : 'bg-slate-300'}`}></div>
                                            <p className="text-[11px] font-black text-slate-900">
                                                {selectedBiz.subscription_expiry ? 'ANNUAL PREPAID' : 'LIFETIME ACCESS'}
                                            </p>
                                        </div>
                                        {selectedBiz.subscription_expiry && (
                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                <p className="text-[7px] text-slate-400 uppercase font-black mb-0.5">Valid Until</p>
                                                <p className="text-[10px] font-bold text-slate-700">
                                                    {new Date(selectedBiz.subscription_expiry).toLocaleDateString()}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Shortcuts */}
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <button className="bg-slate-900 text-white h-10 rounded-lg flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all">
                                            <span className="material-symbols-outlined text-xs">edit</span> EDIT
                                        </button>
                                        <button
                                            onClick={() => {
                                                fetchLogs(selectedBiz.id);
                                                setShowLogs(true);
                                            }}
                                            className="bg-white border-2 border-slate-900 text-slate-900 h-10 rounded-lg flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-xs">print</span> LOGS
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Technical Meta Section (Full Width) */}
                            {selectedBiz.registration_data && Object.keys(selectedBiz.registration_data).length > 0 && (
                                <div className="mt-12">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-px flex-1 bg-slate-200"></div>
                                        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                                            <span className="material-symbols-outlined text-slate-400 text-xs">code</span>
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">RAW DATA COMPONENT</span>
                                        </div>
                                        <div className="h-px flex-1 bg-slate-200"></div>
                                    </div>
                                    <div className="bg-[#0f172a] p-8 rounded-[2rem] shadow-2xl overflow-hidden relative group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-transparent to-primary/40 opacity-30"></div>
                                        <pre className="font-mono text-[10px] text-slate-400 leading-relaxed uppercase overflow-x-auto custom-scrollbar-mini">
                                            {JSON.stringify(selectedBiz.registration_data, null, 4)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Exit Action */}
                            <div className="mt-16 text-center">
                                <button
                                    onClick={() => setSelectedBiz(null)}
                                    className="inline-flex items-center gap-4 px-12 h-16 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.5em] active:scale-[0.98] transition-all shadow-2xl"
                                >
                                    <span className="material-symbols-outlined !text-xl">arrow_back</span>
                                    DASHBOARD EXIT
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
            />
        </div>
    );
};

export default PlatformControl;
