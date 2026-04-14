import React from 'react';

const SupportSection = ({ userType = 'client' }) => {
    const handleEmailSupport = () => {
        const subject = encodeURIComponent(`Soporte KPoint - ${userType === 'owner' ? 'Comercio' : 'Cliente'}`);
        const body = encodeURIComponent(`Hola equipo de KPoint,\n\nEscribo para solicitar apoyo con respecto a mi cuenta.\n\nTipo de Usuario: ${userType}\n\nDetalles del problema:\n`);
        window.location.href = `mailto:soporte@kpointve.com?subject=${subject}&body=${body}`;
    };

    const handleWhatsAppSupport = () => {
        const text = encodeURIComponent(`Hola KPoint! Soy ${userType === 'owner' ? 'dueño de un negocio' : 'un cliente'} y necesito soporte con la aplicación.`);
        window.open(`https://wa.me/584120000000?text=${text}`, '_blank');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-[#595A5B] shadow-lg relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                <span className="material-symbols-outlined !text-4xl font-black">support_agent</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">¿Necesitas Ayuda?</h3>
                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Estamos aquí para apoyarte</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
                            Si tienes dudas sobre el funcionamiento de la plataforma, problemas con tus puntos o necesitas asistencia técnica, contáctanos por cualquiera de nuestros canales oficiales.
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={handleEmailSupport}
                                className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
                            >
                                <span className="material-symbols-outlined !text-xl">mail</span>
                                Enviar Correo Directo
                            </button>

                            <button
                                onClick={handleWhatsAppSupport}
                                className="w-full h-16 bg-[#25D366] text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-green-100"
                            >
                                <span className="material-symbols-outlined !text-xl">chat</span>
                                Chat por WhatsApp
                            </button>
                        </div>
                    </div>

                    {/* Decorative abstract shape */}
                    <div className="absolute -bottom-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                </div>

                <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <div className="flex items-start gap-4">
                        <div className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined !text-xl">schedule</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario de Atención</p>
                            <p className="text-[11px] text-slate-600 font-bold leading-tight">
                                Lunes a Viernes: 8:00 AM - 6:00 PM<br />
                                Sábados: 9:00 AM - 1:00 PM
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportSection;
