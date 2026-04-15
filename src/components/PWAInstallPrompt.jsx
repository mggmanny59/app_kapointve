import React, { useState, useEffect } from 'react';

/**
 * Componente PWAInstallPrompt (Gateway Obligatorio Premium)
 * 
 * Este componente es el "Portero" de la aplicación.
 * - SIEMPRE bloquea el acceso si la app no está en modo Standalone.
 * - Guía al usuario por pasos con barra de progreso naranja KPoint.
 * - No permite "Omitir": la fidelización es una experiencia de App.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [step, setStep] = useState('detecting'); // detecting, ask, installing, ios-instructions, success
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Iniciando...');
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(ios);

        const checkStandalone = () => {
            const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                              window.matchMedia('(display-mode: fullscreen)').matches ||
                              window.navigator.standalone === true;
            setIsStandalone(standalone);
            return standalone;
        };

        if (checkStandalone()) {
            setStep('success');
            return;
        }

        // Recuperar el evento si ya fue capturado globalmente por el index.html
        if (window.deferredPWA) {
            setDeferredPrompt(window.deferredPWA);
            setStep('ask');
        }

        // Seguir escuchando por si acaso
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            window.deferredPWA = e;
            setStep('ask');
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Si es iOS, vamos directo a instrucciones después de un momento
        if (ios && !checkStandalone()) {
            setTimeout(() => setStep('ios-instructions'), 1000);
        } else if (!ios) {
            // Si pasaron 3 segundos y no hubo prompt de Android, puede que ya esté instalada 
            // o el navegador no sea compatible.
            setTimeout(() => {
                if (step === 'detecting' && !checkStandalone()) {
                    setStep('ask'); // Forzamos a que intente instalar o vea instrucciones
                }
            }, 3000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [isStandalone]);

    // Simulación de progreso de instalación
    const runInstallationSequence = async () => {
        setStep('installing');
        
        const sequence = [
            { p: 20, t: 'Verificando compatibilidad...' },
            { p: 45, t: 'Sincronizando recursos locales...' },
            { p: 75, t: 'Configurando base de datos segura...' },
            { p: 90, t: 'Generando suscripción de notificaciones...' },
            { p: 100, t: '¡Sistema KPoint Listo!' }
        ];

        for (const item of sequence) {
            setStatusText(item.t);
            // Simular tiempo de procesamiento
            await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
            setProgress(item.p);
        }

        setStep('success');
    };

    const handleInstallClick = async () => {
        // Intentar usar tanto el estado local como el global por redundancia
        const promptToUse = deferredPrompt || window.deferredPWA;

        if (!promptToUse) {
            // Si no hay prompt (ej. Chrome en algunos casos), informamos al usuario
            alert('Por favor, usa el menú de tu navegador y selecciona "Instalar Aplicación" o "Añadir a pantalla de inicio".');
            return;
        }
        promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === 'accepted') {
            await runInstallationSequence();
            setDeferredPrompt(null);
            window.deferredPWA = null;
        }
    };

    // SI ESTÁ EN MODO STANDALONE O SE HA CERRADO, NO MOSTRAR NADA
    if (isStandalone || isDismissed) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-white overflow-hidden font-display">
            {/* Fondo decorativo difuminado */}
            <div className="absolute inset-0 z-0 opacity-10">
                <img src="/BannerLogin.png" alt="Background" className="w-full h-full object-cover" />
            </div>

            <div className="relative z-10 max-w-[400px] w-full bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 flex flex-col items-center text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-white/50">
                
                {/* Logo KPoint Corporativo */}
                <div className="bg-white p-4 rounded-[2.5rem] shadow-2xl mb-8 border border-slate-100 flex flex-col items-center gap-1 scale-110">
                    <img src="/Logo KPoint Solo K (sin Fondo).png" alt="Logo" className="size-12 object-contain" />
                    <h1 className="text-2xl font-black tracking-tighter">
                        <span className="text-[rgb(0,152,235)]">K</span>
                        <span className="text-[#ff6a00]">P</span>
                        <span className="text-black">oint</span>
                    </h1>
                </div>

                {/* Paso: Detectando */}
                {step === 'detecting' && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="size-14 border-4 border-slate-100 border-t-[#ff6a00] rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Optimizando para tu dispositivo...</p>
                    </div>
                )}

                {/* Paso: Invitación (Android/Desktop) */}
                {step === 'ask' && (
                    <div className="animate-slide-bottom-custom w-full">
                        <div className="space-y-3 mb-10">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                                Instalar App Oficial
                            </h4>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed px-2">
                                Para una seguridad máxima y gestión de puntos en tiempo real, debes usar la aplicación instalada.
                            </p>
                        </div>
                        
                        <button 
                            onClick={handleInstallClick}
                            className="w-full h-16 bg-[#ff6a00] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-[#ff6a00]/30 transition-all active:scale-[0.95] flex items-center justify-center gap-3"
                        >
                            Instalar KPoint
                            <span className="material-symbols-outlined text-xl">download</span>
                        </button>

                        <button 
                            onClick={() => setIsDismissed(true)}
                            className="mt-6 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Continuar al Navegador
                        </button>
                    </div>
                )}

                {/* Paso: Barra de Progreso */}
                {step === 'installing' && (
                    <div className="w-full py-6 animate-zoom-in-custom">
                        <div className="mb-8">
                            <p className="text-[#ff6a00] font-black text-[10px] uppercase tracking-[0.2em] mb-4 animate-pulse">
                                {statusText}
                            </p>
                            {/* Barra de Progreso KPoint Orange */}
                            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200">
                                <div 
                                    className="h-full bg-[#ff6a00] rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,106,0,0.4)]"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="mt-4 text-slate-300 font-black text-2xl italic">{progress}%</p>
                        </div>
                    </div>
                )}

                {/* Paso: iOS Instrucciones */}
                {step === 'ios-instructions' && (
                    <div className="animate-slide-bottom-custom w-full text-left">
                        <div className="mb-8 text-center">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mb-2">Instalar en iPhone</h4>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Requisito Obligatorio</p>
                        </div>

                        <div className="space-y-6 mb-10">
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="size-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm font-black text-[#ff6a00]">1</div>
                                <p className="text-slate-600 text-xs font-bold leading-tight">Pulsa el botón de <span className="text-[#ff6a00]">Compartir</span> en la barra de Safari.</p>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="size-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm font-black text-[#ff6a00]">2</div>
                                <p className="text-slate-600 text-xs font-bold leading-tight">Selecciona <span className="text-[#ff6a00]">"Añadir a pantalla de inicio"</span>.</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center mb-4">
                            <p className="text-blue-600 text-[10px] font-black uppercase tracking-wider">Una vez instalada, cierra esta ventana y abre la App.</p>
                        </div>

                        <button 
                            onClick={() => setIsDismissed(true)}
                            className="w-full text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest py-2"
                        >
                            Ver en Navegador
                        </button>
                    </div>
                )}

                {/* Paso: Éxito (Instalado pero sigue en el navegador) */}
                {step === 'success' && (
                    <div className="animate-zoom-in-custom">
                        <div className="size-24 rounded-[2.5rem] bg-green-50 flex items-center justify-center border-4 border-white shadow-xl mb-8 mx-auto">
                            <span className="material-symbols-outlined text-5xl text-green-500 font-black">check_circle</span>
                        </div>
                        <div className="space-y-4 mb-10">
                            <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">¡App Lista!</h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed px-4">
                                La versión de navegador está desactivada por seguridad. 
                                <br/><br/>
                                <span className="text-[#ff6a00]">Abre KPoint desde tu pantalla de inicio para comenzar.</span>
                            </p>
                        </div>
                        
                        <div className="p-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl">
                            Pestaña Protegida
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Corporativo */}
            <div className="absolute bottom-10 flex flex-col items-center gap-4">
                <div className="h-1 w-20 bg-[#ff6a00] rounded-full opacity-20"></div>
                <p className="text-slate-300 text-[9px] font-black uppercase tracking-[0.3em]">
                    KPoint Official Application • 2026
                </p>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
