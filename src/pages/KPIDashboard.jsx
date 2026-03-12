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
        let bizId = null;

        const fetchKPIData = async () => {
            if (!user) return;
            try {
                if (loading) setLoading(true); // Solo mostrar loading inicial

                // 1. Encontrar a qué negocio está atado el usuario logueado
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('business_members!inner(business_id)')
                    .eq('id', user.id)
                    .single();

                bizId = profile?.business_members[0]?.business_id;
                if (!bizId) return;

                // 2. Traer transacciones de acumulación (Ventas)
                const { data: allEarnTx } = await supabase
                    .from('transactions')
                    .select('amount_fiat, profile_id, created_at')
                    .eq('business_id', bizId)
                    .eq('type', 'EARN')
                    .order('created_at', { ascending: true });

                // 3. Traer Conteo REAL de Afiliados (loyalty_cards)
                const { count: realClientsCount } = await supabase
                    .from('loyalty_cards')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', bizId);

                let aov = 0;
                let totalVolume = 0;
                let txCount = 0;

                let avgRecency = 0;
                let top10Share = 0;
                let top10Chart = [];
                let retentionChart = [];
                let totalUsersWithTx = 0;

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
                    totalUsersWithTx = users.length;

                    // CALC: Recencia Promedio (Días)
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
                    const top10Count = Math.max(1, Math.ceil(totalUsersWithTx * 0.1));

                    const top10Users = users.slice(0, top10Count);
                    const otherUsers = users.slice(top10Count);

                    const top10Spend = top10Users.reduce((sum, u) => sum + u.totalSpent, 0);
                    const otherSpend = otherUsers.reduce((sum, u) => sum + u.totalSpent, 0);

                    top10Share = totalVolume > 0 ? (top10Spend / totalVolume) * 100 : 0;

                    top10Chart = [
                        { name: 'Top 10% VIP', revenue: top10Spend, fill: '#22C55E' },
                        { name: 'Resto 90%', revenue: otherSpend, fill: '#94A3B8' }
                    ];

                    // CALC: Segmentación de Clientes (Nuevos, Casuales, Fieles)
                    const countNuevos = Math.max(0, realClientsCount - totalUsersWithTx); 
                    const countCasuales = users.filter(u => u.txDates.length >= 1 && u.txDates.length <= 2).length;
                    const countFieles = users.filter(u => u.txDates.length >= 3).length;

                    retentionChart = [
                        { name: 'Nuevos (0 Compras)', value: countNuevos, fill: '#94A3B8' },
                        { name: 'Casuales (1-2 Comp.)', value: countCasuales, fill: '#F59E0B' },
                        { name: 'Fieles (3+ Comp.)', value: countFieles, fill: '#22C55E' }
                    ];
                } else {
                    // Si no hay transacciones, todos son nuevos (0 compras)
                    retentionChart = [
                        { name: 'Nuevos (0 Compras)', value: realClientsCount || 0, fill: '#94A3B8' },
                        { name: 'Casuales (1-2 Comp.)', value: 0, fill: '#F59E0B' },
                        { name: 'Fieles (3+ Comp.)', value: 0, fill: '#22C55E' }
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
                    totalClients: realClientsCount || 0
                });

            } catch (err) {
                console.error('Error fetching KPI data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchKPIData();

        // SUSCRIPCIÓN REALTIME: Escuchar cambios en transacciones y afiliaciones
        const channel = supabase.channel('kpi-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchKPIData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_cards' }, () => fetchKPIData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Custom Tooltip for Recharts
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0F172A] text-white p-3 rounded-xl border border-[#334155] shadow-lg text-xs font-black tracking-wide">
                    <p className="opacity-70 mb-1">{payload[0].name}</p>
                    <p className="text-base text-primary">
                        {typeof payload[0].value === 'number' && payload[0].name.includes('Ticket') 
                            ? `$${payload[0].value.toFixed(2)}` 
                            : payload[0].value}
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom Label for Pie Chart
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 20;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text 
                x={x} 
                y={y} 
                fill="#94A3B8" 
                textAnchor={x > cx ? 'start' : 'end'} 
                dominantBaseline="central"
                className="text-[9px] font-black tracking-tighter"
            >
                {`${value} (${(percent * 100).toFixed(0)}%)`}
            </text>
        );
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#F0F2F5] font-display text-slate-900 antialiased pb-24">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/home')}
                        className="size-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined !text-xl">arrow_back</span>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-2xl font-black">insights</span>
                            <h1 className="text-2xl font-black tracking-tight leading-none text-slate-900">Panel KPI</h1>
                        </div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Inteligencia de Negocio</p>
                    </div>
                </div>
            </header>

            <main className="px-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500">

                {/* Resumen Global Info Card */}
                <div className="bg-[#0F172A] text-white p-7 rounded-[2.5rem] shadow-2xl border-2 border-[#1E293B] relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                         style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                    <div className="absolute -right-10 -top-10 bg-primary/20 size-40 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700"></div>
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Volumen Consolidado</p>
                        <span className="text-[9px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg uppercase tracking-widest flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                            Análisis en Vivo
                        </span>
                    </div>

                    <div className="flex justify-between items-end relative z-10">
                        <div>
                            <p className="text-4xl font-black tracking-tighter">${kpiData.totalSalesVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">Total USD Operados</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black tracking-tighter text-white/95">{kpiData.totalTxCount.toLocaleString()}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Operaciones</p>
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
                            <div className="bg-[#0F172A] p-6 rounded-[2.5rem] border-2 border-[#1E293B] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                     style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                                <div className="flex items-center justify-between mb-4 z-10 relative">
                                    <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                                        <span className="material-symbols-outlined !text-xl font-black">receipt_long</span>
                                    </div>
                                    <span className="text-[9px] border border-primary/20 bg-primary/10 text-primary px-3 py-1 rounded-lg font-black tracking-widest uppercase">AOV</span>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Ticket Promedio</p>
                                    <p className="text-4xl font-black text-white tracking-tighter">${kpiData.aov.toFixed(2)}</p>
                                    <div className="mt-6 pt-4 border-t border-[#1E293B]">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-start gap-3">
                                            <span className="material-symbols-outlined !text-[18px] text-primary">info</span>
                                            <span>
                                                "Monto promedio por visita".
                                                <br /><span className="text-slate-500 uppercase text-[8px] tracking-widest mt-1 block font-black">Tip: Incentiva el Up-selling para subir este valor</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI: Total Clientes (NUEVO) */}
                            <div className="bg-[#0F172A] p-6 rounded-[2.5rem] border-2 border-[#1E293B] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                     style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                                <div className="flex items-center justify-between mb-4 z-10 relative">
                                    <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                                        <span className="material-symbols-outlined !text-xl font-black">groups</span>
                                    </div>
                                    <span className="text-[9px] border border-amber-500/20 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg font-black tracking-widest uppercase">Base</span>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Clientes Totales</p>
                                    <p className="text-4xl font-black text-white tracking-tighter">{kpiData.totalClients}</p>
                                    <div className="mt-6 pt-4 border-t border-[#1E293B]">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-start gap-3">
                                            <span className="material-symbols-outlined !text-[18px] text-amber-500">info</span>
                                            <span>
                                                "Personas en tu programa de lealtad".
                                                <br /><span className="text-slate-500 uppercase text-[8px] tracking-widest mt-1 block font-black">Potencial: Base total para marketing directo</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI 2: Recencia Promedio */}
                            <div className="bg-[#0F172A] p-6 rounded-[2.5rem] border-2 border-[#1E293B] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                     style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                                <div className="flex items-center justify-between mb-4 z-10 relative">
                                    <div className="size-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
                                        <span className="material-symbols-outlined !text-xl font-black">history_toggle_off</span>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Recencia Promedio</p>
                                    <p className="text-4xl font-black text-white tracking-tighter">{kpiData.averageRecencyDays.toFixed(1)} <span className="text-lg text-slate-500">días</span></p>
                                    <div className="mt-6 pt-4 border-t border-[#1E293B]">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-start gap-3">
                                            <span className="material-symbols-outlined !text-[18px] text-blue-500">info</span>
                                            <span>
                                                "Tus clientes suelen volver cada {kpiData.averageRecencyDays.toFixed(0)} días".
                                                <br /><span className="text-slate-500 uppercase text-[8px] tracking-widest mt-1 block font-black">Alerta: Campaña de reactivación a los {(kpiData.averageRecencyDays + 5).toFixed(0)} días</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI 3: Top 10% Clientes (Chart) */}
                            <div className="bg-[#0F172A] p-6 rounded-[2.5rem] border-2 border-[#1E293B] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                     style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] mb-1">Análisis de Pareto</p>
                                            <p className="text-xl font-black text-white tracking-tight">Top 10% Clientes</p>
                                        </div>
                                        <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined !text-xl font-black">diamond</span>
                                        </div>
                                    </div>

                                    <div className="relative h-48 w-full mt-8">
                                        {/* Grid Técnica */}
                                        <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none z-0">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="w-full border-t border-slate-400 border-dashed"></div>
                                            ))}
                                        </div>

                                        <div className="absolute inset-0 z-10">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={kpiData.top10Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#64748B', letterSpacing: '0.05em' }} 
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#64748B' }} 
                                                    />
                                                    <RechartsTooltip 
                                                        content={<CustomTooltip />} 
                                                        cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} 
                                                    />
                                                    <Bar 
                                                        dataKey="revenue" 
                                                        radius={[10, 10, 0, 0]} 
                                                        barSize={45}
                                                        className="drop-shadow-[0_0_8px_rgba(34,197,94,0.1)]"
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-4 border-t border-[#1E293B]">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-start gap-3">
                                            <span className="material-symbols-outlined !text-[18px] text-primary">campaign</span>
                                            <span>
                                                "Tus 10% mejores clientes generan el <span className="font-black text-primary text-xs">{kpiData.top10SharePercentage.toFixed(1)}%</span> de tus ingresos totales".
                                                <br /><span className="text-slate-500 uppercase text-[8px] tracking-widest mt-1 block font-black">Pronto: Nodo de Agradecimiento VIP Automático</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* KPI 4: Tasa de Nuevos vs Fieles (Pie) */}
                            <div className="bg-[#0F172A] p-6 rounded-[2.5rem] border-2 border-[#1E293B] shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                     style={{ backgroundImage: 'radial-gradient(#94a3b8 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] mb-1">Infraestructura de Lealtad</p>
                                            <p className="text-xl font-black text-white tracking-tight">Composición de Cartera</p>
                                        </div>
                                        <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined !text-xl font-black">pie_chart</span>
                                        </div>
                                    </div>

                                    <div className="h-56 w-full mt-4 relative flex items-center justify-center">
                                        {kpiData.retentionData.reduce((sum, i) => sum + i.value, 0) > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                                                    <Pie
                                                        data={kpiData.retentionData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={55}
                                                        outerRadius={75}
                                                        paddingAngle={8}
                                                        dataKey="value"
                                                        stroke="none"
                                                        label={renderCustomizedLabel}
                                                        labelLine={{ stroke: '#334155', strokeWidth: 1 }}
                                                    >
                                                        {kpiData.retentionData.map((entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={entry.fill} 
                                                                className="drop-shadow-[0_0_12px_rgba(0,0,0,0.2)]"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        content={<CustomTooltip />}
                                                    />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        align="center"
                                                        content={({ payload }) => (
                                                            <div className="flex justify-center gap-4 mt-4">
                                                                {payload.map((entry, index) => (
                                                                    <div key={index} className="flex items-center gap-1.5">
                                                                        <div className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{entry.value.split(' ')[0]}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-slate-700 text-4xl">analytics</span>
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sin Datos de Cartera</p>
                                            </div>
                                        )}
                                        {/* Texto Central */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-4">
                                            <div className="text-center">
                                                <span className="text-3xl font-black text-white tracking-tighter">{kpiData.retentionData.reduce((sum, item) => sum + item.value, 0)}</span>
                                                <br />
                                                <span className="text-[8px] uppercase tracking-[0.2em] font-black text-slate-500">Cartera</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-[#1E293B]">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-start gap-3">
                                            <span className="material-symbols-outlined !text-[18px] text-amber-500">psychology_alt</span>
                                            <span>
                                                "Convierte a tus <span className="text-slate-200">Nuevos</span> en <span className="text-amber-500">Casuales</span>, e impúlsalos a ser <span className="text-primary">Fieles</span>."
                                                <br /><span className="text-slate-500 uppercase text-[8px] tracking-widest mt-1 block font-black">Estrategia: Crea promociones de retención dirigidas</span>
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
