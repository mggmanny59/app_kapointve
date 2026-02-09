import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message === 'Invalid login credentials' ? 'Credenciales inválidas. Por favor intenta de nuevo.' : err.message);
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
            <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-white">Iniciar Sesión</h3>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-400 text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold leading-normal pb-2 ml-1">
                        Correo Electrónico
                    </span>
                    <div className="relative group">
                        <input
                            type="email"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="correo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">mail</span>
                    </div>
                </label>

                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold leading-normal pb-2 ml-1">
                        Contraseña
                    </span>
                    <div className="relative group">
                        <input
                            type="password"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 font-medium transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">lock</span>
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-15 py-4 bg-primary hover:bg-primary/90 text-navy-dark font-black text-lg rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="animate-spin material-symbols-outlined">refresh</span>
                    ) : (
                        <>
                            <span>Iniciar Sesión</span>
                            <span className="material-symbols-outlined text-2xl font-black">arrow_forward</span>
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default Login;
