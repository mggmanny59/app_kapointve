import React, { useEffect, useState } from 'react';

const SplashScreen = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        // Duración de la Splash Screen (2.5 segundos)
        const timer = setTimeout(() => {
            setOpacity(0);
            
            // Tiempo extra para la transición de desvanecimiento
            const fadeTimer = setTimeout(() => {
                setIsVisible(false);
                if (onComplete) onComplete();
            }, 600);

            return () => clearTimeout(fadeTimer);
        }, 2200);

        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!isVisible) return null;

    return (
        <div 
            style={{ 
                opacity: opacity,
                transition: 'opacity 0.6s ease-in-out',
                backgroundColor: '#ffffff'
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
        >
            <div className="relative w-full h-full flex items-center justify-center">
                {/* Imagen de Splash */}
                <img 
                    src="/Splash_Screen.png" 
                    alt="KPoint Splash" 
                    className="w-full h-full object-cover animate-in fade-in zoom-in duration-700"
                />
                
                {/* Overlay sutil para suavizar */}
                <div className="absolute inset-0 bg-black/5"></div>

                {/* Spinner Minimalista opcional si deseas indicar carga */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                    <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Cargando Experiencia</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
