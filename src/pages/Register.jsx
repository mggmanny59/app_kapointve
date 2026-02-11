import React, { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';

const Register = () => {
    const [activeTab, setActiveTab] = useState('client');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        password: '',
        shopCode: ''
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
                phone: '',
                email: '',
                password: '',
                shopCode: ''
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
        setLoading(true);

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

            // 1. Update profile with phone number (and possibly metadata if not handled by trigger)
            await supabase
                .from('profiles')
                .update({
                    phone: formData.phone,
                    full_name: formData.name,
                    email: formData.email
                })
                .eq('id', userId);

            // 2. Link User to Business based on role
            const businessCode = formData.shopCode || 'KPOINT001'; // Default for MVP testing

            // Find the business anyway if a code is provided
            const { data: bizData } = await supabase
                .from('businesses')
                .select('id')
                .eq('rif', businessCode)
                .maybeSingle();

            const finalizedBizId = (businessCode === 'KPOINT001')
                ? '00000000-0000-0000-0000-000000000001'
                : bizData?.id;

            if (activeTab === 'admin') {
                if (!finalizedBizId) {
                    throw new Error('El código de comercio ingresado no es válido para Dueños.');
                }
                // Insert into business_members
                await supabase
                    .from('business_members')
                    .insert({
                        business_id: finalizedBizId,
                        profile_id: userId,
                        role: 'owner'
                    });
            } else {
                // It's a CLIENT - Create their loyalty card if code is valid
                if (finalizedBizId) {
                    await supabase
                        .from('loyalty_cards')
                        .insert({
                            business_id: finalizedBizId,
                            profile_id: userId,
                            current_points: 0
                        });
                }
            }

            showNotification('success', '¡Registro Exitoso!', 'Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión.');
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
        <AuthLayout
            title="¡Únete ahora!"
            footerText="¿Ya tienes cuenta?"
            footerLinkText="Inicia sesión"
            footerLinkHref="/login"
            showBackButton={true}
        >
            {/* Role Tabs */}
            <div className="flex bg-navy-dark p-1 rounded-card border border-border-subtle mb-8">
                <button
                    type="button"
                    onClick={() => setActiveTab('client')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'client'
                        ? 'bg-primary text-navy-dark shadow-lg shadow-primary/20'
                        : 'text-slate-subtitle hover:text-white'
                        }`}
                >
                    <span className="material-symbols-outlined text-lg">person</span>
                    Soy Cliente
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'admin'
                        ? 'bg-primary text-navy-dark shadow-lg shadow-primary/20'
                        : 'text-slate-subtitle hover:text-white'
                        }`}
                >
                    <span className="material-symbols-outlined text-lg">storefront</span>
                    Dueño
                </button>
            </div>

            <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-white">Crear Cuenta</h3>
                <p className="text-slate-subtitle text-sm mt-1">
                    {activeTab === 'client'
                        ? 'Únete para ganar recompensas'
                        : 'Registra tu negocio en KPoint'}
                </p>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-5" autoComplete="off">
                {/* Nombre Completo */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Nombre Completo</span>
                    <div className="relative group">
                        <input
                            name="name"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="Ej. Juan Pérez"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-subtitle">person</span>
                    </div>
                </label>

                {/* Teléfono */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Número de Teléfono</span>
                    <div className="relative group">
                        <input
                            name="phone"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="Ej. +58 412 1234567"
                            type="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-subtitle">phone</span>
                    </div>
                </label>

                {/* Email */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Correo Electrónico</span>
                    <div className="relative group">
                        <input
                            name="email"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="correo@ejemplo.com"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-subtitle">mail</span>
                    </div>
                </label>

                {/* Password */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Contraseña</span>
                    <div className="relative group">
                        <input
                            name="password"
                            autoComplete="new-password"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all pr-12"
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-4 text-slate-subtitle hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">
                                {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                </label>

                {/* Código del Comercio (Visible para todos en el registro) */}
                <label className="flex flex-col w-full">
                    <div className="pb-2 ml-1">
                        <span className="text-slate-200 text-sm font-bold">
                            {activeTab === 'admin' ? 'Código del Comercio' : 'Código de Invitación (Opcional)'}
                        </span>
                    </div>
                    <div className="relative group">
                        <input
                            name="shopCode"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder={activeTab === 'admin' ? "Código único requerido" : "Ej. KPOINT001"}
                            type="text"
                            value={formData.shopCode}
                            onChange={handleChange}
                            required={activeTab === 'admin'}
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-subtitle">store</span>
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-navy-dark font-black text-lg rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="animate-spin material-symbols-outlined">refresh</span>
                    ) : (
                        <>
                            <span>Crear mi Cuenta</span>
                            <span className="material-symbols-outlined text-xl">rocket_launch</span>
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default Register;
