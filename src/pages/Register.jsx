import React, { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        shopCode: ''
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const data = await signUp(formData.email, formData.password, {
                full_name: formData.name,
                shop_code: formData.shopCode,
            });

            // Supabase returns a successful response even if the email exists (security feature)
            // but the 'identities' array will be empty if the user already exists.
            if (data?.user?.identities?.length === 0) {
                setError('Este correo electrónico ya está registrado. Intenta iniciar sesión.');
                setLoading(false);
                return;
            }

            navigate('/login');
        } catch (err) {
            let friendlyMessage = err.message;
            if (err.message.includes('User already registered')) {
                friendlyMessage = 'Este correo electrónico ya está registrado.';
            } else if (err.message.includes('Password should be')) {
                friendlyMessage = 'La contraseña debe tener al menos 6 caracteres.';
            }
            setError(friendlyMessage);
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
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white text-center">Crear Cuenta</h3>
                <p className="text-slate-400 text-sm mt-1 font-medium text-center">Únete a la red KPoint</p>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-400 text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                {/* Nombre Completo */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Nombre Completo</span>
                    <div className="relative group">
                        <input
                            name="name"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 text-base font-medium transition-all"
                            placeholder="Ej. Juan Pérez"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">person</span>
                    </div>
                </label>

                {/* Email */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Correo Electrónico</span>
                    <div className="relative group">
                        <input
                            name="email"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 text-base font-medium transition-all"
                            placeholder="correo@ejemplo.com"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">mail</span>
                    </div>
                </label>

                {/* Password */}
                <label className="flex flex-col w-full">
                    <span className="text-slate-200 text-sm font-bold pb-2 ml-1">Contraseña</span>
                    <div className="relative group">
                        <input
                            name="password"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 text-base font-medium transition-all"
                            placeholder="••••••••"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">lock</span>
                    </div>
                </label>

                {/* Código del Comercio */}
                <label className="flex flex-col w-full">
                    <div className="pb-2 ml-1">
                        <span className="text-slate-200 text-sm font-bold">Ingresa el Código del comercio</span>
                    </div>
                    <div className="relative group">
                        <input
                            name="shopCode"
                            className="form-input flex w-full rounded-xl text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-white/10 bg-navy-dark h-14 placeholder:text-slate-500 p-4 text-base font-medium transition-all"
                            placeholder="Código único del comercio"
                            type="text"
                            value={formData.shopCode}
                            onChange={handleChange}
                            required
                        />
                        <span className="material-symbols-outlined absolute right-4 top-4 text-slate-400">store</span>
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-15 py-4 bg-primary hover:bg-primary/90 text-navy-dark font-black text-lg rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="animate-spin material-symbols-outlined text-2xl">refresh</span>
                    ) : (
                        <>
                            <span>Crear mi Cuenta</span>
                            <span className="material-symbols-outlined text-2xl font-black">rocket_launch</span>
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default Register;
