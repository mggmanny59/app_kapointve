import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AuthLayout = ({ children, title, subtitle, footerText, footerLinkText, footerLinkHref, showBackButton }) => {
    const navigate = useNavigate();

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-navy-dark font-display">
            {/* Background Section */}
            <div className="relative h-[40vh] w-full overflow-hidden">
                <div
                    className="absolute inset-0 bg-center bg-cover bg-no-repeat transition-transform duration-700 scale-105 opacity-80"
                    style={{
                        backgroundImage: 'url("/BannerLogin.png")'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-dark via-navy-dark/20 to-transparent" />

                {/* Navigation / Logo Area */}
                <div className="absolute top-8 left-0 right-0 px-6 flex items-center justify-between z-10">
                    {showBackButton ? (
                        <button
                            onClick={() => navigate(-1)}
                            className="text-white flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back_ios_new</span>
                        </button>
                    ) : <div className="size-10" />}
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-10">
                    <div className="flex flex-col items-center">
                        <div className="bg-white p-3 rounded-3xl shadow-2xl mb-4 overflow-hidden flex items-center justify-center size-24">
                            <img
                                src="/Logo KPoint Solo K (sin Fondo).png"
                                alt="KPoint Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white text-center">
                            <span className="text-accent">K</span>Point
                        </h1>
                        <p className="text-slate-200 text-base font-bold mt-2 text-center drop-shadow-md">
                            Tu monedero digital de recompensas
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Section */}
            <div className="relative -mt-12 flex-1 px-5 pb-10 z-20">
                <div className="mx-auto max-w-[440px] bg-navy-card rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-8 border border-white/5">
                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">{title}</h2>
                    </div>

                    {children}

                    <div className="mt-10 text-center">
                        <p className="text-slate-400 text-base font-medium">
                            {footerText}
                            <Link
                                to={footerLinkHref}
                                className="text-accent font-extrabold hover:underline decoration-2 underline-offset-4 ml-1"
                            >
                                {footerLinkText}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <footer className="mt-auto px-4 py-8 text-center text-slate-500">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-[10px] flex items-center justify-center gap-1.5 font-bold uppercase tracking-[0.2em]">
                        <span className="material-symbols-outlined !text-xs text-primary">verified_user</span>
                        Seguridad de Grado Bancario
                    </p>
                    <p className="text-[10px] max-w-[300px] leading-relaxed opacity-60">
                        Al continuar, reconoces nuestros <a href="#" className="underline">Términos</a> y <a href="#" className="underline">Privacidad</a>.
                    </p>
                </div>
            </footer>
            <div className="h-4 w-full" />
        </div>
    );
};

export default AuthLayout;
