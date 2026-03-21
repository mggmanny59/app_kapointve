import React, { useState, useEffect } from 'react';

/**
 * Componente PWAInstallPrompt (Gatway / Portero)
 * 
 * Este componente intercepta el acceso inicial a la aplicación.
 * 1. Oculta el Login inicialmente.
 * 2. Pregunta si se desea instalar la App.
 * 3. Si acepta, muestra instrucciones de éxito.
 * 4. Si rechaza, permite el acceso al Login.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [step, setStep] = useState('waiting'); // waiting, ask, instructions, resolved
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Detectar si ya estamos en modo instalado (standalone/fullscreen)
        const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                          window.matchMedia('(display-mode: fullscreen)').matches ||
                          window.navigator.standalone === true;
        
        setIsStandalone(standalone);

        // Si ya está instalada o ya se resolvió en esta sesión, no molestamos más
        if (standalone || sessionStorage.getItem('pwa-flow-resolved') === 'true') {
            setStep('resolved');
            return;
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            // En cuanto el navegador nos da el permiso de instalación, mostramos el mensaje
            // La instrucción es que sea lo primero que vea al acceder al link
            setStep('ask');
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Fallback: Si después de 3 segundos el navegador no ha disparado el evento 
        // (por ejemplo, porque ya está instalada o el navegador no es compatible), 
        // permitimos el acceso al login para no dejar al usuario bloqueado.
        const timeout = setTimeout(() => {
            if (step === 'waiting') {
                setStep('resolved');
            }
        }, 3000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timeout);
        };
    }, [step]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Disparamos el prompt nativo
        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            // Paso 3: Mostrar mensaje de instrucciones
            setStep('instructions');
        } else {
            // Paso 4: Si responde que no, ir al Login
            handleDismiss();
        }
    };

    const handleDismiss = () => {
        setStep('resolved');
        sessionStorage.setItem('pwa-flow-resolved', 'true');
    };

    // Si ya estamos instalados o el flujo se completó, no mostramos nada (se ve la App de fondo)
    if (step === 'resolved' || isStandalone) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-white overflow-hidden animate-in fade-in duration-500">
            {/* Imagen de fondo decorativa (BannerLogin difuminado) */}
            <div className="absolute inset-0 z-0 overflow-hidden opacity-10">
                <img
                    src="/BannerLogin.png"
                    alt="Background"
                    className="w-full h-full object-cover grayscale"
                />
            </div>

            <div className="relative z-10 max-w-[360px] w-full bg-white/40 backdrop-blur-md rounded-[3rem] p-10 flex flex-col items-center text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-white">
                
                {/* Logo KPoint */}
                <div className="bg-white p-4 rounded-[2rem] shadow-xl mb-8 border border-white/50 flex flex-col items-center gap-1 animate-in zoom-in-95 duration-500">
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
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-12 border-4 border-slate-100 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Iniciando Experiencia...</p>
                    </div>
                )}

                {step === 'ask' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-3 mb-10">
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

                {step === 'instructions' && (
                    <div className="animate-in zoom-in-95 duration-500">
                        <div className="size-20 rounded-[2rem] bg-green-50 flex items-center justify-center border-4 border-white shadow-inner mb-6 mx-auto">
                            <span className="material-symbols-outlined text-4xl text-green-500 font-black">check</span>
                        </div>
                        <div className="space-y-4 mb-10">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                                ¡Casi listo!
                            </h4>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed">
                                La aplicación se instalará en tu dispositivo. Busca el icono de <span className="text-primary font-black">KPoint</span> en tu pantalla principal para ingresar.
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

            {/* Créditos en el fondo */}
            <div className="absolute bottom-8 text-center px-6">
                <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">
                    CloudNets 2026 - Venezuela
                </p>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
