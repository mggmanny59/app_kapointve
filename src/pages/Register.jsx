import React, { useState } from 'react';
import Icon from '../components/Icon';

import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useRateLimit } from '../hooks/useRateLimit';
import { getSafeErrorMessage } from '../lib/safeErrors';
import { supabase } from '../lib/supabase';

const Register = () => {
    const [activeTab, setActiveTab] = useState('client');
    const [formData, setFormData] = useState({
        name: '',
        phonePrefix: '0412',
        phoneSuffix: '',
        email: '',
        password: '',
        birthDate: '', 
        shopCode: '', 
        rif: '', 
        confirmEmail: '' 
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const { checkBlocked, recordFailure, recordSuccess, remainingAttempts } = useRateLimit({ maxAttempts: 5, lockoutDuration: 60000 });
    const [acceptedTerms, setAcceptedTerms] = useState(false);

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
                rif: '',
                confirmEmail: ''
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        const { blocked, secondsLeft } = checkBlocked();
        if (blocked) {
            showNotification('error', 'Registro Bloqueado', 
                `Demasiados intentos. Espera ${secondsLeft} segundos antes de intentar de nuevo.`);
            return;
        }

        if (formData.phoneSuffix.length !== 7 || !/^\d+$/.test(formData.phoneSuffix)) {
            showNotification('error', 'Teléfono Inválido', 'El número de teléfono debe tener exactamente 7 dígitos.');
            return;
        }

        if (!acceptedTerms) {
            showNotification('error', 'Aceptación Requerida', 'Debes aceptar los Términos y Condiciones para continuar.');
            return;
        }

        if (formData.email.trim().toLowerCase() !== formData.confirmEmail.trim().toLowerCase()) {
            showNotification('error', 'Correos no coinciden', 'Los correos electrónicos ingresados no son iguales.');
            return;
        }

        setLoading(true);

        const fullPhone = `${formData.phonePrefix}${formData.phoneSuffix}`;

        try {
            const { data: phoneCheck, error: phoneCheckError } = await supabase
                .from('profiles')
                .select('id')
                .eq('phone', fullPhone)
                .maybeSingle();

            if (phoneCheckError) throw phoneCheckError;
            
            if (phoneCheck) {
                recordFailure();
                showNotification('error', 'Teléfono en Uso', 'Este número de teléfono ya está registrado o en uso por otro usuario.');
                setLoading(false);
                return;
            }

            const metadata = {
                full_name: formData.name,
                role: activeTab,
            };
            
            const cleanEmail = formData.email.trim();
            const dataResult = await signUp(cleanEmail, formData.password, metadata);

            if (dataResult?.user?.identities?.length === 0) {
                recordFailure();
                showNotification('error', 'Cuenta Existente', 'Este correo electrónico ya está registrado. Intenta iniciar sesión.');
                setLoading(false);
                return;
            }

            const userId = dataResult.user.id;

            await supabase
                .from('profiles')
                .update({
                    phone: fullPhone,
                    full_name: formData.name,
                    email: cleanEmail,
                    birth_date: formData.birthDate || null,
                })
                .eq('id', userId);

            if (activeTab === 'admin') {
                if (!formData.shopCode || !formData.rif) {
                    throw new Error('El nombre del negocio y el RIF son obligatorios.');
                }

                const initialExpiry = new Date();
                initialExpiry.setDate(initialExpiry.getDate() + 30);

                const { data: newBiz, error: bizError } = await supabase
                    .from('businesses')
                    .insert({
                        name: formData.shopCode,
                        rif: formData.rif,
                        owner_id: userId,
                        is_active: true,
                        registration_status: 'PENDING',
                        subscription_plan: 'BASIC',
                        subscription_expiry: initialExpiry.toISOString()
                    })
                    .select()
                    .single();

                if (bizError) throw bizError;

                await supabase
                    .from('business_members')
                    .insert({
                        business_id: newBiz.id,
                        profile_id: userId,
                        role: 'owner'
                    });

                showNotification('success', '¡Registro Recibido!', 'Tu solicitud de registro ha sido enviada. Un administrador verificará tus datos pronto.');

            } else {
                showNotification('success', '¡Cuenta Creada!', 'Tu cuenta ha sido creada exitosamente.');
            }

            recordSuccess();
            navigate('/login');
        } catch (err) {
            recordFailure();
            const friendlyMessage = getSafeErrorMessage(err);
            showNotification('error', 'Error en Registro', friendlyMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col bg-white text-slate-900 font-display overflow-y-auto relative">
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

                    <div className="max-w-[440px] w-full mx-auto bg-white/95 backdrop-blur-sm rounded-[40px] shadow-[0_30px_90px_-12px_rgba(0,0,0,0.75)] p-10 border border-white flex flex-col overflow-hidden">
                        <div className="text-center mb-6 shrink-0">
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">¡Únete ahora!</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Crea tu cuenta en segundos</p>
                        </div>

                        <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-[#595A5B] mb-4 text-xs shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab('client')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'client'
                                    ? 'bg-[#ff6a00] text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <Icon name="person" className="!w-4 !h-4" />
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
                                <Icon name="storefront" className="!w-4 !h-4" />
                                Dueño
                            </button>
                        </div>

                        <form 
                            key={activeTab}
                            onSubmit={handleRegister} 
                            className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar" 
                            autoComplete="off"
                        >
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
                                    <Icon name="person" className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-[#ff6a00] transition-colors !w-5 !h-5" />
                                </div>
                            </div>

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
                                        <Icon name="expand_more" className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none !w-5 !h-5" />
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
                                        <Icon name="phone" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                    </div>
                                </div>
                            </div>

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
                                        onCopy={(e) => e.preventDefault()}
                                        onPaste={(e) => e.preventDefault()}
                                    />
                                    <Icon name="mail" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-slate-900 text-[10px] font-black uppercase tracking-widest ml-1 opacity-70">Confirmar Correo Electrónico</label>
                                <div className="relative group text-sm">
                                    <input
                                        name="confirmEmail"
                                        className="w-full rounded-2xl border-[#595A5B] bg-slate-50/50 text-slate-900 h-11 px-4 pl-11 focus:outline-none focus:border-[#ff6a00] transition-all"
                                        placeholder="correo@ejemplo.com"
                                        type="email"
                                        value={formData.confirmEmail}
                                        onChange={handleChange}
                                        required
                                        onCopy={(e) => e.preventDefault()}
                                        onPaste={(e) => e.preventDefault()}
                                    />
                                    <Icon name="mark_email_read" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                </div>
                            </div>

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
                                    <Icon name="cake" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                </div>
                            </div>

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
                                    <Icon name="lock" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-2.5 text-slate-300 hover:text-[#ff6a00] transition-colors"
                                    >
                                        <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="!w-5 !h-5" />
                                    </button>
                                </div>
                            </div>

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
                                            <Icon name="store" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
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
                                            <Icon name="badge" className="absolute left-3.5 top-2.5 text-slate-400 !w-5 !h-5" />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 flex items-start gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setAcceptedTerms(!acceptedTerms)}
                                    className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${acceptedTerms
                                        ? 'bg-[#ff6a00] border-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20'
                                        : 'border-[#595A5B] bg-white'
                                        }`}
                                >
                                    {acceptedTerms && <Icon name="check" className="!w-4 !h-4" />}
                                </button>
                                <div className="text-[11px] leading-relaxed text-slate-600 font-medium">
                                    Acepto los <Link to="/terms" className="text-[#ff6a00] font-bold hover:underline">Términos y Condiciones</Link> y el tratamiento de mis datos.
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#ff6a00] hover:bg-[#ff8c3a] text-white font-black h-13 rounded-2xl shadow-xl shadow-[#ff6a00]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] mt-4"
                            >
                                {loading ? (
                                    <Icon name="refresh" className="animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-sm">Crear mi Cuenta</span>
                                        <Icon name="rocket_launch" className="!w-5 !h-5" />
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

                <div className="max-w-[440px] w-full mx-auto pb-2 text-center shrink-0 flex flex-col gap-4">
                    <p className="text-black text-[10px] font-bold uppercase tracking-widest">
                        Desarrollado por CloudNets 2026 - Venezuela
                    </p>
                    <div className="bg-[#ff6a00] h-3 w-full rounded-full shadow-lg shadow-[#ff6a00]/30"></div>
                </div>
            </div>
        </div>
    );
};

export default Register;
