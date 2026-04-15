import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';

const StaffManagement = () => {
    const { user, signOut } = useAuth();
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
            const { data: { session } } = await supabase.auth.getSession();

            // ✅ SECURITY FIX A-05: Invoke edge function to completely revoke auth access and cascade delete
            const { data, error } = await supabase.functions.invoke('disable-employee', {
                body: {
                    profile_id: memberId,
                    business_id: business.id
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                }
            });

            if (error) throw error;

            showNotification('success', 'Equipo Actualizado', 'El acceso del miembro ha sido revocado completamente.');
            fetchStaffList(business.id);
        } catch (err) {
            console.error("Error deleting staff:", err);
            showNotification('error', 'Error', err.message || 'No se pudo eliminar al miembro.');
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
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#595A5B] border-t-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-32 antialiased">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-[#f8fafc]/80 backdrop-blur-xl z-50 border-b border-[#595A5B]">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Icon name="badge" className="text-primary !w-8 !h-8" />
                            Gestión de Equipo
                        </h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Control de accesos y personal</p>
                    </div>

                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 bg-[#f8fafc] p-1.5 rounded-[1.5rem] border-2 border-[#595A5B] shadow-inner">
                    <button
                        onClick={() => setActiveTab('form')}
                        className={`flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'form' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Icon name="person_add" className="!w-[18] !h-[18]" />
                        Configurar Acceso
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Icon name="group" className="!w-[18] !h-[18]" />
                        Ver Equipo ({staff.length})
                    </button>
                </div>
            </header>

            <main className="px-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {activeTab === 'form' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
                            <div className="flex items-center gap-3">
                                <Icon name={editingStaff ? 'edit_square' : 'person_add'} className="text-primary !w-5 !h-5" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    {editingStaff ? 'Editar Miembro' : 'Nueva Credencial'}
                                </span>
                            </div>
                            {editingStaff && (
                                <button
                                    onClick={resetForm}
                                    className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                                >
                                    Descartar
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleCreateStaff} className="space-y-6">
                            <div className="space-y-0.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={newStaff.full_name}
                                    onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                    placeholder="Nombre del empleado..."
                                />
                            </div>

                            {!editingStaff && (
                                <>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identificador Usuario</label>
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                required
                                                autoComplete="off"
                                                value={newStaff.username}
                                                onChange={(e) => handleUsernameChange(e.target.value)}
                                                className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                                placeholder="usuario_staff"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <div className="h-8 px-3 rounded-lg bg-slate-50 border-2 border-[#595A5B] flex items-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">@{adminDomain}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {newStaff.username && (
                                            <p className="text-[10px] text-primary/70 ml-1 font-bold italic">
                                                Acceso total: <span className="text-slate-900 font-black">{newStaff.username}@{adminDomain}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Contraseña de Seguridad</label>
                                        <div className="relative group">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                autoComplete="new-password"
                                                value={newStaff.password}
                                                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                                className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 pr-14 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                                            >
                                                <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {editingStaff && (
                                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-[#595A5B] flex items-center gap-4 shadow-inner">
                                    <div className="size-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border-2 border-[#595A5B]">
                                        <Icon name="lock" className="!w-5 !h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acceso Vincunlado</p>
                                        <p className="text-xs font-black text-slate-700">{editingStaff.profiles?.email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6 pt-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-4 text-center">Niveles de Permiso</label>
                                <div className="grid grid-cols-1 gap-4">
                                    <PermissionToggle
                                        icon="receipt_long"
                                        title="Gestión de Ventas"
                                        description="Carga de transacciones y asignación de puntos."
                                        active={newStaff.permissions.can_earn}
                                        onToggle={() => togglePermission('can_earn')}
                                    />
                                    <PermissionToggle
                                        icon="redeem"
                                        title="Validación Premium"
                                        description="Canje de beneficios y entrega de regalos."
                                        active={newStaff.permissions.can_redeem}
                                        onToggle={() => togglePermission('can_redeem')}
                                    />
                                    <PermissionToggle
                                        icon="diversity_3"
                                        title="Visibilidad CRM"
                                        description="Reportes y listado detallado de clientes."
                                        active={newStaff.permissions.can_view_clients}
                                        onToggle={() => togglePermission('can_view_clients')}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full bg-primary text-white h-16 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary/20 active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6"
                            >
                                {isCreating ? <Icon name="sync" className="animate-spin" /> : <Icon name={editingStaff ? 'save_as' : 'how_to_reg'} />}
                                {editingStaff ? 'GUARDAR ACTUALIZACIÓN' : 'CONFIGURAR NUEVO ACCESO'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Staff List Section */}
                {activeTab === 'list' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {staff.length > 0 ? staff.map((member) => (
                            <div key={member.id} className="bg-white p-7 rounded-[2.5rem] border-2 border-[#595A5B] flex flex-col gap-6 relative overflow-hidden group shadow-xl shadow-slate-200/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-slate-200/60 transition-all">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />

                                <div className="flex items-center justify-between gap-4 relative z-10">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="size-14 rounded-2xl bg-slate-50 flex-shrink-0 flex items-center justify-center text-primary shadow-inner border-2 border-[#595A5B] group-hover:scale-110 transition-transform">
                                            <Icon name="badge" className="!w-6 !h-6" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0">
                                            <p className="text-base font-black text-slate-900 leading-tight tracking-tight truncate">{member.profiles?.full_name}</p>
                                            <p className="text-xs text-slate-400 font-bold tracking-tight opacity-90 truncate">{member.profiles?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em]">Puesto</span>
                                        <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ring-4 ring-slate-50">{member.role}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-[#595A5B] relative z-10">
                                    <div className="flex flex-wrap gap-2 max-w-[65%]">
                                        {member.permissions?.can_earn && (
                                            <div className="bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-green-100 flex items-center gap-2">
                                                <div className="size-1 rounded-full bg-green-500"></div> VENTAS
                                            </div>
                                        )}
                                        {member.permissions?.can_redeem && (
                                            <div className="bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-primary/10 flex items-center gap-2">
                                                <div className="size-1 rounded-full bg-primary"></div> CANJES
                                            </div>
                                        )}
                                        {member.permissions?.can_view_clients && (
                                            <div className="bg-slate-50 text-slate-500 text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border-2 border-[#595A5B] flex items-center gap-2">
                                                <div className="size-1 rounded-full bg-slate-400"></div> CRM
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setResettingStaff(member)}
                                            className="size-11 rounded-2xl bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-warning hover:border-warning/20 hover:bg-warning/5 transition-all active:scale-90 shadow-sm"
                                            title="Cambiar Contraseña"
                                        >
                                            <Icon name="lock_reset" className="!w-5 !h-5" />
                                        </button>
                                        <button
                                            onClick={() => startEditing(member)}
                                            className="size-11 rounded-2xl bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all active:scale-90 shadow-sm"
                                        >
                                            <Icon name="edit_square" className="!w-5 !h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStaff(member.id, member.profiles?.full_name)}
                                            className="size-11 rounded-2xl bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all active:scale-90 shadow-sm"
                                        >
                                            <Icon name="delete_sweep" className="!w-5 !h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="bg-white rounded-[3rem] border border-dashed border-[#595A5B] py-20 flex flex-col items-center justify-center gap-4 mx-4 shadow-inner">
                                <div className="size-16 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200 border-2 border-[#595A5B] mb-2">
                                    <Icon name="group_off" className="!w-12 !h-12" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Sin colaboradores</h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-[9px]">Aún no has configurado delegados</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Reset Password Modal */}
            {resettingStaff && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-10 border-2 border-[#595A5B] shadow-2xl animate-in zoom-in-95 duration-400">
                        <div className="flex flex-col items-center text-center gap-6 mb-10">
                            <div className="size-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-warning shadow-inner border-2 border-[#595A5B]">
                                <Icon name="lock_open" className="!w-10 !h-10" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reiniciar Clave</h3>
                                <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed px-4">
                                    Generando nueva contraseña para <span className="text-primary font-black">{resettingStaff.profiles?.full_name}</span>
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nueva Clave de Staff</label>
                                <div className="relative group">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoFocus
                                        value={newStaff.password}
                                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                        className="w-full bg-[#f8fafc] border-2 border-[#595A5B] h-16 rounded-2xl px-6 pr-14 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/40 focus:bg-white outline-none transition-all font-black placeholder:text-slate-200 shadow-inner"
                                        placeholder="Min. 6 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                                    >
                                        <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={isResetting || newStaff.password.length < 6}
                                    className="w-full bg-slate-900 text-white h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-slate-200 active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isResetting ? <Icon name="sync" className="animate-spin" /> : <Icon name="key" />}
                                    ACTUALIZAR CLAVE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResettingStaff(null);
                                        setNewStaff({ ...newStaff, password: '' });
                                    }}
                                    className="w-full h-12 rounded-full text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-all active:scale-95"
                                >
                                    VOLVER ATRÁS
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
        className={`flex items-center gap-5 p-5 rounded-2xl border transition-all text-left group/toggle ${active ? 'bg-primary/5 border-primary/20 shadow-sm ring-4 ring-primary/5' : 'bg-slate-50 border-[#595A5B] opacity-60 hover:opacity-100'}`}
    >
        <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-400 border-2 border-[#595A5B]'}`}>
            <Icon name={icon} className="!w-6 !h-6" />
        </div>
        <div className="flex-1 space-y-0.5">
            <p className={`text-[12px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-slate-500'}`}>{title}</p>
            <p className="text-[10px] text-slate-400 font-bold leading-tight">{description}</p>
        </div>
        <div className={`size-7 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-primary bg-primary' : 'border-[#595A5B] bg-white group-hover/toggle:border-[#595A5B]'}`}>
            {active && <Icon name="check" className="text-white !w-5 !h-5" />}
        </div>
    </button>
);

export default StaffManagement;
