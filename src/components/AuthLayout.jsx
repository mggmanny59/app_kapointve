import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AuthLayout = ({ children, title, footerText, footerLinkText, footerLinkHref, showBackButton }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full flex flex-col relative font-display text-white items-center justify-center p-5 overflow-x-hidden bg-navy-dark">
            {/* Background Image with Framing and Gradient Fade */}
            <div className="absolute top-0 left-0 right-0 h-[60vh] z-0">
                <img
                    src="/BannerLogin.png"
                    alt="Background"
                    className="w-full h-full object-cover object-[center_top]"
                />
                {/* Gradient overlay: starts slightly tinted and fades completely to solid background */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f1a]/40 via-[#0a1f1a]/90 to-navy-dark"></div>
            </div>

            <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center mb-4">
                <div className="bg-white p-2.5 rounded-card shadow-lg mb-2 flex items-center justify-center size-16">
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

            <div className="relative z-10 w-full max-w-[440px] bg-navy-card/90 backdrop-blur-md rounded-card shadow-2xl px-5 py-4 border border-border-subtle">
                <div className="mb-3">
                    <h2 className="text-2xl font-bold text-white text-center">{title}</h2>
                </div>

                {children}

                <div className="mt-4 text-center">
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
                    className="relative z-10 mt-6 flex items-center gap-2 text-slate-subtitle hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
                    <span className="text-sm font-bold uppercase tracking-wider">Volver</span>
                </button>
            )}

            <footer className="relative z-10 mt-6 flex flex-col items-center gap-2 text-slate-subtitle/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-center">
                    Desarrollado por CloudNets 2026
                </p>
            </footer>
        </div>
    );
};

export default AuthLayout;
