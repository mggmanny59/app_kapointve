import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PrizeCalculator = ({ onClose, onApply, initialCost }) => {
    const { user } = useAuth();
    const [cost, setCost] = useState(initialCost || '');
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
        const neededSpend = retentionFactor > 0
            ? costValue / retentionFactor
            : 0;

        // 2. Derive Minimum Ticket and Suggested Points
        const ticket = visits > 0 ? neededSpend / visits : 0;

        // Suggested Points strictly following the business rule: $1 = pointsPerDollar
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
            onApply(points, cost);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 antialiased sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

            <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-[#595A5B] max-h-[95vh] flex flex-col">
                {/* Header - More Compact */}
                <div className="p-6 pb-2 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-orange-50 flex items-center justify-center text-primary border-2 border-[#595A5B]">
                            <span className="material-symbols-outlined !text-2xl font-black">calculate</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-0.5">Calc Estratégica</h2>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.15em] flex items-center gap-1.5 leading-none">
                                <span className="size-1 rounded-full bg-primary"></span>
                                Rentabilidad del Premio
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="size-9 rounded-full bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-primary transition-all active:scale-90"
                    >
                        <span className="material-symbols-outlined !text-lg font-black">help</span>
                    </button>
                </div>

                <div className="p-6 pt-2 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Help Overlay (Maintained) */}
                    {showHelp && (
                        <div className="absolute inset-0 z-20 bg-white animate-in slide-in-from-bottom-2 duration-300 p-8 flex flex-col">
                            <header className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Guía de Cálculo</h3>
                                <button onClick={() => setShowHelp(false)} className="size-9 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined !text-2xl font-black">close</span>
                                </button>
                            </header>
                            <div className="flex-1 space-y-4">
                                <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                    Define el costo en puntos basado en la rentabilidad deseada.
                                </p>
                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl bg-slate-50 border-2 border-[#595A5B]">
                                        <p className="font-black text-slate-900 text-[11px] mb-0.5">% Retención:</p>
                                        <p className="text-[10px] text-slate-600 font-semibold">Inversión por cada venta destinada al programa.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 border-2 border-[#595A5B]">
                                        <p className="font-black text-slate-900 text-[11px] mb-0.5">Visitas Promedio:</p>
                                        <p className="text-[10px] text-slate-600 font-semibold">Veces que el cliente debe volver.</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="w-full h-14 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Entendido</button>
                        </div>
                    )}

                    {/* Inputs Area - Compacted */}
                    <div className="space-y-6">
                        {/* Cost Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Costo de Producción (USD)</label>
                            <div className="flex items-center gap-3 border-b-2 border-[#595A5B] focus-within:border-primary/40 transition-colors pb-2">
                                <span className="text-2xl font-black text-primary">$</span>
                                <input
                                    type="number"
                                    autoFocus
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-transparent text-4xl font-black text-slate-900 outline-none placeholder:text-slate-100 tabular-nums"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">% Retención</label>
                                <div className="flex items-center gap-1.5 border-b-2 border-[#595A5B] focus-within:border-primary/40 transition-colors pb-1">
                                    <input
                                        type="number"
                                        value={retention}
                                        onChange={(e) => setRetention(e.target.value)}
                                        className="w-full bg-transparent text-2xl font-black text-primary outline-none tabular-nums"
                                    />
                                    <span className="text-primary/30 font-black text-lg">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Visitas Prom.</label>
                                <div className="flex items-center justify-between border-b-2 border-[#595A5B] pb-1">
                                    <button
                                        onClick={() => setVisits(prev => Math.max(1, prev - 1))}
                                        className="size-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-all active:scale-90"
                                    >
                                        <span className="material-symbols-outlined !text-lg font-black">remove</span>
                                    </button>
                                    <span className="text-2xl font-black text-slate-900 tabular-nums">{visits}</span>
                                    <button
                                        onClick={() => setVisits(prev => prev + 1)}
                                        className="size-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-primary transition-all active:scale-90"
                                    >
                                        <span className="material-symbols-outlined !text-lg font-black text-primary">add</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Result Area - Compacted */}
                    <div className="pt-4 border-t-2 border-[#595A5B] flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">CANJE SUGERIDO</p>

                        <div className="flex flex-col items-center gap-1 mb-6">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                    {points.toLocaleString()}
                                </span>
                                <span className="text-xl font-black text-primary tracking-wider">PTS</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border-2 border-[#595A5B] mt-2">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                    Regla: $1 = {pointsPerDollar} pts
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 w-full gap-4 border-y-2 border-[#595A5B] py-4">
                            <div className="text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Consumo Total</p>
                                <p className="text-lg font-black text-slate-900">${totalSpendNeeded.toFixed(2)}</p>
                            </div>
                            <div className="text-center border-l-2 border-[#595A5B]">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ticket Prom.</p>
                                <p className="text-lg font-black text-slate-900">${minTicket.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions - Compacted */}
                    <div className="flex flex-col gap-4 pt-2 shrink-0">
                        <button
                            onClick={handleApply}
                            disabled={isLoadingConfig || !cost || points <= 0}
                            className="w-full h-16 rounded-[1.25rem] bg-primary text-white font-black text-base uppercase tracking-wider shadow-xl shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100"
                        >
                            {isLoadingConfig ? 'Cargando...' : 'Aplicar Resultado'}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full text-slate-500 font-black text-[10px] uppercase tracking-[0.15em] hover:text-slate-900 transition-colors pb-2"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrizeCalculator;
