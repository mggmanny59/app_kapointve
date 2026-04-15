import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';
import SupportSection from '../components/SupportSection';

const Profile = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [userRole, setUserRole] = useState('client');
    const [profile, setProfile] = useState({
        full_name: '',
        phone: '',
        email: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, phone')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                setProfile({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    email: user.email || ''
                });
            } catch (err) {
                console.error('Error fetching profile:', err);
                showNotification('error', 'Error', 'No se pudo cargar el perfil.');
            } finally {
                setLoading(false);
            }
        };

        const fetchRole = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('business_members')
                .select('role')
                .eq('profile_id', user.id)
                .maybeSingle();
            
            if (data?.role) setUserRole(data.role);
        };

        fetchProfile();
        fetchRole();
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    phone: profile.phone
                })
                .eq('id', user.id);

            if (error) throw error;
            showNotification('success', '¡Perfil Actualizado!', 'Tus datos se han guardado correctamente.');
        } catch (err) {
            console.error('Error updating profile:', err);
            showNotification('error', 'Error', 'No se pudieron guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            // Obtener la sesión actual para el token
            const { data: { session } } = await supabase.auth.getSession();
            
            // Llamar a la función de borde con el token explícito
            const { error } = await supabase.functions.invoke('delete-user-account', {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            if (error) throw error;

            showNotification('success', 'Cuenta Eliminada', 'Tu cuenta y todos tus datos han sido borrados permanentemente.');
            
            // Cerrar sesión y redirigir
            await supabase.auth.signOut();
            window.location.href = '/login';
        } catch (err) {
            console.error('Error deleting account:', err);
            showNotification('error', 'Error', 'No se pudo eliminar la cuenta. Contacte a soporte.');
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
                <Icon name="refresh" className="animate-spin text-primary !w-10 !h-10" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#F0F2F5] font-display text-slate-900 antialiased">
            <header className="pt-8 pb-4 px-6 sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden border-2 border-[#595A5B] shadow-sm">
                        <img src="/Logo KPoint Solo K (sin Fondo).png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight uppercase">Mi Perfil</h1>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ajustes de Cuenta</p>
                    </div>
                </div>
            </header>

            <main className="px-6 py-6 space-y-8 animate-in fade-in slide-in-from-bottom duration-500">
                {/* Profile Card Header */}
                <div className="relative bg-gradient-to-br from-[rgb(255,101,14)] to-[#e65a0c] p-8 rounded-[2.5rem] shadow-xl text-white overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="size-24 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center mb-4 shadow-lg">
                            <Icon name="person" className="!w-12 !h-12 text-white" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">{profile.full_name || 'Sin Nombre'}</h2>
                        <p className="text-white/70 text-sm font-medium uppercase tracking-widest mt-1">{profile.email}</p>
                    </div>
                    {/* Decorative abstract shape */}
                    <div className="absolute -top-10 -right-10 size-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                {/* Subscription Section for Owners */}
                {userRole === 'owner' && (
                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom duration-700 delay-150">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Icon name="payments" className="!w-8 !h-8" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Estado del Plan</p>
                                <p className="text-sm text-slate-800 font-black">Tu Suscripción KPoint</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.href = '/subscription'}
                            className="h-12 px-6 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            Ver Plan
                        </button>
                    </div>
                )}

                {/* Edit Form */}
                <form onSubmit={handleSave} className="bg-white p-8 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                            <div className="relative">
                                <Icon name="person" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 !w-5 !h-5" />
                                <input
                                    type="text"
                                    value={profile.full_name}
                                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                    placeholder="Tu nombre completo"
                                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-primary focus:bg-white transition-all outline-none text-sm shadow-inner"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                            <div className="relative">
                                <Icon name="call" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 !w-5 !h-5" />
                                <input
                                    type="tel"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    placeholder="+58 412 0000000"
                                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-primary focus:bg-white transition-all outline-none text-sm shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 opacity-60">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico (No editable)</label>
                            <div className="relative">
                                <Icon name="mail" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 !w-5 !h-5" />
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="w-full h-14 pl-12 pr-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-500 font-bold cursor-not-allowed text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full h-16 bg-primary text-white rounded-3xl font-black uppercase shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {saving ? (
                            <Icon name="sync" className="animate-spin !w-5 !h-5" />
                        ) : (
                            <>
                                GUARDAR CAMBIOS
                                <Icon name="save" className="!w-5 !h-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Support Section */}
                <SupportSection userType={userRole === 'client' ? 'client' : 'owner'} />

                {/* Account Info Footer */}
                <div className="p-6 bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-300 flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                        <Icon name="verified_user" className="!w-8 !h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Seguridad</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight">Tus datos están protegidos y solo se usan para el sistema de fidelidad.</p>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-rose-50 p-8 rounded-[2.5rem] border-2 border-rose-200 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-sm font-black text-rose-600 uppercase tracking-tighter">Zona de Peligro</h3>
                        <p className="text-[11px] text-rose-400 font-medium leading-tight mt-1">
                            Acciones irreversibles sobre tu cuenta de KPoint.
                        </p>
                    </div>
                    
                    <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full h-14 bg-white text-rose-500 border-2 border-rose-200 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                    >
                        <Icon name="delete_forever" className="!w-5 !h-5" />
                        ELIMINAR MI CUENTA
                    </button>
                </div>
            </main>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 border-4 border-rose-500/20 shadow-2xl relative overflow-hidden">
                        {/* Warning Icon */}
                        <div className="size-20 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-2">
                            <Icon name="warning" className="!w-10 !h-10" />
                        </div>

                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">¿Estás absolutamente seguro?</h3>
                            <div className="mt-4 space-y-3 text-left">
                                <div className="flex gap-3">
                                    <Icon name="cancel" className="text-rose-500 !w-5 !h-5" />
                                    <p className="text-[11px] font-bold text-slate-600 leading-tight">Esta operación <span className="text-rose-600 underline">no puede ser revertida</span>.</p>
                                </div>
                                <div className="flex gap-3">
                                    <Icon name="database_off" className="text-rose-500 !w-5 !h-5" />
                                    <p className="text-[11px] font-bold text-slate-600 leading-tight">Se borrarán todos los datos asociados, incluyendo <span className="text-rose-600">Puntos y Premios</span>.</p>
                                </div>
                                <div className="flex gap-3">
                                    <Icon name="link_off" className="text-rose-500 !w-5 !h-5" />
                                    <p className="text-[11px] font-bold text-slate-600 leading-tight">Se desvinculará toda relación con Comercios y <span className="font-black text-primary">KPOINT</span>.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col w-full gap-3 mt-4">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full h-14 bg-rose-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-rose-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <Icon name="sync" className="animate-spin" />
                                ) : (
                                    'SÍ, ELIMINAR CUENTA DEFINITIVAMENTE'
                                )}
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="w-full h-14 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
                            >
                                CANCELAR
                            </button>
                        </div>

                        {/* Background warning pattern */}
                        <div className="absolute -bottom-10 -right-10 size-32 bg-rose-50 rounded-full -z-10 blur-2xl"></div>
                    </div>
                </div>
            )}

            <Navigation />
        </div>
    );
};

export default Profile;
