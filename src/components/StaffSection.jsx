import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const StaffSection = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState([]);
    const [business, setBusiness] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeView, setActiveView] = useState('list'); // 'form' or 'list'
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
                const { data: bizData } = await supabase
                    .from('businesses')
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .single();

                setBusiness(bizData);

                if (bizData) {
                    await fetchStaffList(bizData.id);
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
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ full_name: newStaff.full_name })
                    .eq('id', editingStaff.profile_id);

                if (profileError) throw profileError;

                const { error: memberError } = await supabase
                    .from('business_members')
                    .update({ permissions: newStaff.permissions })
                    .eq('id', editingStaff.id);

                if (memberError) throw memberError;

                showNotification('success', 'Equipo Actualizado', `Los cambios para ${newStaff.full_name} se guardaron con éxito.`);
            } else {
                // CREATE MODE (viva Edge Function)
                const adminEmail = user.email;
                const domain = adminEmail.includes('@') ? adminEmail.split('@')[1] : 'kpoint.staff';

                const { error } = await supabase.functions.invoke('create-employee-v2', {
                    body: {
                        ...newStaff,
                        email_domain: domain,
                        business_id: business.id
                    }
                });

                if (error) throw error;

                showNotification('success', 'Empleado Creado', `El perfil de ${newStaff.full_name} se ha configurado con éxito.`);
            }

            await fetchStaffList(business.id);
            resetForm();
            setActiveView('list');

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
            username: member.profiles?.email.split('@')[0] || '',
            password: '',
            full_name: member.profiles?.full_name || '',
            permissions: member.permissions || {
                can_earn: true,
                can_redeem: false,
                can_view_clients: true
            }
        });
        setActiveView('form');
    };

    const handleDeleteStaff = async (memberId, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${name}? Esta acción revocará su acceso de inmediato.`)) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { error } = await supabase.functions.invoke('disable-employee', {
                body: {
                    profile_id: memberId,
                    business_id: business.id
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
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

            const { error } = await supabase.functions.invoke('reset-employee-password', {
                body: {
                    profile_id: resettingStaff.profile_id,
                    new_password: newStaff.password,
                    business_id: business.id
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
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
        const sanitized = val.replace(/@/g, '').toLowerCase();
        setNewStaff({ ...newStaff, username: sanitized });
    };

    const adminDomain = user?.email?.split('@')[1] || 'kpoint.staff';

    if (loading) return (
        <div className="py-20 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-primary animate-spin !text-4xl">sync</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Cargando Equipo...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                    <h2 className="text-xl font-black text-slate-900 uppercase">Gestión de Equipo</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Control de accesos y personal</p>
                </div>
                {activeView === 'list' ? (
                    <button 
                        onClick={() => {
                            setActiveView('form');
                            resetForm();
                        }}
                        className="h-10 px-5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
                    >
                        <span className="material-symbols-outlined !text-sm">person_add</span>
                        Nuevo Acceso
                    </button>
                ) : (
                    <button 
                        onClick={() => setActiveView('list')}
                        className="h-10 px-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined !text-sm">arrow_back</span>
                        Ver Lista
                    </button>
                )}
            </div>

            {activeView === 'form' ? (
                <div className="bg-white border-2 border-[#595A5B] rounded-[2.5rem] p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
                    <form onSubmit={handleCreateStaff} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                            <input
                                type="text"
                                required
                                value={newStaff.full_name}
                                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                                className="w-full h-14 bg-slate-50 border-2 border-[#595A5B]/30 rounded-2xl px-5 text-sm font-bold"
                                placeholder="Nombre del empleado..."
                            />
                        </div>

                        {!editingStaff && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identificador Usuario</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            value={newStaff.username}
                                            onChange={(e) => handleUsernameChange(e.target.value)}
                                            className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 pr-32 text-sm font-bold"
                                            placeholder="usuario_staff"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-200 px-3 py-1 rounded-lg text-[9px] font-black text-slate-500">
                                            @{adminDomain}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña Inicial</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={newStaff.password}
                                            onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                            className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 pr-12 text-sm font-bold"
                                            placeholder="••••••••"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                                        >
                                            <span className="material-symbols-outlined !text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-4 pt-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Permisos del Cargo</p>
                            <div className="grid grid-cols-1 gap-3">
                                <PermissionToggle 
                                    icon="receipt_long" 
                                    title="Ventas" 
                                    active={newStaff.permissions.can_earn} 
                                    onToggle={() => togglePermission('can_earn')} 
                                />
                                <PermissionToggle 
                                    icon="redeem" 
                                    title="Canjes" 
                                    active={newStaff.permissions.can_redeem} 
                                    onToggle={() => togglePermission('can_redeem')} 
                                />
                                <PermissionToggle 
                                    icon="group" 
                                    title="Ver Clientes" 
                                    active={newStaff.permissions.can_view_clients} 
                                    onToggle={() => togglePermission('can_view_clients')} 
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full h-16 bg-primary text-white rounded-[2rem] font-black uppercase shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all"
                        >
                            {isCreating ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'GUARDAR COLABORADOR'}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {staff.length > 0 ? staff.map((member) => (
                        <div key={member.id} className="bg-white border-2 border-[#595A5B] rounded-[2rem] p-5 flex flex-col gap-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined !text-2xl font-black">badge</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase text-sm">{member.profiles?.full_name}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold">{member.profiles?.email}</p>
                                    </div>
                                </div>
                                <span className="bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg">
                                    {member.role}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex gap-2">
                                    {member.permissions?.can_earn && (
                                        <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Ventas</span>
                                    )}
                                    {member.permissions?.can_redeem && (
                                        <span className="text-[8px] font-black text-primary bg-primary/5 px-2 py-1 rounded-full uppercase">Canjes</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setResettingStaff(member)} className="size-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 hover:text-primary transition-all">
                                        <span className="material-symbols-outlined !text-sm">lock_reset</span>
                                    </button>
                                    <button onClick={() => startEditing(member)} className="size-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 hover:text-primary transition-all">
                                        <span className="material-symbols-outlined !text-sm">edit</span>
                                    </button>
                                    <button onClick={() => handleDeleteStaff(member.profile_id, member.profiles?.full_name)} className="size-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all">
                                        <span className="material-symbols-outlined !text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 flex flex-col items-center justify-center gap-4">
                            <span className="material-symbols-outlined text-slate-200 !text-6xl text-slate-200">group_off</span>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay personal configurado</p>
                        </div>
                    )}
                </div>
            )}

            {/* Reset Password Modal (Simplified for tab rendering) */}
            {resettingStaff && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-6">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 border-2 border-[#595A5B] shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-slate-900 uppercase">Reiniciar Clave</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Para {resettingStaff.profiles?.full_name}</p>
                        </div>
                        <div className="space-y-4">
                            <input 
                                type="password"
                                value={newStaff.password}
                                onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                                placeholder="Nueva contraseña"
                                className="w-full h-14 bg-slate-50 border-2 border-[#595A5B]/30 rounded-2xl px-5 text-sm font-bold"
                            />
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setResettingStaff(null)}
                                    className="flex-1 h-14 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleResetPassword}
                                    disabled={isResetting || newStaff.password.length < 6}
                                    className="flex-1 h-14 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-primary/20"
                                >
                                    {isResetting ? '...' : 'Actualizar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PermissionToggle = ({ icon, title, active, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${active ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 border-slate-100 opacity-60'}`}
    >
        <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined !text-xl ${active ? 'text-primary' : 'text-slate-400'}`}>{icon}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-slate-500'}`}>{title}</span>
        </div>
        <div className={`size-5 rounded-full border-2 flex items-center justify-center ${active ? 'bg-primary border-primary' : 'bg-white border-slate-200'}`}>
            {active && <span className="material-symbols-outlined text-white !text-xs font-black">check</span>}
        </div>
    </button>
);

export default StaffSection;
