import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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

    // The app will stay on Login screen because we removed the automatic useEffect redirection
    // that happened on mount if 'user' was present. This ensures it "always starts on login".


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
                    .select('id')
                    .eq('profile_id', authUser.id)
                    .maybeSingle();

                if (dbError || !businessMember) {
                    await signOut();
                    throw new Error('Lo sentimos, esta cuenta no está registrada como Dueño de negocio.');
                }
                // If validation passes, navigate manually
                navigate('/dashboard');
            } else {
                // CLIENT VALIDATION: Strict separation
                // If it was registered with role 'admin' in metadata, we block it from client login
                const userRole = authUser.user_metadata?.role;
                if (userRole === 'admin') {
                    await signOut();
                    throw new Error('Esta cuenta es de tipo NEGOCIO. Por favor, selecciona la pestaña "Dueño" para ingresar.');
                }

                // AUTO-REPAIR: Ensure every client has at least the default business loyalty card
                const { data: clientCards } = await supabase
                    .from('loyalty_cards')
                    .select('id')
                    .eq('profile_id', authUser.id)
                    .limit(1);

                if (!clientCards || clientCards.length === 0) {
                    await supabase.from('loyalty_cards').insert({
                        business_id: '00000000-0000-0000-0000-000000000001',
                        profile_id: authUser.id,
                        current_points: 0
                    });
                }

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
        <AuthLayout
            title="Bienvenido a KPoint"
            footerText="¿Nuevo aquí?"
            footerLinkText="Regístrate"
            footerLinkHref="/register"
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
                    <span className="material-symbols-outlined text-lg">shopping_bag</span>
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
                <h3 className="text-xl font-bold text-white">
                    {activeTab === 'client' ? 'Acceso Clientes' : 'Acceso Negocio'}
                </h3>
                <p className="text-sm text-slate-subtitle mt-1">
                    {activeTab === 'client'
                        ? 'Consulta tus puntos y premios'
                        : 'Gestiona tu inventario y clientes'}
                </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5" autoComplete="off">
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold leading-normal pb-2 ml-1">
                        Correo Electrónico
                    </span>
                    <div className="relative group">
                        <input
                            type="email"
                            autoComplete="off"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="correo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-subtitle">mail</span>
                    </div>
                </label>

                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold leading-normal pb-2 ml-1">
                        Contraseña
                    </span>
                    <div className="relative group">
                        <input
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-border-subtle bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all pr-12"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-navy-dark font-black text-lg rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="animate-spin material-symbols-outlined">refresh</span>
                    ) : (
                        <>
                            <span>{activeTab === 'client' ? 'Ver mis Puntos' : 'Entrar al Panel'}</span>
                            <span className="material-symbols-outlined text-xl">arrow_forward</span>
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default Login;
