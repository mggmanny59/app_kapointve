import React, { useState, useEffect } from 'react';

/**
 * PWAInstallPrompt - Flujo simplificado
 * - Muestra una sola pantalla: botón de instalar + opción de omitir.
 * - Al presionar "Instalar", lanza el diálogo del navegador directamente.
 * - Si el usuario acepta, la pantalla desaparece sin pasos intermedios.
 * - Si es iOS, muestra instrucciones manuales.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(ios);

        // Verificar si ya está instalada como PWA
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true;

        if (isStandalone) return; // Ya instalada, no mostrar nada

        // Recuperar el evento capturado en index.html
        if (window.deferredPWA) {
            setDeferredPrompt(window.deferredPWA);
            setIsVisible(true);
        } else if (ios) {
            // En iOS no hay evento, mostramos instrucciones manuales
            setIsVisible(true);
        }

        // Escuchar si el evento llega después
        const handler = (e) => {
            e.preventDefault();
            window.deferredPWA = e;
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        const prompt = deferredPrompt || window.deferredPWA;
        if (!prompt) return;

        // Lanzar diálogo nativo del navegador inmediatamente
        prompt.prompt();
        const { outcome } = await prompt.userChoice;

        // Sin importar si el usuario aceptó o canceló, limpiar y cerrar
        setDeferredPrompt(null);
        window.deferredPWA = null;
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-white overflow-hidden font-display">
            {/* Fondo decorativo */}
            <div className="absolute inset-0 z-0 opacity-10">
                <img src="/BannerLogin.png" alt="" className="w-full h-full object-cover" />
            </div>

            <div className="relative z-10 max-w-[400px] w-full bg-white/90 backdrop-blur-xl rounded-[3rem] p-10 flex flex-col items-center text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,0.18)] border border-white/60">

                {/* Logo */}
                <div className="bg-white p-4 rounded-[2.5rem] shadow-2xl mb-8 border border-slate-100 flex flex-col items-center gap-1">
                    <img src="/Logo KPoint Solo K (sin Fondo).png" alt="Logo KPoint" className="size-12 object-contain" />
                    <h1 className="text-2xl font-black tracking-tighter">
                        <span className="text-[rgb(0,152,235)]">K</span>
                        <span className="text-[#ff6a00]">P</span>
                        <span className="text-black">oint</span>
                    </h1>
                </div>

                {/* Contenido: Android/Desktop */}
                {!isIOS && (
                    <div className="w-full animate-slide-bottom-custom">
                        <h2 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mb-3">
                            Instalar App Oficial
                        </h2>
                        <p className="text-sm text-slate-400 font-semibold leading-relaxed mb-10 px-2">
                            Instala KPoint en tu dispositivo para una experiencia más rápida y segura.
                        </p>

                        <button
                            onClick={handleInstall}
                            className="w-full h-14 bg-[#ff6a00] text-white rounded-2xl font-black text-sm tracking-wide shadow-2xl shadow-[#ff6a00]/30 transition-all active:scale-[0.97] flex items-center justify-center gap-3 mb-4"
                        >
                            <span className="material-symbols-outlined text-xl">download</span>
                            Instalar KPoint
                        </button>

                        <button
                            onClick={handleDismiss}
                            className="text-slate-400 font-bold text-[11px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Continuar al Navegador
                        </button>
                    </div>
                )}

                {/* Contenido: iOS */}
                {isIOS && (
                    <div className="w-full text-left animate-slide-bottom-custom">
                        <h2 className="font-black text-slate-900 text-2xl tracking-tight text-center mb-2">
                            Instalar en iPhone
                        </h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center mb-8">
                            2 pasos simples
                        </p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="size-10 rounded-2xl bg-[#ff6a00] text-white flex items-center justify-center shrink-0 font-black text-sm">1</div>
                                <p className="text-slate-600 text-xs font-bold">
                                    Pulsa el botón <span className="text-[#ff6a00]">Compartir</span> en la barra de Safari.
                                </p>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="size-10 rounded-2xl bg-[#ff6a00] text-white flex items-center justify-center shrink-0 font-black text-sm">2</div>
                                <p className="text-slate-600 text-xs font-bold">
                                    Selecciona <span className="text-[#ff6a00]">"Añadir a pantalla de inicio"</span>.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleDismiss}
                            className="w-full text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest py-2"
                        >
                            Ver en Navegador
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p className="absolute bottom-8 text-slate-300 text-[9px] font-black uppercase tracking-[0.3em]">
                KPoint Official Application • 2026
            </p>
        </div>
    );
};

export default PWAInstallPrompt;
