import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // The recovery link automatically authenticates the user.
    // We just need to check if they are actually authenticated.
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showNotification('error', 'Enlace expirado', 'El enlace de recuperación ha expirado o no es válido.');
                navigate('/login');
            }
        };
        checkSession();
    }, [navigate, showNotification]);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showNotification('error', 'Error', 'Las contraseñas no coinciden.');
            return;
        }

        if (password.length < 6) {
            showNotification('error', 'Error', 'La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            showNotification('success', 'Éxito', 'Tu contraseña ha sido actualizada correctamente.');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            showNotification('error', 'Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col bg-white text-slate-900 font-display overflow-hidden relative">
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src="/BannerLogin.png"
                    alt="Background"
                    className="w-full h-[65vh] object-cover object-top opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent via-[45%] to-white to-[85%]"></div>
            </div>

            <div className="relative z-10 flex flex-col flex-1 px-6 pt-[22vh] pb-8 justify-between">
                <div>
                    <div className="flex flex-col items-center mb-6">
                        <div className="bg-white p-3.5 rounded-[24px] shadow-xl mb-3 border border-white/50 flex flex-col items-center gap-1">
                            <img
                                src="/Logo KPoint Solo K (sin Fondo).png"
                                alt="Logo KPoint"
                                className="w-8 h-8 object-contain"
                            />
                            <h1 className="text-xl font-black tracking-tighter">
                                <span className="text-[rgb(0,152,235)]">K</span>
                                <span className="text-[#ff6a00]">P</span>
                                <span className="text-black">oint</span>
                            </h1>
                        </div>
                    </div>

                    <div className="max-w-[440px] w-full mx-auto bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl shadow-slate-200/50 p-8 border border-white">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-black text-slate-900 leading-tight">Establecer nueva contraseña</h2>
                            <p className="text-xs text-slate-500 font-medium mt-2">Crea una contraseña segura para tu cuenta.</p>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-4 shadow-sm" autoComplete="off">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Nueva Contraseña</label>
                                <div className="relative group text-sm">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full rounded-2xl border-2 border-[#595A5B] bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] h-14 px-4 pl-12 pr-12 transition-all"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <Icon name="lock" className="absolute left-4 top-4 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors !w-5 !h-5" />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-4 text-slate-300 hover:text-[#ff6a00] transition-colors"
                                    >
                                        <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="!w-5 !h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Confirmar Contraseña</label>
                                <div className="relative group text-sm">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full rounded-2xl border-2 border-[#595A5B] bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] h-14 px-4 pl-12 transition-all"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                    <Icon name="verified_user" className="absolute left-4 top-4 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors !w-5 !h-5" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#ff6a00] hover:bg-[#ff8c3a] text-white font-black h-14 rounded-2xl shadow-xl shadow-[#ff6a00]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98] mt-4"
                            >
                                {loading ? (
                                    <Icon name="refresh" className="animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-sm">Actualizar contraseña</span>
                                        <Icon name="check_circle" className="!w-5 !h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="max-w-[440px] w-full mx-auto mt-auto pb-2 text-center">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-60">
                        Desarrollado por CloudNets 2026 - Venezuela
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
