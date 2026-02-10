import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AuthLayout = ({ children, title, footerText, footerLinkText, footerLinkHref, showBackButton }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full flex flex-col bg-navy-dark font-display text-white items-center justify-center p-5">
            <div className="w-full max-w-[440px] flex flex-col items-center mb-8">
                <div className="bg-white p-3 rounded-card shadow-lg mb-4 flex items-center justify-center size-20">
                    <img
                        src="/Logo KPoint Solo K (sin Fondo).png"
                        alt="KPoint Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                    <span className="text-orange-500">K</span>Point
                </h1>
                <p className="text-slate-subtitle text-sm font-medium mt-1">
                    Tu monedero digital de recompensas
                </p>
            </div>

            <div className="w-full max-w-[440px] bg-navy-card rounded-card shadow-2xl p-6 border border-border-subtle">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white text-center">{title}</h2>
                </div>

                {children}

                <div className="mt-8 text-center">
                    <p className="text-slate-subtitle text-sm font-medium">
                        {footerText}
                        <Link
                            to={footerLinkHref}
                            className="text-primary font-bold hover:underline ml-1"
                        >
                            {footerLinkText}
                        </Link>
                    </p>
                </div>
            </div>

            {showBackButton && (
                <button
                    onClick={() => navigate(-1)}
                    className="mt-6 flex items-center gap-2 text-slate-subtitle hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
                    <span className="text-sm font-bold uppercase tracking-wider">Volver</span>
                </button>
            )}

            <footer className="mt-12 flex flex-col items-center gap-2 text-slate-subtitle/50">
                <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest">
                    <span className="material-symbols-outlined !text-xs">verified_user</span>
                    Seguridad de Grado Bancario
                </p>
            </footer>
        </div>
    );
};

export default AuthLayout;
