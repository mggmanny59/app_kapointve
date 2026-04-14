import React from 'react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white text-slate-800 font-display flex flex-col">
            {/* Header */}
            <div className="bg-[#ff6a00] p-6 text-white shadow-lg sticky top-0 z-10">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Privacidad de Datos</h1>
                        <p className="text-xs opacity-90 font-bold">Autodeterminación Informativa - Venezuela</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 max-w-2xl mx-auto space-y-8 pb-12">
                <section className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-[-20px] right-[-20px] text-[#ff6a00] opacity-10">
                        <span className="material-symbols-outlined text-[120px]">security</span>
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-sm font-black text-[#ff6a00] uppercase tracking-[0.2em] mb-2">Nuestro Compromiso</h2>
                        <p className="text-sm leading-relaxed text-slate-700 font-medium">
                            En KPoint, tratamos tus datos personales con el respeto que exige la Constitución de la República Bolivariana de Venezuela (Art. 28), garantizando tu derecho a saber qué información manejamos y para qué fines.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-900 border-b pb-2">
                        <span className="material-symbols-outlined font-bold text-[#ff6a00]">database</span>
                        <h3 className="text-md font-black uppercase tracking-tight">Datos Recolectados</h3>
                    </div>
                    <div className="grid gap-4">
                        <div className="flex items-start gap-4">
                            <span className="bg-slate-100 p-2 rounded-xl text-slate-500 material-symbols-outlined">person</span>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 tracking-tight">Identificación</h4>
                                <p className="text-xs text-slate-500">Nombre completo y número telefónico (como identificador único).</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <span className="bg-slate-100 p-2 rounded-xl text-slate-500 material-symbols-outlined">shopping_bag</span>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 tracking-tight">Transaccional</h4>
                                <p className="text-xs text-slate-500">Puntos acumulados, comercios visitados y premios canjeados.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-900 border-b pb-2">
                        <span className="material-symbols-outlined font-bold text-[#ff6a00]">hub</span>
                        <h3 className="text-md font-black uppercase tracking-tight">Uso de la Información</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                        Tus datos solo son visibles para ti y para los comercios donde te has registrado como cliente. **Nunca vendemos tus datos a terceros.** La información se procesa con el único fin de gestionar tus puntos y enviarte promociones legítimas de tus negocios favoritos.
                    </p>
                </section>
                <section className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-900 border-b pb-2">
                        <span className="material-symbols-outlined font-bold text-[#ff6a00]">settings_accessibility</span>
                        <h3 className="text-md font-black uppercase tracking-tight">Tus Derechos ARCO</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                        Tienes derecho al **Acceso, Rectificación, Cancelación y Oposición** de tus datos. Si deseas cerrar tu cuenta y eliminar permanentemente tu historial de puntos de todos los comercios, puedes hacerlo desde la configuración de tu perfil.
                    </p>
                </section>

                <section className="bg-red-50 p-6 rounded-[32px] border border-red-100 relative overflow-hidden">
                    <div className="absolute top-[-20px] right-[-20px] text-red-600 opacity-10">
                        <span className="material-symbols-outlined text-[120px]">policy</span>
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-sm font-black text-red-600 uppercase tracking-[0.2em] mb-2">Ley Contra Delitos Informáticos</h2>
                        <p className="text-xs leading-relaxed text-red-900 font-medium italic">
                            Cualquier intento de manipulación de saldos, alteración del código de la PWA o acceso no autorizado a bases de datos será denunciado ante el Cuerpo de Investigaciones Científicas, Penales y Criminalísticas (CICPC) bajo el amparo de la Ley Especial contra los Delitos Informáticos vigente en Venezuela.
                        </p>
                    </div>
                </section>

                <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="bg-[#ff6a00] text-white font-black px-12 py-3 rounded-2xl shadow-lg shadow-[#ff6a00]/30 hover:scale-[1.02] transition-transform active:scale-95"
                    >
                        ENTENDIDO
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        KPOINT LOYALTY - PROTECCIÓN CIUDADANA
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
