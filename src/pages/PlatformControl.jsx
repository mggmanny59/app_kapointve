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
            <div className="min-h-screen bg-navy-dark flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-navy-dark text-white font-display pb-32">
            {/* Header */}
            <div className="p-8 bg-gradient-to-b from-navy-card to-transparent">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter">
                            <span className="text-accent">K</span>
                            <span className="text-white">Pannel</span>
                        </h1>
                        <p className="text-xs text-slate-400 font-bold tracking-[0.3em] uppercase mt-1">Centro de Control de Plataforma</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="size-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center active:scale-90 transition-all text-red-500"
                        title="Cerrar Sesión"
                    >
                        <span className="material-symbols-outlined font-bold">power_settings_new</span>
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-10">
                    <div className="bg-navy-dark/50 border border-white/5 rounded-[2rem] p-6 text-center group hover:border-primary/30 transition-all">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Activos</p>
                        <p className="text-3xl font-black text-primary group-hover:scale-110 transition-transform">{stats.active}</p>
                    </div>
                    <div className="bg-navy-dark/50 border border-white/5 rounded-[2rem] p-6 text-center group hover:border-accent/30 transition-all">
                        <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em] mb-2">Pendientes</p>
                        <p className="text-3xl font-black text-accent group-hover:scale-110 transition-transform">{stats.pending}</p>
                    </div>
                    <div className="bg-navy-dark/50 border border-white/5 rounded-[2rem] p-6 text-center group hover:border-red-500/30 transition-all">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Bloqueados</p>
                        <p className="text-3xl font-black text-red-500 group-hover:scale-110 transition-transform">{stats.blocked}</p>
                    </div>
                </div>
            </div>

            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
                <div className="px-8 mt-4">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <span className="size-2 rounded-full bg-accent animate-pulse"></span>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Solicitudes Nuevas</h2>
                    </div>

                    <div className="space-y-4">
                        {pendingRequests.map(biz => (
                            <div key={biz.id} className="bg-navy-card border-l-4 border-l-accent p-6 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-right duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-black text-white leading-tight">{biz.name}</h3>
                                        <p className="text-xs text-slate-500 font-bold mt-1">RIF: {biz.rif || 'N/A'}</p>
                                    </div>
                                    <span className="px-3 py-1 bg-accent/20 text-accent text-[9px] font-black rounded-full uppercase tracking-widest border border-accent/20">
                                        Por Aprobar
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmModal({ show: true, biz, type: 'APPROVE' })}
                                        className="flex-1 bg-primary text-navy-dark h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined !text-xl">check_circle</span>
                                        Autorizar Acceso
                                    </button>
                                    <button
                                        onClick={() => setConfirmModal({ show: true, biz, type: 'REJECT' })}
                                        className="size-12 bg-white/5 border border-white/10 text-slate-400 rounded-2xl flex items-center justify-center active:scale-95 hover:text-red-500 transition-all"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Management Section */}
            <div className="px-8 mt-10">
                <div className="flex justify-between items-center mb-6 px-2">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Gestionar Comercios</h2>
                    <span className="text-[10px] font-black text-slate-600">{filteredBusinesses.length} Total</span>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o RIF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-navy-card border border-white/10 h-14 pl-12 pr-6 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                    />
                </div>

                <div className="space-y-3">
                    {filteredBusinesses.map(biz => (
                        <div key={biz.id} className="bg-navy-card/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between group">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`size-12 rounded-2xl flex items-center justify-center ${biz.is_active ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'} border border-white/5 shrink-0`}>
                                    <span className="material-symbols-outlined !text-2xl">
                                        {biz.is_active ? 'store' : 'store_front'}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-white text-sm truncate">{biz.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        {!biz.is_active ? (
                                            <span className="text-[9px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-red-500/20">
                                                Bloqueado
                                            </span>
                                        ) : biz.registration_status === 'PENDING' ? (
                                            <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-accent/20">
                                                Pendiente
                                            </span>
                                        ) : (
                                            <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-primary/20">
                                                Activo
                                            </span>
                                        )}
                                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{biz.rif || 'Sin RIF'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const newStatus = !biz.is_active;
                                        if (newStatus) {
                                            setConfirmModal({
                                                show: true,
                                                biz,
                                                type: 'APPROVE',
                                                customMessage: `¿Deseas reactivar el acceso para "${biz.name}"?`
                                            });
                                        } else {
                                            setConfirmModal({
                                                show: true,
                                                biz,
                                                type: 'REJECT',
                                                customMessage: `¿Deseas bloquear el acceso para "${biz.name}"? Sus operaciones quedarán suspendidas.`
                                            });
                                        }
                                    }}
                                    className={`size-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${biz.is_active
                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-navy-dark border border-primary/20'
                                        }`}
                                    title={biz.is_active ? 'Bloquear' : 'Desbloquear'}
                                >
                                    <span className="material-symbols-outlined !text-xl">
                                        {biz.is_active ? 'block' : 'lock_open'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Admin Navigation Bar */}
            <NavigationAdmin />

            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-navy-dark/90 backdrop-blur-sm" onClick={() => setConfirmModal({ show: false, biz: null, type: null })}></div>
                    <div className="relative w-full max-w-sm bg-navy-card border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in fade-in duration-300">
                        <div className={`size-16 rounded-full mx-auto mb-6 flex items-center justify-center border ${confirmModal.type === 'APPROVE' ? 'bg-primary/10 border-primary text-primary' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                            <span className="material-symbols-outlined !text-4xl">
                                {confirmModal.type === 'APPROVE' ? 'verified_user' : 'report'}
                            </span>
                        </div>
                        <h3 className="text-xl font-black text-center text-white mb-2 uppercase tracking-tight">
                            {confirmModal.type === 'APPROVE' ? '¿Autorizar Acceso?' : '¿Rechazar Solicitud?'}
                        </h3>
                        <p className="text-sm text-center text-slate-400 font-bold mb-8 leading-relaxed">
                            {confirmModal.customMessage || (confirmModal.type === 'APPROVE'
                                ? `Estás a punto de activar a "${confirmModal.biz?.name}". Este comercio podrá comenzar a registrar ventas y emitir puntos.`
                                : `¿Confirmas que deseas rechazar la solicitud de "${confirmModal.biz?.name}"?`)}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    if (confirmModal.type === 'APPROVE') {
                                        updateStatus(confirmModal.biz.id, {
                                            registration_status: 'OK',
                                            is_active: true
                                        });
                                    } else {
                                        // For rejection, we set status REJECTED 
                                        // or if it's a block from the manage list, we just set is_active false
                                        updateStatus(confirmModal.biz.id, {
                                            registration_status: confirmModal.biz.registration_status === 'PENDING' ? 'REJECTED' : confirmModal.biz.registration_status,
                                            is_active: false
                                        });
                                    }
                                }}
                                className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 ${confirmModal.type === 'APPROVE' ? 'bg-primary text-navy-dark shadow-primary/20' : 'bg-red-500 text-white shadow-red-500/20'}`}
                            >
                                {confirmModal.type === 'APPROVE'
                                    ? (confirmModal.biz?.registration_status === 'PENDING' ? 'Sí, Autorizar Acceso' : 'Sí, Activar')
                                    : (confirmModal.biz?.registration_status === 'PENDING' ? 'Sí, Rechazar solicitud' : 'Sí, Bloquear Acceso')}
                            </button>
                            <button
                                onClick={() => setConfirmModal({ show: false, biz: null, type: null })}
                                className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformControl;
