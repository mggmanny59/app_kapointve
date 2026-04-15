import React, { useEffect, useState } from 'react';
import Icon from './Icon';

/**
 * BackNavigationHandler Component
 * 
 * Handles back button presses on mobile devices and shows a confirmation modal.
 * Also handles tab close/refresh attempts (beforeunload).
 */
const BackNavigationHandler = () => {
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        // 1. Handle browser/tab closing or refreshing
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = ''; // Muestra el diálogo estándar del navegador
        };

        // 2. Handle Hardware Back Button (Mobile)
        // Agregamos un estado extra al historial para poder interceptar el "back"
        window.history.pushState({ noBackExitsApp: true }, '');

        const handlePopState = (e) => {
            // Si el usuario presiona "atrás", el estado cambia
            // Interceptamos y mostramos nuestro modal personalizado
            setShowConfirm(true);
            
            // Volvemos a meter el estado para evitar que el siguiente "atrás" cierre la app de golpe
            window.history.pushState({ noBackExitsApp: true }, '');
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const handleConfirmExit = () => {
        // En la mayoría de navegadores modernos por seguridad no se permite window.close()
        // a menos que la ventana haya sido abierta por un script.
        // Pero en una PWA esto puede comportarse diferente o simplemente dejar que 
        // el usuario navegue a la página anterior real fuera de la app.
        setShowConfirm(false);
        window.history.back(); // Permitimos que el "back" realmente suceda
    };

    if (!showConfirm) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
            {/* Overlay */}
            <div 
                className="absolute inset-0 bg-navy-dark/80 backdrop-blur-sm"
                onClick={() => setShowConfirm(false)}
            />
            
            {/* Modal Card */}
            <div className="relative w-full max-w-sm bg-navy-card border-2 border-[#595A5B] rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                        <Icon name="exit_to_app" className="text-primary !w-12 !h-12 animate-pulse" />
                    </div>
                    
                    <h3 className="text-xl font-black text-white mb-2 leading-tight">
                        ¿Deseas salir de la aplicación?
                    </h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                        Si sales ahora, podrías perder cualquier proceso sin guardar.
                    </p>
                    
                    <div className="flex flex-col w-full gap-3 mt-8">
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="w-full h-14 bg-primary text-navy-dark rounded-2xl text-xs font-black uppercase tracking-[0.2em] active:scale-[0.98] transition-all shadow-[0_8px_20px_-4px_rgba(255,232,0,0.3)] hover:brightness-110"
                        >
                            Continuar en KPoint
                        </button>
                        
                        <button
                            onClick={handleConfirmExit}
                            className="w-full h-14 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
                        >
                            Sí, deseo salir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackNavigationHandler;
