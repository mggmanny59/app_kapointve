import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavigationAdmin from '../components/NavigationAdmin';

const PlatformControl = () => {
    const { signOut } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ active: 0, pending: 0, blocked: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState({ show: false, biz: null, type: null });
    const { showNotification } = useNotification();
    const navigate = useNavigate();

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
                .select('*')
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
                    <button
                        onClick={handleLogout}
                        className="size-12 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center active:scale-90 transition-all text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 shadow-sm"
                        title="Cerrar Panel"
                    >
                        <span className="material-symbols-outlined font-black">logout</span>
                    </button>
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
                        <div key={biz.id} className="bg-white p-5 rounded-[2rem] border-2 border-[#595A5B] flex items-center justify-between group hover:border-primary/20 hover:shadow-lg hover:shadow-slate-200/50 transition-all shadow-sm">
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
                                onClick={() => {
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
        </div>
    );
};

export default PlatformControl;
