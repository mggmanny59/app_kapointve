import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PrizeCalculator = ({ onClose, onApply }) => {
    const { user } = useAuth();
    const [cost, setCost] = useState('');
    const [retention, setRetention] = useState(10); // 10% default
    const [visits, setVisits] = useState(5);
    const [showHelp, setShowHelp] = useState(false);
    const [points, setPoints] = useState(0);
    const [minTicket, setMinTicket] = useState(0);
    const [totalSpendNeeded, setTotalSpendNeeded] = useState(0);
    const [pointsPerDollar, setPointsPerDollar] = useState(10); // Default fallback
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    useEffect(() => {
        const fetchBusinessConfig = async () => {
            try {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('business_members(businesses(points_per_dollar))')
                    .eq('id', user.id)
                    .single();

                const configValue = profileData?.business_members?.[0]?.businesses?.points_per_dollar;
                if (configValue) {
                    setPointsPerDollar(parseFloat(configValue));
                }
            } catch (err) {
                console.error('Error fetching points config:', err);
            } finally {
                setIsLoadingConfig(false);
            }
        };

        if (user) fetchBusinessConfig();
    }, [user]);

    const calculate = () => {
        const costValue = parseFloat(cost) || 0;
        const retentionFactor = (parseFloat(retention) || 0) / 100;

        // 1. Calculate TOTAL EXPENDITURE needed to cover the cost
        // Formula: Expenditure * Retention% = Cost  =>  Expenditure = Cost / Retention%
        const neededSpend = retentionFactor > 0
            ? costValue / retentionFactor
            : 0;

        // 2. Derive Minimum Ticket and Suggested Points
        const ticket = visits > 0 ? neededSpend / visits : 0;

        // Suggested Points strictly following the business rule: $1 = pointsPerDollar
        // We round the neededSpend to the nearest dollar since points are earned per $1
        const rawPoints = Math.round(neededSpend) * pointsPerDollar;

        setTotalSpendNeeded(neededSpend);
        setMinTicket(ticket);
        setPoints(rawPoints);
    };

    useEffect(() => {
        calculate();
    }, [cost, visits, retention, pointsPerDollar]);

    const handleApply = () => {
        if (points > 0) {
            onApply(points);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy-dark/80 backdrop-blur-sm">
            <div className="bg-navy-card w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-navy-dark/50 p-6 flex justify-between items-center border-b border-white/5 relative">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent shadow-[0_0_15px_rgba(255,193,7,0.2)]">
                            <span className="material-symbols-outlined font-black">calculate</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-none">Calculadora Pro</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">Estrategia de Premios</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowHelp(true)}
                            className="size-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                            title="Ayuda"
                        >
                            <span className="material-symbols-outlined !text-xl">help</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="size-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90"
                        >
                            <span className="material-symbols-outlined !text-xl">close</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 relative">
                    {/* Help Overlay */}
                    {showHelp && (
                        <div className="absolute inset-0 z-20 bg-navy-card animate-in fade-in slide-in-from-top-4 duration-300 p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-accent">lightbulb</span>
                                    Guía de Estrategia
                                </h3>
                                <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                <section className="space-y-2">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Objetivo</h4>
                                    <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                        Nuestra meta es que tus premios sean **auto-sustentables**. La calculadora determina cuántos puntos y visitas se requieren para que el beneficio se costee con una pequeña fracción de tus ventas.
                                    </p>
                                </section>

                                <section className="space-y-2">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Variables Clave</h4>
                                    <ul className="space-y-3">
                                        <li className="flex gap-3">
                                            <span className="text-accent font-black">•</span>
                                            <p className="text-xs text-slate-400"><span className="text-white font-bold">Retención:</span> Es el margen de cada venta que "separas" virtualmente para pagar el premio. (Recomendado: 5% a 15%)</p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="text-accent font-black">•</span>
                                            <p className="text-xs text-slate-400"><span className="text-white font-bold">Puntos Sugeridos:</span> Cantidad total de puntos que el cliente debe acumular para ganar el premio.</p>
                                        </li>
                                    </ul>
                                </section>

                                <section className="bg-navy-dark/50 border border-white/5 rounded-2xl p-4 space-y-3">
                                    <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Ejemplo Práctico</h4>
                                    <div className="space-y-2 text-[11px] text-slate-400 leading-snug">
                                        <p>Si un <span className="text-white font-bold">Premio cuesta $2.00</span> y fijas una <span className="text-white font-bold">Retención del 10%</span>:</p>
                                        <p className="pl-2 border-l-2 border-primary/30">1. El sistema calcula que necesitas un consumo total de <span className="text-primary font-bold">$20.00</span> para cubrir el costo.</p>
                                        <p className="pl-2 border-l-2 border-primary/30">2. Si tu regla es $1 = 10 pts, el premio valdrá <span className="text-primary font-bold">200 pts</span>.</p>
                                        <p className="pl-2 border-l-2 border-primary/30">3. Si fijas <span className="text-white font-bold">4 visitas</span>, el sistema te dirá que el ticket de cada visita debe promediar <span className="text-white font-bold">$5.00</span>.</p>
                                    </div>
                                </section>
                            </div>

                            <button
                                onClick={() => setShowHelp(false)}
                                className="w-full bg-primary text-navy-dark font-black py-4 rounded-2xl mt-6 uppercase text-xs tracking-widest shadow-lg shadow-primary/20"
                            >
                                Entendido
                            </button>
                        </div>
                    )}
                    {/* Primary Driver: Reward Cost */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Costo de Reposición (Egresos)
                        </label>
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-primary group-focus-within:scale-110 transition-transform">$</span>
                            <input
                                type="number"
                                autoFocus
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-navy-dark border border-white/10 h-20 rounded-[2rem] text-4xl font-black text-white pl-14 pr-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Retention Input */}
                        <div className="bg-navy-dark/40 p-4 rounded-2xl border border-white/5 space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">
                                % Retención
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={retention}
                                    onChange={(e) => setRetention(e.target.value)}
                                    className="w-full bg-navy-dark border border-white/10 h-14 rounded-xl px-4 text-primary font-black outline-none focus:border-primary/50 transition-all text-center text-lg"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-xs">%</span>
                            </div>
                        </div>

                        {/* Visits Input */}
                        <div className="bg-navy-dark/40 p-4 rounded-2xl border border-white/5 space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">
                                Visitas
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={visits}
                                    onChange={(e) => setVisits(e.target.value)}
                                    className="w-full bg-navy-dark border border-white/10 h-14 rounded-xl px-4 text-white font-black outline-none focus:border-white/20 transition-all text-center text-lg"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20 !text-sm">groups</span>
                            </div>
                        </div>
                    </div>

                    {/* SUGGESTION CARD */}
                    <div className="bg-navy-dark border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden">
                        <div className="flex flex-col items-center text-center">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Puntos Sugeridos</p>
                            <div className="text-5xl font-black text-white mb-1">
                                {points.toLocaleString()}
                                <span className="text-lg text-slate-600 ml-2">PTS</span>
                            </div>

                            <div className="flex items-center gap-2 mt-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                <span className="material-symbols-outlined !text-xs text-primary">info</span>
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                    Basado en: $1 = {pointsPerDollar} pts
                                </span>
                            </div>

                            <div className="h-px w-20 bg-white/10 my-4"></div>

                            <div className="grid grid-cols-2 w-full gap-4">
                                <div className="text-left">
                                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Gasto Total Necesario</p>
                                    <p className="text-sm font-black text-white">${totalSpendNeeded.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Ticket por Visita</p>
                                    <p className="text-sm font-black text-white">${minTicket.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl border border-white/10 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={isLoadingConfig || !cost || points <= 0}
                            className="flex-1 py-4 rounded-2xl bg-primary text-navy-dark font-black text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-all shadow-[0_10px_30px_rgba(57,224,121,0.2)] disabled:opacity-20"
                        >
                            {isLoadingConfig ? 'Cargando...' : 'Aplicar Puntos'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrizeCalculator;
