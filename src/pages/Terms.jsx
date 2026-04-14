import React from 'react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
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
                        <h1 className="text-xl font-black uppercase tracking-tight">Términos y Condiciones</h1>
                        <p className="text-xs opacity-90 font-bold">KPoint Loyalty - Venezuela</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 max-w-2xl mx-auto space-y-8 pb-12">
                <section className="space-y-3">
                    <div className="flex items-center gap-3 text-[#ff6a00]">
                        <span className="material-symbols-outlined font-bold">handshake</span>
                        <h2 className="text-lg font-black uppercase tracking-tight">Acuerdo de Uso</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                        Al registrarse y utilizar KPoint, el usuario acepta de manera íntegra y sin reservas los presentes términos y condiciones. KPoint es una plataforma de fidelización tecnológica diseñada para facilitar la acumulación de beneficios promocionales entre comercios y clientes.
                    </p>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center gap-3 text-[#ff6a00]">
                        <span className="material-symbols-outlined font-bold">token</span>
                        <h2 className="text-lg font-black uppercase tracking-tight">Naturaleza de los Puntos</h2>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-sm leading-relaxed text-slate-600 italic">
                            "Los puntos KPoint son unidades de redención promocional sin valor monetario de curso legal en la República Bolivariana de Venezuela."
                        </p>
                    </div>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
                        <li>Los puntos no son canjeables por dinero en efectivo.</li>
                        <li>Los puntos no se pueden transferir entre usuarios o distintos comercios.</li>
                        <li>La vigencia de los puntos dependerá de la política de inactividad de cada comercio afiliado.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center gap-3 text-[#ff6a00]">
                        <span className="material-symbols-outlined font-bold">store</span>
                        <h2 className="text-lg font-black uppercase tracking-tight">Responsabilidad del Comercio</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                        KPoint actúa únicamente como la plataforma tecnológica que registra las transacciones. El comercio afiliado es el único responsable de la calidad, existencia y entrega física de los premios ofrecidos en su catálogo de fidelización.
                    </p>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center gap-3 text-[#ff6a00]">
                        <span className="material-symbols-outlined font-bold">gavel</span>
                        <h2 className="text-lg font-black uppercase tracking-tight">Marco Legal</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                        Este programa se rige bajo las leyes venezolanas, incluyendo la Ley de Protección al Consumidor y Usuario. Cualquier conducta fraudulenta, manipulación de software o uso indebido de los códigos de referido resultará en la clausura inmediata de la cuenta y, de ser necesario, el reporte ante las autoridades competentes bajo la Ley Especial contra Delitos Informáticos.
                    </p>
                </section>

                <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="bg-[#ff6a00] text-white font-black px-12 py-3 rounded-2xl shadow-lg shadow-[#ff6a00]/30 hover:scale-[1.02] transition-transform active:scale-95"
                    >
                        ENTENDIDO
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Última actualización: 13 de abril de 2026
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Terms;
