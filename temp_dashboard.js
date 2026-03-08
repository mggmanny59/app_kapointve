import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import Navigation from '../components/Navigation';

const KPIDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [kpiData, setKpiData] = useState({
        aov: 0,
        totalSalesVolume: 0,
        totalTxCount: 0,
        averageRecencyDays: 0,
        top10SharePercentage: 0,
        top10Data: [],
        retentionData: [],
        totalClients: 0
    });

    const PIE_COLORS = ['#F59E0B', '#22C55E']; // Warning (Nuevos) and Primary (Fieles)

    useEffect(() => {
        const fetchKPIData = async () => {
            if (!user) return;
            try {
                setLoading(true);

                // 1. Encontrar a qu├® negocio est├í atado el usuario logueado
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('business_members!inner(business_id)')
                    .eq('id', user.id)
                    .single();

                const bizId = profile?.business_members[0]?.business_id;
                if (!bizId) return;

                // 2. Traer transacciones de acumulaci├│n (Ventas)
                const { data: allEarnTx } = await supabase
                    .from('transactions')
                    .select('amount_fiat, profile_id, created_at')
                    .eq('business_id', bizId)
                    .eq('type', 'EARN')
                    .order('created_at', { ascending: true }); // Important for recency

                let aov = 0;
                let totalVolume = 0;
                let txCount = 0;

                let avgRecency = 0;
                let top10Share = 0;
                let top10Chart = [];
                let retentionChart = [];

                if (allEarnTx && allEarnTx.length > 0) {
                    txCount = allEarnTx.length;
                    totalVolume = allEarnTx.reduce((sum, tx) => sum + (Number(tx.amount_fiat) || 0), 0);
                    aov = totalVolume / txCount;

                    // Build user map
                    const clientMap = {};
                    allEarnTx.forEach(tx => {
                        if (!tx.profile_id) return;
                        if (!clientMap[tx.profile_id]) {
                            clientMap[tx.profile_id] = { txDates: [], totalSpent: 0 };
                        }
                        clientMap[tx.profile_id].txDates.push(new Date(tx.created_at));
                        clientMap[tx.profile_id].totalSpent += (Number(tx.amount_fiat) || 0);
                    });

                    const users = Object.values(clientMap);
                    const totalUsersCount = users.length;

                    // CALC: Recencia Promedio (D├¡as)
                    let totalDiffDays = 0;
                    let diffCount = 0;

                    users.forEach(u => {
                        if (u.txDates.length > 1) {
                            for (let i = 1; i < u.txDates.length; i++) {
                                const diffTime = Math.abs(u.txDates[i] - u.txDates[i - 1]);
                                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                totalDiffDays += diffDays;
                                diffCount++;
                            }
                        }
                    });

                    avgRecency = diffCount > 0 ? (totalDiffDays / diffCount) : 0;

                    // CALC: Top 10% Clientes
                    users.sort((a, b) => b.totalSpent - a.totalSpent);
                    const top10Count = Math.max(1, Math.ceil(totalUsersCount * 0.1));

                    const top10Users = users.slice(0, top10Count);
                    const otherUsers = users.slice(top10Count);

                    const top10Spend = top10Users.reduce((sum, u) => sum + u.totalSpent, 0);
                    const otherSpend = otherUsers.reduce((sum, u) => sum + u.totalSpent, 0);

                    top10Share = totalVolume > 0 ? (top10Spend / totalVolume) * 100 : 0;

                    top10Chart = [
                        { name: 'Top 10% VIP', revenue: top10Spend, fill: '#22C55E' },
                        { name: 'Resto 90%', revenue: otherSpend, fill: '#94A3B8' }
                    ];

                    // CALC: Tasa Nuevos vs Recurrentes
                    const recurrentes = users.filter(u => u.txDates.length > 1).length;
                    const nuevos = users.filter(u => u.txDates.length === 1).length;

                    retentionChart = [
                        { name: 'Casuales (1 compra)', value: nuevos },
                        { name: 'Fieles (>1 compras)', value: recurrentes }
                    ];
                }

                setKpiData({
                    aov,
                    totalSalesVolume: totalVolume,
                    totalTxCount: txCount,
                    averageRecencyDays: avgRecency,
                    top10SharePercentage: top10Share,
                    top10Data: top10Chart,
                    retentionData: retentionChart,
                    totalClients: totalUsersCount
                });

            } catch (err) {
                console.error('Error fetching KPI data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchKPIData();
    }, [user]);

    // Custom Tooltip for Recharts
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-navy-dark text-white p-3 rounded-xl border border-[#334155] shadow-lg text-xs font-black tracking-wide">
                    <p className="opacity-70 mb-1">{payload[0].name}</p>
                    <p className="text-base text-primary">${Number(payload[0].value).toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#F0F2F5] font-display text-slate-900 antialiased pb-24">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-2xl font-black">insights</span>
                            <h1 className="text-2xl font-black tracking-tight leading-none text-slate-900">Panel KPI</h1>
                        </div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Indicadores e Inteligencia</p>
                    </div>
                </div>
            </header>

            <main className="px-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500">

                {/* Resumen Global Info Card */}
                <div className="bg-primary text-white p-6 rounded-[2.5rem] shadow-lg border-2 border-[#595A5B] relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 bg-white/20 size-40 rounded-full blur-3xl"></div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-4 text-white/80">Resumen Anal├¡tico</p>
                    <div className="flex justify-between items-end relative z-10">
                        <div>
                            <p className="text-4xl font-black drop-shadow-sm">${kpiData.totalSalesVolume.toFixed(2)}</p>
                            <p className="text-xs text-white font-bold tracking-wide mt-1 drop-shadow-sm">Volumen Acumulado</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black tracking-tight text-white/95">{kpiData.totalTxCount}</p>
                            <p className="text-[9px] text-white/80 font-black uppercase tracking-widest mt-1">Transacciones</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 mt-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
                            <p className="text-sm font-bold text-slate-500">Procesando Inteligencia de Negocios...</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI 1: Ticket Promedio AOV */}
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                                <div className="absolute -right-2 -top-2 bg-primary/5 size-20 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
                                <div className="flex items-center justify-between mb-2 z-10 relative">
                                    <div className="size-12 rounded-[1rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                        <span className="material-symbols-outlined !text-2xl font-black">receipt_long</span>
                                    </div>
                                    <span className="text-[10px] border-2 border-primary/20 bg-primary/10 text-primary px-3 py-1 rounded-full font-black tracking-widest uppercase">AOV</span>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] mb-1">Ticket Promedio</p>
                                    <p className="text-4xl font-black text-slate-900 tracking-tight">${kpiData.aov.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* KPI: Total Clientes (NUEVO) */}
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                                <div className="absolute -right-2 -top-2 bg-amber-500/5 size-20 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all"></div>
                                <div className="flex items-center justify-between mb-2 z-10 relative">
                                    <div className="size-12 rounded-[1rem] bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
                                        <span className="material-symbols-outlined !text-2xl font-black">groups</span>
                                    </div>
                                    <span className="text-[10px] border-2 border-amber-500/20 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full font-black tracking-widest uppercase">Base</span>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] mb-1">Clientes Totales</p>
                                    <p className="text-4xl font-black text-slate-900 tracking-tight">{kpiData.totalClients}</p>
                                </div>
                            </div>

                            {/* KPI 2: Recencia Promedio */}
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2 z-10 relative">
                                    <div className="size-12 rounded-[1rem] bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                                        <span className="material-symbols-outlined !text-2xl font-black">history_toggle_off</span>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] mb-1">Recencia Promedio</p>
                                    <p className="text-4xl font-black text-slate-900 tracking-tight">{kpiData.averageRecencyDays.toFixed(1)} <span className="text-lg text-slate-400">d├¡as</span></p>
                                    <div className="mt-4 pt-4 border-t-2 border-slate-100">
                                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed flex items-start gap-2">
                                            <span className="material-symbols-outlined !text-[16px] text-blue-500">info</span>
                                            <span>
                                                "Tus clientes suelen volver cada {kpiData.averageRecencyDays.toFixed(0)} d├¡as".
                                                <br /><span className="text-slate-400">Alerta de Antigravity: Si vemos que este n├║mero sube a {(kpiData.averageRecencyDays + 5).toFixed(0)} d├¡as, lanzaremos una promoci├│n para reactivarlos.</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI 3: Top 10% Clientes (Chart) */}
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] mb-1">Ley de Pareto</p>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">Top 10% Clientes</p>
                                        </div>
                                        <div className="size-10 rounded-full bg-[#1E293B] text-white flex items-center justify-center">
                                            <span className="material-symbols-outlined !text-xl">diamond</span>
                                        </div>
                                    </div>

                                    <div className="h-48 w-full mt-6">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={kpiData.top10Data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} domain={[0, 'auto']} />
                                                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                                                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="mt-4 pt-4 border-t-2 border-slate-100">
                                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed flex items-start gap-2">
                                            <span className="material-symbols-outlined !text-[16px] text-primary">campaign</span>
                                            <span>
                                                "Tus 10% mejores clientes generan el <span className="font-black text-primary">{kpiData.top10SharePercentage.toFixed(1)}%</span> de tus ingresos".
                                                <br /><span className="text-slate-400">Pronto habilitaremos el nodo 'Agradecimiento VIP'.</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI 4: Tasa de Nuevos vs Fieles (Pie) */}
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] mb-1">Adquisici├│n vs Lealtad</p>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">Composici├│n de Clientes</p>
                                        </div>
                                    </div>

                                    <div className="h-56 w-full mt-2 relative flex items-center justify-center">
                                        {kpiData.retentionData.reduce((sum, i) => sum + i.value, 0) > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={kpiData.retentionData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {kpiData.retentionData.map((entry, index) => (
                                                            <Cell key={`cell - ${index} `} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: 'white', fontWeight: '900', fontSize: '11px' }}
                                                        itemStyle={{ color: 'white' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '900', color: '#64748B', marginTop: '10px' }} iconType="circle" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-400">No hay suficientes datos.</p>
                                        )}
                                        {/* Texto Central */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[-20px]">
                                            <div className="text-center">
                                                <span className="text-2xl font-black text-slate-800">{kpiData.retentionData.reduce((sum, item) => sum + item.value, 0)}</span>
                                                <br />
                                                <span className="text-[9px] uppercase tracking-widest font-black text-slate-400">Total</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 pt-4 border-t-2 border-slate-100">
                                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed flex items-start gap-2">
                                            <span className="material-symbols-outlined !text-[16px] text-[#F59E0B]">psychology_alt</span>
                                            <span>
                                                "┬┐Vives de gente nueva o de gente fiel?"
                                                <br /><span className="text-slate-400">Esto te ayudar├í a evaluar tus campa├▒as de captaci├│n.</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
            <Navigation />
        </div>
    );
};

export default KPIDashboard;
