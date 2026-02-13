import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';

const StaffManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState([]);
    const [business, setBusiness] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab] = useState('form'); // 'form' or 'list'
    const [editingStaff, setEditingStaff] = useState(null);
    const [resettingStaff, setResettingStaff] = useState(null);
    const [isResetting, setIsResetting] = useState(false);

    // New Staff State
    const [newStaff, setNewStaff] = useState({
        username: '',
        password: '',
        full_name: '',
        permissions: {
            can_earn: true,
            can_redeem: false,
            can_view_clients: true
        }
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get business
                const { data: bizData } = await supabase
                    .from('businesses')
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .single();

                setBusiness(bizData);

                if (bizData) {
                    // Get staff members
                    const { data: staffData } = await supabase
                        .from('business_members')
                        .select('*, profiles(full_name, email)')
                        .eq('business_id', bizData.id)
                        .neq('profile_id', user.id); // Exclude owner

                    setStaff(staffData || []);
                }
            } catch (err) {
                console.error('Error fetching staff:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user]);

    const fetchStaffList = async (bizId) => {
        const { data: staffData } = await supabase
            .from('business_members')
            .select('*, profiles(full_name, email)')
            .eq('business_id', bizId)
            .neq('profile_id', user.id);
        setStaff(staffData || []);
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        if (!business) return;
        setIsCreating(true);

        try {
            if (editingStaff) {
                // UPDATE MODE
                // 1. Update Profile (Full Name)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ full_name: newStaff.full_name })
                    .eq('id', editingStaff.profile_id);

                if (profileError) throw profileError;

                // 2. Update Business Member (Permissions)
                const { error: memberError } = await supabase
                    .from('business_members')
                    .update({ permissions: newStaff.permissions })
                    .eq('id', editingStaff.id);

                if (memberError) throw memberError;

                showNotification('success', 'Equipo Actualizado', `Los cambios para ${newStaff.full_name} se guardaron con éxito.`);
            } else {
                // CREATE MODE
                console.log('Iniciando registro seguro...');

                // Get admin domain
                const adminEmail = user.email;
                const domain = adminEmail.includes('@') ? adminEmail.split('@')[1] : 'kpoint.staff';

                const { data, error } = await supabase.functions.invoke('create-employee-v2', {
                    body: {
                        ...newStaff,
                        email_domain: domain,
                        business_id: business.id
                    }
                });

                if (error) {
                    console.error('Error en la respuesta:', error);
                    throw error;
                }

                showNotification('success', 'Empleado Creado', `El perfil de ${newStaff.full_name} se ha configurado con éxito.`);
            }

            await fetchStaffList(business.id);
            resetForm();
            setActiveTab('list');

        } catch (err) {
            console.error('Error in staff operation:', err);
            showNotification('error', 'Error', err.message || 'No se pudo procesar la solicitud.');
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setNewStaff({
            username: '',
            password: '',
            full_name: '',
            permissions: {
                can_earn: true,
                can_redeem: false,
                can_view_clients: true
            }
        });
        setEditingStaff(null);
        setShowPassword(false);
    };

    const startEditing = (member) => {
        setEditingStaff(member);
        setNewStaff({
            username: member.profiles?.email.split('@')[0] || '', // Username for display only in edit
            password: '', // Password stays empty unless we implement password reset
            full_name: member.profiles?.full_name || '',
            permissions: member.permissions || {
                can_earn: true,
                can_redeem: false,
                can_view_clients: true
            }
        });
        setActiveTab('form');
    };

    const handleDeleteStaff = async (memberId, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${name}? Esta acción revocará su acceso de inmediato.`)) return;

        try {
            // Note: This only removes from business_members, ideally we'd disable the auth user too
            const { error } = await supabase
                .from('business_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            showNotification('success', 'Equipo Actualizado', 'El miembro ha sido removido del equipo.');
            fetchStaffList(business.id);
        } catch (err) {
            showNotification('error', 'Error', 'No se pudo eliminar al miembro.');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!resettingStaff || !newStaff.password) return;
        setIsResetting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data, error } = await supabase.functions.invoke('reset-employee-password', {
                body: {
                    profile_id: resettingStaff.profile_id,
                    new_password: newStaff.password,
                    business_id: business.id
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                }
            });

            if (error) throw error;

            showNotification('success', 'Contraseña Actualizada', `Se ha cambiado la clave de ${resettingStaff.profiles?.full_name} con éxito.`);
            setResettingStaff(null);
            setNewStaff({ ...newStaff, password: '' });
        } catch (err) {
            console.error('Error resetting password:', err);
            showNotification('error', 'Error', err.message || 'No se pudo cambiar la contraseña.');
        } finally {
            setIsResetting(false);
        }
    };

    const togglePermission = (perm) => {
        setNewStaff({
            ...newStaff,
            permissions: {
                ...newStaff.permissions,
                [perm]: !newStaff.permissions[perm]
            }
        });
    };

    const handleUsernameChange = (val) => {
        // Filtrar el carácter @ y convertir a minúsculas
        const sanitized = val.replace(/@/g, '').toLowerCase();
        setNewStaff({ ...newStaff, username: sanitized });
    };

    const adminDomain = user?.email?.split('@')[1] || 'kpoint.staff';

    if (loading) return (
        <div className="min-h-screen bg-navy-dark flex items-center justify-center">
            <span className="animate-spin material-symbols-outlined text-primary text-4xl">sync</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-navy-dark text-white pb-24">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-navy-dark/90 backdrop-blur-xl z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/settings')}
                        className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent !text-3xl">badge</span>
                            Equipo K-Point
                        </h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Gestión de Personal</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mt-8 bg-white/5 p-1.5 rounded-[1.25rem] border border-white/5">
                    <button
                        onClick={() => setActiveTab('form')}
                        className={`flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'form' ? 'bg-primary text-navy-dark shadow-lg shadow-primary/20' : 'text-slate-400'}`}
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Nuevo Miembro
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-primary text-navy-dark shadow-lg shadow-primary/20' : 'text-slate-400'}`}
                    >
                        <span className="material-symbols-outlined text-lg">group</span>
                        Ver Equipo ({staff.length})
                    </button>
                </div>
            </header>

            <main className="px-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {activeTab === 'form' && (
                    <div className="bg-navy-card/40 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary !text-xl">
                                    {editingStaff ? 'edit_square' : 'person_add'}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {editingStaff ? 'Editar Miembro' : 'Agregar Nuevo Miembro'}
                                </span>
                            </div>
                            {editingStaff && (
                                <button
                                    onClick={resetForm}
                                    className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleCreateStaff} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={newStaff.full_name}
                                    onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                                    className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl px-6 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                                    placeholder="Ej. Andrea Palacios"
                                />
                            </div>

                            {!editingStaff && (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuario</label>
                                            <span className="text-[9px] font-bold text-primary/50 uppercase mr-1">Sin carácter "@"</span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                autoComplete="off"
                                                value={newStaff.username}
                                                onChange={(e) => handleUsernameChange(e.target.value)}
                                                className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl px-6 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                                                placeholder="Ej. apalacios"
                                            />
                                            {newStaff.username && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase">@{adminDomain}</p>
                                                </div>
                                            )}
                                        </div>
                                        {newStaff.username && (
                                            <p className="text-[9px] text-slate-500 ml-1 font-bold italic">
                                                Acceso: <span className="text-white">{newStaff.username}@{adminDomain}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                autoComplete="new-password"
                                                value={newStaff.password}
                                                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                                className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl px-6 pr-14 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-xl">
                                                    {showPassword ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {editingStaff && (
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-500">lock</span>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase">Usuario (Protegido)</p>
                                        <p className="text-xs font-bold text-slate-400">{editingStaff.profiles?.email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 text-center">Permisos de Acceso</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <PermissionToggle
                                        icon="payments"
                                        title="Cargar Ventas"
                                        description="Permite asignar puntos por compras."
                                        active={newStaff.permissions.can_earn}
                                        onToggle={() => togglePermission('can_earn')}
                                    />
                                    <PermissionToggle
                                        icon="redeem"
                                        title="Canjear Premios"
                                        description="Permite procesar canjes de regalos."
                                        active={newStaff.permissions.can_redeem}
                                        onToggle={() => togglePermission('can_redeem')}
                                    />
                                    <PermissionToggle
                                        icon="group"
                                        title="Ver Clientes"
                                        description="Permite ver la lista y actividad de clientes."
                                        active={newStaff.permissions.can_view_clients}
                                        onToggle={() => togglePermission('can_view_clients')}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full bg-primary text-navy-dark h-14 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
                            >
                                {isCreating ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">{editingStaff ? 'save' : 'add'}</span>}
                                {editingStaff ? 'GUARDAR CAMBIOS' : 'CREAR PERFIL DE EMPLEADO'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Staff List Section */}
                {activeTab === 'list' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {staff.length > 0 ? staff.map((member) => (
                            <div key={member.id} className="bg-navy-card/60 p-7 rounded-[2.5rem] border border-white/5 flex flex-col gap-6 relative overflow-hidden group shadow-[0_15px_35px_rgba(0,0,0,0.2)]">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />

                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="size-16 rounded-[1.5rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-inner">
                                            <span className="material-symbols-outlined !text-3xl font-bold">person</span>
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-white leading-none">{member.profiles?.full_name}</p>
                                            <p className="text-sm text-primary font-bold tracking-tight mt-1.5 opacity-90">{member.profiles?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em] mb-1">Rol</span>
                                        <span className="bg-white/5 px-3 py-1 rounded-lg text-[10px] text-slate-300 font-black uppercase">{member.role}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                                    <div className="flex flex-wrap gap-2 max-w-[60%]">
                                        {member.permissions?.can_earn && (
                                            <div className="bg-green-500/10 text-green-400 text-[9px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-xl border border-green-400/10 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined !text-[12px]">payments</span> VENTAS
                                            </div>
                                        )}
                                        {member.permissions?.can_redeem && (
                                            <div className="bg-primary/10 text-primary text-[9px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-xl border border-primary/10 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined !text-[12px]">redeem</span> CANJES
                                            </div>
                                        )}
                                        {member.permissions?.can_view_clients && (
                                            <div className="bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-xl border border-blue-400/10 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined !text-[12px]">group</span> CLIENTES
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setResettingStaff(member)}
                                            className="size-11 rounded-[1rem] bg-white/5 flex items-center justify-center text-slate-400 hover:text-accent hover:bg-accent/10 transition-all active:scale-95 border border-white/5"
                                            title="Cambiar Contraseña"
                                        >
                                            <span className="material-symbols-outlined text-xl">key</span>
                                        </button>
                                        <button
                                            onClick={() => startEditing(member)}
                                            className="size-11 rounded-[1rem] bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all active:scale-95 border border-white/5"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStaff(member.id, member.profiles?.full_name)}
                                            className="size-11 rounded-[1rem] bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-95 border border-white/5"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="bg-navy-card/20 rounded-[2rem] border border-dashed border-white/10 py-16 flex flex-col items-center justify-center gap-4 italic text-slate-500 text-sm">
                                <span className="material-symbols-outlined text-4xl opacity-20">group_off</span>
                                No hay empleados registrados
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Reset Password Modal */}
            {resettingStaff && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-navy-dark/80 backdrop-blur-sm" onClick={() => setResettingStaff(null)} />
                    <div className="relative bg-navy-card w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4 mb-8">
                            <div className="size-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent">
                                <span className="material-symbols-outlined !text-3xl font-bold">key_visualizer</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Nueva Contraseña</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">
                                    Cambiando clave para <span className="text-primary">{resettingStaff.profiles?.full_name}</span>
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Clave</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoFocus
                                        value={newStaff.password}
                                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                        className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl px-6 pr-14 text-white focus:ring-2 focus:ring-accent/20 outline-none transition-all font-bold"
                                        placeholder="Min. 6 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResettingStaff(null);
                                        setNewStaff({ ...newStaff, password: '' });
                                    }}
                                    className="flex-1 h-14 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-white/5 transition-colors border border-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isResetting || newStaff.password.length < 6}
                                    className="flex-[1.5] bg-accent text-navy-dark h-14 rounded-2xl font-black text-xs uppercase shadow-lg shadow-accent/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isResetting ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                                    GUARDAR CLAVE
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <Navigation />
        </div>
    );
};

const PermissionToggle = ({ icon, title, description, active, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${active ? 'bg-primary/5 border-primary/30 shadow-[0_0_15px_rgba(57,224,121,0.05)]' : 'bg-navy-dark border-white/5 opacity-60'}`}
    >
        <div className={`size-10 rounded-xl flex items-center justify-center ${active ? 'bg-primary text-navy-dark' : 'bg-white/5 text-slate-500'}`}>
            <span className="material-symbols-outlined !text-xl font-bold">{icon}</span>
        </div>
        <div className="flex-1">
            <p className={`text-xs font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-slate-400'}`}>{title}</p>
            <p className="text-[10px] text-slate-500 font-bold">{description}</p>
        </div>
        <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-primary bg-primary' : 'border-white/10'}`}>
            {active && <span className="material-symbols-outlined text-navy-dark !text-lg font-black">check</span>}
        </div>
    </button>
);

export default StaffManagement;
