import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';

const Register = () => {
    const [activeTab, setActiveTab] = useState('client');
    const [formData, setFormData] = useState({
        name: '',
        phonePrefix: '0412',
        phoneSuffix: '',
        email: '',
        password: '',
        birthDate: '', // New field for both roles
        shopCode: '', // businessName for owners
        rif: '' // New field for owners
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // Aggressively clearing fields on startup to prevent browser autofill
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setFormData({
                name: '',
                phonePrefix: '0412',
                phoneSuffix: '',
                email: '',
                password: '',
                birthDate: '',
                shopCode: '',
                rif: ''
            });
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        // Validate Phone Suffix (7 digits)
        if (formData.phoneSuffix.length !== 7 || !/^\d+$/.test(formData.phoneSuffix)) {
            showNotification('error', 'Teléfono Inválido', 'El número de teléfono debe tener exactamente 7 dígitos.');
            return;
        }

        setLoading(true);

        const fullPhone = `${formData.phonePrefix}${formData.phoneSuffix}`;

        try {
            const metadata = {
                full_name: formData.name,
                role: activeTab,
            };

            const data = await signUp(formData.email, formData.password, metadata);

            if (data?.user?.identities?.length === 0) {
                showNotification('error', 'Cuenta Existente', 'Este correo electrónico ya está registrado. Intenta iniciar sesión.');
                setLoading(false);
                return;
            }

            const userId = data.user.id;

            // Check if this is the Platform Owner email
            const isPlatformOwner = formData.email.toLowerCase().trim() === 'mgeducation.ia2@gmail.com';

            // 1. Update profile with phone number and optional super_admin flag
            await supabase
                .from('profiles')
                .update({
                    phone: fullPhone,
                    full_name: formData.name,
                    email: formData.email,
                    birth_date: formData.birthDate || null,
                    is_super_admin: isPlatformOwner // Auto-elevate the owner
                })
                .eq('id', userId);

            // 2. Business Logic based on Role
            if (activeTab === 'admin') {
                // Owner Registration - Create Business
                if (!formData.shopCode || !formData.rif) {
                    throw new Error('El nombre del negocio y el RIF son obligatorios.');
                }

                // Calculate initial subscription expiry (30 days from now)
                const initialExpiry = new Date();
                initialExpiry.setDate(initialExpiry.getDate() + 30);

                // Create the Business Entry
                const { data: newBiz, error: bizError } = await supabase
                    .from('businesses')
                    .insert({
                        name: formData.shopCode,
                        rif: formData.rif,
                        owner_id: userId,
                        is_active: true,
                        registration_status: isPlatformOwner ? 'OK' : 'PENDING', // Auto-approve the owner
                        subscription_plan: 'BASIC', // Consistent with user request
                        subscription_expiry: initialExpiry.toISOString()
                    })
                    .select()
                    .single();

                if (bizError) throw bizError;

                // Insert into business_members
                await supabase
                    .from('business_members')
                    .insert({
                        business_id: newBiz.id,
                        profile_id: userId,
                        role: 'owner'
                    });

                if (isPlatformOwner) {
                    showNotification('success', '¡Acceso Maestro Activado!', 'Has sido registrado como el Administrador Global de la plataforma.');
                } else {
                    showNotification('success', '¡Registro Recibido!', 'Tu solicitud de registro ha sido enviada. Un administrador verificará tus datos y activará tu cuenta pronto.');
                }

            } else {
                // Client Registration - Decoupled Flow
                // No automatic business affiliation. 
                // Enhanced profile is already created.

                showNotification('success', '¡Cuenta Creada!', 'Tu cuenta ha sido creada exitosamente. Escanea el código QR de un comercio para unirte a su programa de fidelidad.');
            }

            navigate('/login');
        } catch (err) {
            let friendlyMessage = err.message;
            if (err.message.includes('User already registered')) {
                friendlyMessage = 'Este correo electrónico ya está registrado.';
            } else if (err.message.includes('Password should be')) {
                friendlyMessage = 'La contraseña debe tener al menos 6 caracteres.';
            }
            showNotification('error', 'Error en Registro', friendlyMessage);
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

            <div className="relative z-10 flex flex-col flex-1 px-6 pt-[6vh] pb-6 justify-between overflow-hidden">
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Logo / Brand Header */}
                    <div className="flex flex-col items-center mb-4 shrink-0">
                        <div className="bg-white p-3 rounded-[24px] shadow-xl border border-white/50 flex flex-col items-center gap-1">
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

                    {/* Register Card (Stitch Inspired) */}
                    <div className="max-w-[440px] w-full mx-auto bg-white/95 backdrop-blur-sm rounded-[40px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45)] p-10 border border-white flex flex-col overflow-hidden">
                        <div className="text-center mb-6 shrink-0">
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">¡Únete ahora!</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Crea tu cuenta en segundos</p>
                        </div>

                        {/* Role Tabs */}
                        <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-[#595A5B] mb-4 text-xs shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab('client')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'client'
                                    ? 'bg-[#ff6a00] text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base">person</span>
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

                        {/* Formulario con scroll si es necesario */}
                        <form onSubmit={handleRegister} className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar" autoComplete="off">
                            {/* Nombre Completo */}
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">
                                    {activeTab === 'admin' ? 'Nombre del Representante' : 'Nombre Completo'}
                                </label>
                                <div className="relative group text-sm">
                                    <input
                                        name="name"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00] h-11 px-4 pl-11 transition-all"
                                        placeholder="Ej. Juan Pérez"
                                        type="text"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors text-xl">person</span>
                                </div>
                            </div>

                            {/* Teléfono */}
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Número de Teléfono</label>
                                <div className="flex gap-2">
                                    <div className="relative w-1/3 text-sm">
                                        <select
                                            name="phonePrefix"
                                            value={formData.phonePrefix}
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 cursor-pointer appearance-none focus:outline-none focus:border-[#ff6a00] transition-all"
                                        >
                                            <option value="0412">0412</option>
                                            <option value="0416">0416</option>
                                            <option value="0414">0414</option>
                                            <option value="0424">0424</option>
                                            <option value="0426">0426</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-xl">expand_more</span>
                                    </div>
                                    <div className="relative flex-1 text-sm">
                                        <input
                                            name="phoneSuffix"
                                            className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                            placeholder="1234567"
                                            type="tel"
                                            maxLength="7"
                                            value={formData.phoneSuffix}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                if (value.length <= 7) {
                                                    setFormData({ ...formData, phoneSuffix: value });
                                                }
                                            }}
                                            required
                                        />
                                        <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">phone</span>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Correo Electrónico</label>
                                <div className="relative group text-sm">
                                    <input
                                        name="email"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                        placeholder="correo@ejemplo.com"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">mail</span>
                                </div>
                            </div>

                            {/* Fecha de Nacimiento */}
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Fecha de Nacimiento</label>
                                <div className="relative group text-sm">
                                    <input
                                        name="birthDate"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={handleChange}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">cake</span>
                                </div>
                            </div>

                            {/* Password */}
                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Contraseña</label>
                                <div className="relative group text-sm">
                                    <input
                                        name="password"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 pr-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                        placeholder="••••••••"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">lock</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-2.5 text-slate-300 hover:text-[#ff6a00] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Campos Específicos para Dueño */}
                            {activeTab === 'admin' && (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Nombre del Negocio</label>
                                        <div className="relative group text-sm">
                                            <input
                                                name="shopCode"
                                                className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                                placeholder="Ej. Panadería Delicias"
                                                type="text"
                                                value={formData.shopCode}
                                                onChange={handleChange}
                                                required
                                            />
                                            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">store</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">RIF / Identificación Fiscal</label>
                                        <div className="relative group text-sm">
                                            <input
                                                name="rif"
                                                className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                                placeholder="Ej. J-12345678-9"
                                                type="text"
                                                value={formData.rif}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, rif: e.target.value.toUpperCase() });
                                                }}
                                                required
                                            />
                                            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-xl">badge</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#ff6a00] hover:bg-[#ff8c3a] text-white font-black h-13 rounded-2xl shadow-xl shadow-[#ff6a00]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] mt-4"
                            >
                                {loading ? (
                                    <span className="animate-spin material-symbols-outlined">refresh</span>
                                ) : (
                                    <>
                                        <span className="text-sm">Crear mi Cuenta</span>
                                        <span className="material-symbols-outlined text-lg">rocket_launch</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-4 text-center pt-2 border-t border-[#595A5B] shrink-0">
                            <p className="text-slate-500 text-[11px] font-medium">
                                ¿Ya tienes cuenta?
                                <Link className="text-[#ff6a00] font-bold hover:underline ml-1" to="/login">Inicia sesión</Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Credits */}
                <div className="max-w-[440px] w-full mx-auto pb-2 text-center shrink-0 flex flex-col gap-4">
                    <p className="text-black text-[10px] font-bold uppercase tracking-widest">
                        Desarrollado por CloudNets 2026 - Venezuela
                    </p>
                    
                    {/* Banner Naranja */}
                    <div className="bg-[#ff6a00] h-3 w-full rounded-full shadow-lg shadow-[#ff6a00]/30"></div>
                </div>
            </div>
        </div>
    );
};

export default Register;
