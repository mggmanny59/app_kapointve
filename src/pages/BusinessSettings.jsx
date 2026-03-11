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
    const [uploading, setUploading] = useState(false);

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

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${business.id}-${Math.random()}.${fileExt}`;
            const filePath = `logos/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('business-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('business-assets')
                .getPublicUrl(filePath);

            setBusiness({ ...business, logo_url: publicUrl });
            showNotification('success', 'Logo cargado', 'Haz click en guardar para aplicar los cambios.');

        } catch (err) {
            console.error('Error uploading logo:', err);
            showNotification('error', 'Error al subir logo', err.message);
        } finally {
            setUploading(false);
        }
    };

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
                    points_per_dollar: business.points_per_dollar,
                    logo_url: business.logo_url,
                    registration_data: true // Set to true since all fields are required for submission
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
            <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-primary animate-spin !text-5xl mb-4">sync</span>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Cargando Configuración...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-[#f8fafc]/80 backdrop-blur-xl z-50 border-b border-[#595A5B]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="size-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 active:scale-95 transition-transform shadow-sm"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary !text-3xl font-black">storefront</span>
                            Ajustes del Negocio
                        </h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Identidad y Reglas</p>
                    </div>
                </div>
            </header>

            <main className="px-6 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-6">
                <form onSubmit={handleSave} className="space-y-4">

                    <div className="space-y-4 px-1">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                            <span className="material-symbols-outlined text-primary !text-xl font-black">info</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identidad del Negocio</span>
                        </div>

                        {/* Logo Upload */}
                        <div className="flex flex-col items-center mb-4">
                            <div className="relative group w-full flex justify-center">
                                <div className="size-56 rounded-[1.5rem] bg-white border-2 border-dashed border-[#595A5B] overflow-hidden flex items-center justify-center group-hover:border-primary transition-all relative">
                                    {business?.logo_url ? (
                                        <img src={business.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-4">
                                            <span className="material-symbols-outlined text-slate-300 text-6xl">add_a_photo</span>
                                        </div>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-20">
                                            <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
                                        </div>
                                    )}
                                </div>
                                <label className="absolute bottom-2 translate-x-28 size-14 rounded-2xl bg-white border-2 border-[#595A5B] shadow-xl flex items-center justify-center cursor-pointer hover:bg-slate-50 active:scale-90 transition-all z-30">
                                    <span className="material-symbols-outlined text-primary text-3xl font-black">upload</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                </label>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Logo comercial</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nombre Comercial</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    required
                                    value={business?.name || ''}
                                    onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                    placeholder="Nombre de tu negocio"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Representante Legal</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    required
                                    value={business?.legal_representative || ''}
                                    onChange={(e) => setBusiness({ ...business, legal_representative: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                    placeholder="Nombre del representante"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">RIF / Registro</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        value={business?.rif || ''}
                                        onChange={(e) => setBusiness({ ...business, rif: e.target.value })}
                                        className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300 uppercase"
                                        placeholder="J-12345678-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Ciudad</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        value={business?.city || ''}
                                        onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                                        className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                        placeholder="Caracas"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Número de Teléfono</label>
                            <div className="relative group">
                                <input
                                    type="tel"
                                    required
                                    value={business?.phone || ''}
                                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                    placeholder="+58 412 0000000"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Dirección Física</label>
                            <div className="relative group">
                                <textarea
                                    required
                                    value={business?.address || ''}
                                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] min-h-[100px] rounded-2xl p-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-medium placeholder:text-slate-300 resize-none"
                                    placeholder="Ubicación detallada"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-1">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                            <span className="material-symbols-outlined text-primary !text-xl font-black">group</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Equipo de Trabajo</span>
                        </div>

                        <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm border-dashed">
                            <div className="flex-1">
                                <p className="text-sm font-black text-slate-900 leading-tight">Gestionar Empleados</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configura permisos y turnos</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/settings/staff')}
                                className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                            >
                                <span className="material-symbols-outlined font-black">badge</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 px-1">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                            <span className="material-symbols-outlined text-primary !text-xl font-black">settings_account_box</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Reglas del Juego</span>
                        </div>

                        {/* Points Config */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Puntos por Dólar ($1.00 = pts)</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    required
                                    value={business?.points_per_dollar || 10}
                                    onChange={(e) => setBusiness({ ...business, points_per_dollar: parseInt(e.target.value) })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-24 rounded-[2rem] pl-8 pr-28 text-5xl font-black text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/40 outline-none transition-all placeholder:text-slate-200"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ptos por</p>
                                    <p className="text-lg font-black text-primary leading-none">$1 USD</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1 italic opacity-60">* Afecta automáticamente a todos los cálculos del sistema</p>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-primary text-white h-16 rounded-[2rem] font-black text-sm uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin font-black">sync</span>
                                ACTUALIZANDO...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined font-black">save</span>
                                GUARDAR CAMBIOS
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] hover:text-slate-900 transition-colors"
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
