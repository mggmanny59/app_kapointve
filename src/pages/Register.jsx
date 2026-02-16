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

                // Create the Business Entry
                const { data: newBiz, error: bizError } = await supabase
                    .from('businesses')
                    .insert({
                        name: formData.shopCode,
                        rif: formData.rif,
                        owner_id: userId,
                        is_active: true,
                        registration_status: isPlatformOwner ? 'OK' : 'PENDING' // Auto-approve the owner
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
        <AuthLayout
            title="¡Únete ahora!"
            footerText="¿Ya tienes cuenta?"
            footerLinkText="Inicia sesión"
            footerLinkHref="/login"
            showBackButton={true}
        >
            {/* Role Tabs */}
            <div className="flex bg-navy-dark p-1 rounded-card border border-border-subtle mb-4">
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

            <div className="mb-3 text-center">
                <h3 className="text-xl font-bold text-white">Crear Cuenta</h3>
                <p className="text-slate-subtitle text-sm mt-0">
                    {activeTab === 'client'
                        ? 'Únete para ganar recompensas'
                        : 'Registra tu negocio en KPoint'}
                </p>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-3" autoComplete="off">
                {/* Nombre Completo */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-xs font-bold pb-1 ml-1">
                        {activeTab === 'admin' ? 'Nombre del Representante Legal' : 'Nombre Completo'}
                    </span>
                    <div className="relative group">
                        <input
                            name="name"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all"
                            placeholder="Ej. Juan Pérez"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">person</span>
                    </div>
                </label>

                {/* Teléfono */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-xs font-bold pb-1 ml-1">Número de Teléfono</span>
                    <div className="flex gap-2">
                        <div className="relative w-1/3">
                            <select
                                name="phonePrefix"
                                value={formData.phonePrefix}
                                onChange={handleChange}
                                className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 px-4 py-2 font-medium text-xs transition-all appearance-none cursor-pointer"
                            >
                                <option value="0412" className="bg-navy-dark text-white font-medium text-xs">0412</option>
                                <option value="0416" className="bg-navy-dark text-white font-medium text-xs">0416</option>
                                <option value="0414" className="bg-navy-dark text-white font-medium text-xs">0414</option>
                                <option value="0424" className="bg-navy-dark text-white font-medium text-xs">0424</option>
                                <option value="0426" className="bg-navy-dark text-white font-medium text-xs">0426</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-2.5 text-slate-subtitle pointer-events-none text-xs">expand_more</span>
                        </div>
                        <div className="relative flex-1">
                            <input
                                name="phoneSuffix"
                                autoComplete="off"
                                className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium text-xs transition-all"
                                placeholder="1234567"
                                type="tel"
                                maxLength="7"
                                value={formData.phoneSuffix}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, ''); // Only numbers
                                    if (value.length <= 7) {
                                        setFormData({ ...formData, phoneSuffix: value });
                                    }
                                }}
                                required
                            />
                            <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">phone</span>
                        </div>
                    </div>
                </label>

                {/* Email */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-xs font-bold pb-1 ml-1">Correo Electrónico</span>
                    <div className="relative group">
                        <input
                            name="email"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all"
                            placeholder="correo@ejemplo.com"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">mail</span>
                    </div>
                </label>

                {/* Fecha de Nacimiento */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-xs font-bold pb-1 ml-1">Fecha de Nacimiento</span>
                    <div className="relative group">
                        <input
                            name="birthDate"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all"
                            type="date"
                            value={formData.birthDate}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">cake</span>
                    </div>
                </label>

                {/* Password */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-xs font-bold pb-1 ml-1">Contraseña</span>
                    <div className="relative group">
                        <input
                            name="password"
                            autoComplete="new-password"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all pr-12"
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-2.5 text-slate-subtitle hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">
                                {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                </label>

                {/* Campos Específicos para Dueño */}
                {activeTab === 'admin' && (
                    <>
                        {/* Nombre del Negocio */}
                        <label className="flex flex-col w-full">
                            <span className="text-slate-200 text-xs font-bold pb-1 ml-1">Nombre del Negocio</span>
                            <div className="relative group">
                                <input
                                    name="shopCode" // We reuse this state key for business name to minimize refactor
                                    autoComplete="off"
                                    className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all"
                                    placeholder="Ej. Panadería Delicias"
                                    type="text"
                                    value={formData.shopCode}
                                    onChange={handleChange}
                                    required
                                />
                                <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">store</span>
                            </div>
                        </label>

                        {/* RIF */}
                        <label className="flex flex-col w-full">
                            <span className="text-slate-200 text-xs font-bold pb-1 ml-1">RIF / Identificación Fiscal</span>
                            <div className="relative group">
                                <input
                                    name="rif"
                                    autoComplete="off"
                                    className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-11 placeholder:text-slate-500 px-4 py-2 font-medium transition-all"
                                    placeholder="Ej. J-12345678-9"
                                    type="text"
                                    value={formData.rif}
                                    onChange={(e) => {
                                        setFormData({ ...formData, rif: e.target.value.toUpperCase() });
                                    }}
                                    required
                                />
                                <span className="material-symbols-outlined absolute right-4 top-2.5 text-slate-subtitle">badge</span>
                            </div>
                        </label>
                    </>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-navy-dark font-black text-lg rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
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
