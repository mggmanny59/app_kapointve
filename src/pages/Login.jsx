import React, { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';

const Login = () => {
    const [activeTab, setActiveTab] = useState('client');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signIn, signOut, user } = useAuth(); // Added signOut
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // Aggressively clearing fields on startup to prevent browser autofill
    useEffect(() => {
        const timer = setTimeout(() => {
            setEmail('');
            setPassword('');
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await signIn(email, password);
            const authUser = result.user;

            if (!authUser) throw new Error('No se pudo establecer la sesión.');

            // ROLE VALIDATION
            if (activeTab === 'admin') {
                // Check if user is a member of any business in the database
                const { data: businessMember, error: dbError } = await supabase
                    .from('business_members')
                    .select('id, business_id')
                    .eq('profile_id', authUser.id)
                    .maybeSingle();

                if (dbError || !businessMember) {
                    await signOut();
                    throw new Error('Lo sentimos, esta cuenta no está registrada como Dueño de negocio.');
                }

                // Check profile for Super Admin status
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('is_super_admin')
                    .eq('id', authUser.id)
                    .single();

                const isSuperAdmin = profileData?.is_super_admin === true;

                // Check Business Status
                const { data: businessStatus } = await supabase
                    .from('businesses')
                    .select('is_active, registration_status, subscription_expiry')
                    .eq('id', businessMember.business_id)
                    .single();

                if (businessStatus && !isSuperAdmin) {
                    const isExpired = businessStatus.subscription_expiry && new Date(businessStatus.subscription_expiry) < new Date();

                    // Rule 1: Fixed Blocked Account
                    if (businessStatus.is_active === false) {
                        await signOut();
                        throw new Error('Estimado usuario. Su cuenta bloqueada. Comuniquese con el departamento de soporte técnico para su activacion.');
                    }

                    // Rule Expiry: We NO LONGER throw an error here. 
                    // We allow the login and the App.jsx will redirect them to /subscription.
                    // However, we can track it if we want to show a message later.

                    // Rule 3: Pending Review (Current message maintained)
                    if (businessStatus.registration_status === 'PENDING') {
                        await signOut();
                        throw new Error('Tu cuenta de negocio está en revisión. Un administrador debe aprobar tu registro.');
                    }

                    // Rule 2: Authorized Access (Only 'OK' is permitted)
                    if (businessStatus.registration_status !== 'OK') {
                        await signOut();
                        throw new Error('Su cuenta aún no cuenta con la autorización de acceso necesaria para el uso de la aplicación.');
                    }
                }
                // If validation passes, navigate manually
                navigate(isSuperAdmin ? '/platform-admin' : '/dashboard');
            } else {
                // CLIENT VALIDATION: Strict separation
                const userRole = authUser.user_metadata?.role;

                // 1. Check Metadata first (fast)
                if (userRole === 'admin' || userRole === 'cashier') {
                    await signOut();
                    throw new Error('Esta cuenta pertenece al equipo de un NEGOCIO. Por favor, utiliza la pestaña "Dueño" para ingresar.');
                }

                // 2. Double check Database (secure)
                const { data: isTeamMember } = await supabase
                    .from('business_members')
                    .select('id')
                    .eq('profile_id', authUser.id)
                    .maybeSingle();

                if (isTeamMember) {
                    await signOut();
                    throw new Error('Acceso Denegado: Tu perfil está registrado como Miembro de Equipo. Por favor, ingresa por la sección de "Dueño".');
                }

                // AUTO-REPAIR REMOVED: Clients now join via QR code manually.
                // We no longer force a loyalty card creation on login.

                // If validation passes, navigate manually
                navigate('/my-points');
            }
        } catch (err) {
            // Friendly error message for users
            let message = err.message;
            if (message === 'Invalid login credentials') message = '¡Ups! Correo o contraseña incorrectos.';
            showNotification('error', 'Error de Acceso', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col bg-white text-slate-900 font-display overflow-y-auto relative">
            {/* Fondo con imagen original y degradado ampliado hacia blanco puro */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src="/BannerLogin.png"
                    alt="Background"
                    className="w-full h-[65vh] object-cover object-top opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent via-[45%] to-white to-[85%]"></div>
            </div>

            <div className="relative z-10 flex flex-col flex-1 px-6 pt-[8vh] pb-8 justify-between">
                <div>
                    {/* Logo / Brand Header */}
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

                    {/* Login Card (Stitch Inspired) */}
                    <div className="max-w-[440px] w-full mx-auto bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl shadow-slate-200/50 p-6 border border-white">
                        <div className="text-center mb-5">
                            <h2 className="text-lg font-bold text-slate-900 leading-tight">¡Bienvenido de nuevo!</h2>
                            <p className="text-xs text-slate-500 font-medium">Ingresa para acceder a tus beneficios</p>
                        </div>

                        {/* Role Tabs */}
                        <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-[#595A5B] mb-5 text-xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('client')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'client'
                                    ? 'bg-[#ff6a00] text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base">shopping_bag</span>
                                Cliente
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('admin')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'admin'
                                    ? 'bg-[#ff6a00] text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base">storefront</span>
                                Dueño
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="off">
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Correo Electrónico</label>
                                <div className="relative group text-sm">
                                    <input
                                        type="email"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] h-12 px-4 pl-11 transition-all"
                                        placeholder="ejemplo@correo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors text-xl">mail</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest opacity-70">Contraseña</label>
                                    <Link className="text-[#ff6a00] text-[10px] font-black hover:underline" to="/forgot-password">¿Olvidaste tu clave?</Link>
                                </div>
                                <div className="relative group text-sm">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] h-12 px-4 pl-11 pr-11 transition-all"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors text-xl">lock</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-3 text-slate-300 hover:text-[#ff6a00] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#ff6a00] hover:bg-[#ff8c3a] text-white font-black h-13 rounded-2xl shadow-xl shadow-[#ff6a00]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98] mt-3"
                            >
                                {loading ? (
                                    <span className="animate-spin material-symbols-outlined">refresh</span>
                                ) : (
                                    <>
                                        <span className="text-sm">{activeTab === 'client' ? 'Ver mis Puntos' : 'Entrar al Panel'}</span>
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center pt-2 border-t border-[#595A5B]">
                            <p className="text-slate-500 text-[11px] font-medium">
                                ¿Aún no tienes cuenta?
                                <Link className="text-[#ff6a00] font-bold hover:underline ml-1" to="/register">Regístrate</Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Credits */}
                <div className="max-w-[440px] w-full mx-auto mt-auto text-center flex flex-col gap-4">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-60">
                        Desarrollado por CloudNets 2026 - Venezuela
                    </p>
                    
                    {/* Banner Naranja */}
                    <div className="bg-[#ff6a00] h-3 w-full rounded-full shadow-lg shadow-[#ff6a00]/30"></div>
                </div>
            </div>
        </div>
    );
};

export default Login;
