import React from 'react';
import Notification from '../components/Notification';

const NotificationPreview = () => {
    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center relative overflow-hidden antialiased">
            {/* Background Accent */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none"></div>

            <div className="text-center space-y-10 z-10 px-6">
                <div className="inline-flex items-center justify-center size-24 rounded-[2.5rem] bg-white border-2 border-[#595A5B] shadow-xl shadow-primary/10 mb-2">
                    <span className="material-symbols-outlined text-primary !text-5xl font-black">notifications_active</span>
                </div>

                <div className="space-y-4">
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">Sistema de<br /><span className="text-primary">Notificaciones</span></h1>
                    <p className="text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">Este es el aspecto premium de las nuevas notificaciones del sistema bajo el estándar KPoint Light.</p>
                </div>

                {/* Mockup Button (Non-functional) */}
                <button className="h-16 px-12 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-95">
                    Probar Interfaz
                </button>
            </div>

            {/* Notification Demonstration */}
            <Notification
                type="success"
                title="Sincronización Exitosa"
                message="Tu nuevo premio ha sido registrado correctamente en el catálogo del comercio."
                onClose={() => { }}
                duration={0} // Keep visible for screenshot
            />
        </div>
    );
};

export default NotificationPreview;
