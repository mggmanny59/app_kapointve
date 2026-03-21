import React, { useState, useEffect } from 'react';

/**
 * Componente PWAInstallPrompt
 * 
 * Este componente detecta si la aplicación es instalable como PWA y muestra un
 * aviso personalizado invitando al usuario a instalarla en su pantalla de inicio.
 * Sigue la estética del Dashboard de KPoint con bordes redondeados y colores primarios.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // El navegador dispara este evento cuando detecta que la App cumple los requisitos PWA
        const handler = (e) => {
            // Evitamos que el navegador muestre su banner nativo "mini-infobar" inmediatamente
            e.preventDefault();
            
            // Guardamos el evento para dispararlo cuando el usuario haga clic en nuestro botón
            setDeferredPrompt(e);
            
            // Esperamos unos segundos antes de mostrar nuestro aviso personalizado
            // para no interrumpir la carga inicial del usuario
            const timer = setTimeout(() => {
                // Solo mostrar si no ha sido rechazado en esta sesión
                const wasDismissed = sessionStorage.getItem('pwa-prompt-dismissed');
                if (!wasDismissed) {
                    setIsVisible(true);
                }
            }, 3000);
            
            return () => clearTimeout(timer);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Detectar si ya estamos en modo "standalone" (la app ya está abierta como instalada)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.matchMedia('(display-mode: fullscreen)').matches ||
                           window.navigator.standalone === true;

        if (isStandalone) {
            setIsVisible(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Disparamos la ventana de instalación nativa del navegador
        deferredPrompt.prompt();

        // Esperamos la respuesta del usuario
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Respuesta del usuario a la instalación: ${outcome}`);

        // Una vez usado el prompt, ya no sirve para una segunda vez
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Guardamos en sessionStorage para que no vuelva a aparecer en la sesión actual
        sessionStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center p-6 bg-slate-900/20 backdrop-blur-[2px] animate-in fade-in duration-500 pointer-events-none">
            <div className="max-w-[360px] w-full bg-white/95 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.3)] flex flex-col items-center text-center animate-in slide-in-from-bottom-20 zoom-in-95 duration-500 pointer-events-auto mb-4">
                
                {/* Icon Circle con animación */}
                <div className="size-24 rounded-[2.2rem] bg-orange-50 flex items-center justify-center border-4 border-white shadow-inner mb-6 animate-bounce duration-[2000ms]">
                    <img 
                        src="/pwa-192x192.png" 
                        alt="KPoint Logo" 
                        className="size-12 object-contain"
                        onError={(e) => {e.target.src = '/vite.svg'}}
                    />
                </div>

                {/* Texto descriptivo */}
                <div className="space-y-3 mb-8">
                    <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                        ¡Instala KPoint!
                    </h4>
                    <p className="text-sm text-slate-400 font-bold leading-relaxed px-4">
                        Agrégala a tu pantalla de inicio para un acceso más rápido y recibe notificaciones de tus puntos al instante.
                    </p>
                </div>
                
                {/* Botones de acción */}
                <div className="flex flex-col w-full gap-3">
                    <button 
                        onClick={handleInstallClick}
                        className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-100 transition-all active:scale-[0.97] hover:brightness-105"
                    >
                        Instalar Aplicación
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="w-full h-12 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-[0.97] transition-all"
                    >
                        Quizás luego
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
