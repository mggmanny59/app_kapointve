import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';

const BusinessSettings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [loading, setLoading] = useState(true);
    const [business, setBusiness] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchBusiness = async () => {
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('owner_id', user.id)
                    .single();

                if (error) throw error;
                setBusiness(data);
            } catch (err) {
                console.error('Error fetching business:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchBusiness();
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    name: business.name,
                    rif: business.rif,
                    address: business.address,
                    legal_representative: business.legal_representative,
                    phone: business.phone,
                    city: business.city,
                    points_per_dollar: business.points_per_dollar
                })
                .eq('id', business.id);

            if (error) throw error;
            showNotification('success', '¡Ajustes Guardados!', 'La configuración de tu negocio se ha actualizado correctamente.');

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (err) {
            console.error('Error saving settings:', err);
            showNotification('error', 'Error al guardar', err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-navy-dark flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-primary animate-spin !text-5xl mb-4">sync</span>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Cargando Configuración...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-navy-dark text-white pb-24">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-navy-dark/90 backdrop-blur-xl z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary !text-3xl">storefront</span>
                            Ajustes del Negocio
                        </h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Identidad y Reglas</p>
                    </div>
                </div>
            </header>

            <main className="px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleSave} className="space-y-6">

                    <div className="bg-navy-card/40 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="material-symbols-outlined text-accent !text-xl">info</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identidad del Negocio</span>
                        </div>

                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">branding_watermark</span>
                                <input
                                    type="text"
                                    required
                                    value={business?.name || ''}
                                    onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                                    className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-800"
                                    placeholder="Nombre de tu negocio"
                                />
                            </div>
                        </div>

                        {/* Legal Rep Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Representante Legal</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">person</span>
                                <input
                                    type="text"
                                    required
                                    value={business?.legal_representative || ''}
                                    onChange={(e) => setBusiness({ ...business, legal_representative: e.target.value })}
                                    className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-800"
                                    placeholder="Nombre del dueño o representante"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* RIF Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RIF / Registro</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">badge</span>
                                    <input
                                        type="text"
                                        required
                                        value={business?.rif || ''}
                                        onChange={(e) => setBusiness({ ...business, rif: e.target.value })}
                                        className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-800"
                                        placeholder="J-12345678-9"
                                    />
                                </div>
                            </div>

                            {/* City Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ciudad</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">location_city</span>
                                    <input
                                        type="text"
                                        required
                                        value={business?.city || ''}
                                        onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                                        className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-800"
                                        placeholder="Ej. Caracas"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Teléfono</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">call</span>
                                <input
                                    type="tel"
                                    required
                                    value={business?.phone || ''}
                                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                                    className="w-full bg-navy-dark border border-white/5 h-14 rounded-2xl pl-12 pr-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-800"
                                    placeholder="+58 412 0000000"
                                />
                            </div>
                        </div>

                        {/* Address Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección Física</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-6 material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors">location_on</span>
                                <textarea
                                    required
                                    value={business?.address || ''}
                                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                                    className="w-full bg-navy-dark border border-white/5 min-h-[80px] rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium placeholder:text-slate-800 resize-none"
                                    placeholder="Ubicación detallada"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-navy-card/40 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="material-symbols-outlined text-accent !text-xl">group</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Equipo de Trabajo</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-white">Gestionar Empleados</p>
                                <p className="text-[10px] text-slate-500 font-medium">Crea perfiles y configura permisos específicos para tu personal.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/settings/staff')}
                                className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary border border-white/5 active:scale-95 transition-transform"
                            >
                                <span className="material-symbols-outlined">badge</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-navy-card/40 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="material-symbols-outlined text-accent !text-xl">settings_account_box</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Reglas del Juego</span>
                        </div>

                        {/* Points Config */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Puntos por Dólar ($1.00 = pts)</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-accent group-focus-within:scale-110 transition-all font-bold">stars</span>
                                <input
                                    type="number"
                                    required
                                    value={business?.points_per_dollar || 10}
                                    onChange={(e) => setBusiness({ ...business, points_per_dollar: parseInt(e.target.value) })}
                                    className="w-full bg-navy-dark border border-white/5 h-20 rounded-[2rem] pl-14 pr-4 text-4xl font-black text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-800"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">Puntos por $1</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-bold ml-1 italic">* Esta regla afecta a todos tus premios calculados.</p>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-primary text-navy-dark h-16 rounded-[2rem] font-black text-sm uppercase shadow-[0_10px_30px_rgba(57,224,121,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">sync</span>
                                Actualizando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">save</span>
                                GUARDAR CAMBIOS
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors"
                    >
                        Volver al Panel
                    </button>
                </form>
            </main>

            {/* Navigation (Sticky Bottom) */}
            <Navigation />
        </div>
    );
};

export default BusinessSettings;
