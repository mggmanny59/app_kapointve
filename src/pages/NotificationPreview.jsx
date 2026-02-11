import React from 'react';
import Notification from '../components/Notification';

const NotificationPreview = () => {
    return (
        <div className="min-h-screen bg-navy-dark flex items-center justify-center relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-navy-dark to-accent/5 pointer-events-none"></div>

            <div className="text-center space-y-8 z-10">
                <h1 className="text-4xl font-black text-white">Vista Previa de Notificación</h1>
                <p className="text-slate-400">Este es el aspecto de las nuevas notificaciones del sistema.</p>

                {/* Mockup Button (Non-functional) */}
                <button className="px-8 py-4 bg-primary text-navy-dark rounded-xl font-black uppercase text-sm shadow-lg hover:bg-primary/90 transition-all active:scale-95">
                    Probar Acción
                </button>
            </div>

            {/* Notification Demonstration */}
            <Notification
                type="success"
                title="Operación Exitosa"
                message="Tu nuevo premio ha sido registrado correctamente en el catálogo."
                onClose={() => { }}
                duration={0} // Keep visible for screenshot
            />
        </div>
    );
};

export default NotificationPreview;
