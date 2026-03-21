import React, { useState, useEffect } from 'react';

/**
 * Componente PWAInstallPrompt (Gatway / Portero Premium)
 * 
 * Este componente intercepta el acceso inicial a la aplicación.
 * 1. Oculta el Login inicialmente.
 * 2. Detecta si es Android (automático) o iPhone (instrucciones manuales).
 * 3. Si es Android: Muestra el botón de "Instalar ahora".
 * 4. Si es iPhone: Muestra una guía rápida de 2 pasos para Safari.
 * 5. Si rechaza o ya lo hizo, permite el acceso al Login.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [step, setStep] = useState('waiting'); // waiting, ask, ios-instructions, instructions, resolved
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 1. Detectar si es iOS (iPhone/iPad)
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(ios);

        // 2. Detectar si ya estamos en modo instalado (standalone/fullscreen)
        const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                          window.matchMedia('(display-mode: fullscreen)').matches ||
                          window.navigator.standalone === true;
        
        setIsStandalone(standalone);

        // Si ya está instalada o ya se resolvió en esta sesión, no molestamos más
        if (standalone || sessionStorage.getItem('pwa-flow-resolved') === 'true') {
            setStep('resolved');
            return;
        }

        // 3. Manejo de Android (beforeinstallprompt)
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!ios) setStep('ask');
        };

        window.addEventListener('beforeinstallprompt', handler);

        // 4. Temporizador de decisión (especialmente para iOS)
        const waitTime = ios ? 1000 : 3500;
        
        const timeout = setTimeout(() => {
            if (step === 'waiting') {
                if (ios) {
                    setStep('ios-instructions');
                } else {
                    // Si es Android y no disparó el evento (ya instalada o no compatible)
                    setStep('resolved');
                }
            }
        }, waitTime);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timeout);
        };
    }, [step, isIOS]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setStep('instructions');
        else handleDismiss();
    };

    const handleDismiss = () => {
        setStep('resolved');
        sessionStorage.setItem('pwa-flow-resolved', 'true');
    };

    // Si ya estamos instalados o el flujo se completó, no mostramos nada (se ve la App de fondo)
    if (step === 'resolved' || isStandalone) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-white overflow-hidden animate-in fade-in duration-500">
            {/* Fondo con imagen BannerLogin suave */}
            <div className="absolute inset-0 z-0 overflow-hidden opacity-10">
                <img
                    src="/BannerLogin.png"
                    alt="Background"
                    className="w-full h-full object-cover grayscale"
                />
            </div>

            <div className="relative z-10 max-w-[360px] w-full bg-white/60 backdrop-blur-md rounded-[3rem] p-8 flex flex-col items-center text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-white">
                
                {/* Logo KPoint */}
                <div className="bg-white p-4 rounded-[2rem] shadow-xl mb-6 border border-white/50 flex flex-col items-center gap-1">
                    <img 
                        src="/Logo KPoint Solo K (sin Fondo).png" 
                        alt="Logo" 
                        className="size-10 object-contain"
                    />
                    <h1 className="text-xl font-black tracking-tighter">
                        <span className="text-[rgb(0,152,235)]">K</span>
                        <span className="text-[#ff6a00]">P</span>
                        <span className="text-black">oint</span>
                    </h1>
                </div>

                {step === 'waiting' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <div className="size-12 border-4 border-slate-100 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-6">Sincronizando Sistema...</p>
                    </div>
                )}

                {step === 'ask' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-3 mb-8 px-2">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                                ¡Instala KPoint!
                            </h4>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed">
                                Agrégala a tu inicio para un acceso más rápido y recibe notificaciones de tus puntos al instante.
                            </p>
                        </div>
                        
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={handleInstallClick}
                                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-100 transition-all active:scale-[0.97]"
                            >
                                Instalar ahora
                            </button>
                            <button 
                                onClick={handleDismiss}
                                className="w-full h-12 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-[0.97] transition-all"
                            >
                                Quizás luego
                            </button>
                        </div>
                    </div>
                )}

                {step === 'ios-instructions' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full text-left">
                        <div className="mb-6 text-center">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mb-2">
                                Instalar en iPhone
                            </h4>
                            <p className="text-xs text-slate-400 font-bold px-2">Solo toma 15 segundos y tendrás KPoint como App nativa.</p>
                        </div>

                        {/* Pasos Visuales para iOS */}
                        <div className="space-y-6 mb-10 w-full">
                            {/* Paso 1 */}
                            <div className="flex items-start gap-4">
                                <div className="size-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm font-black text-primary text-sm">1</div>
                                <div>
                                    <p className="text-slate-900 text-[13px] font-bold leading-tight">Presiona el botón de <span className="text-primary underline">Compartir</span> en la barra inferior de Safari.</p>
                                    <div className="mt-2 text-slate-400 flex items-center justify-center p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary italic"><path d="M4 12V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V12"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                    </div>
                                </div>
                            </div>
                            {/* Paso 2 */}
                            <div className="flex items-start gap-4">
                                <div className="size-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm font-black text-primary text-sm">2</div>
                                <div>
                                    <p className="text-slate-900 text-[13px] font-bold leading-tight">Desliza el menú hacia arriba y elige: <span className="text-primary underline">Añadir a pantalla de inicio</span>.</p>
                                    <div className="mt-2 text-slate-400 flex items-center justify-center p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <div className="size-6 border-2 border-primary rounded-md flex items-center justify-center relative">
                                            <span className="text-primary font-black text-lg">+</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleDismiss}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3"
                        >
                            Listo, ya lo hice
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                        </button>
                    </div>
                )}

                {(step === 'instructions') && (
                    <div className="animate-in zoom-in-95 duration-500">
                        <div className="size-20 rounded-[2.2rem] bg-green-50 flex items-center justify-center border-4 border-white shadow-inner mb-6 mx-auto animate-bounce">
                            <span className="material-symbols-outlined text-4xl text-green-500 font-black">check</span>
                        </div>
                        <div className="space-y-4 mb-10">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                                ¡Genial!
                            </h4>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed">
                                La aplicación se está instalando. Abre <span className="text-primary font-black">KPoint</span> desde tu pantalla principal para iniciar sesión.
                            </p>
                        </div>
                        
                        <button 
                            onClick={handleDismiss}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.97]"
                        >
                            Entendido
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 text-center px-6">
                <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">
                    KPoint Gateway • CloudNets 2026
                </p>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
