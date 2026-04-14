import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';
import MarketingHub from '../components/MarketingHub';
import SupportSection from '../components/SupportSection';
import StaffSection from '../components/StaffSection';

const BusinessSettings = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [loading, setLoading] = useState(true);
    const [business, setBusiness] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState(null); // null = menu, 'info' | 'promos' | 'marketing' | 'staff' | 'support'
    
    // Promotions states
    const [promoView, setPromoView] = useState('list'); // 'list', 'create', 'edit'
    const [promotions, setPromotions] = useState([]);
    const [promoForm, setPromoForm] = useState({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        image_url: 'Promo_Kpoint.png'
    });
    const [isSavingPromo, setIsSavingPromo] = useState(false);
    const [promoToEdit, setPromoToEdit] = useState(null);

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

    useEffect(() => {
        if (activeTab === 'promos') {
            fetchPromotions();
        }
    }, [activeTab]);

    const fetchPromotions = async () => {
        if (!business) return;
        try {
            const { data, error } = await supabase
                .from('promotions')
                .select('*')
                .eq('business_id', business.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPromotions(data || []);
        } catch (err) {
            console.error('Error fetching promotions:', err);
            showNotification('error', 'Error', 'No se pudieron cargar las promociones.');
        }
    };

    const handlePromoImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${business.id}_promo_${Math.random()}.${fileExt}`;
            const filePath = `promotions/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('business-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('business-assets')
                .getPublicUrl(filePath);

            setPromoForm(prev => ({ ...prev, image_url: publicUrl }));
            showNotification('success', '¡Imagen Cargada!', 'La imagen de la promoción se ha actualizado correctamente.');
        } catch (err) {
            console.error('Error uploading promo image:', err);
            showNotification('error', 'Error', 'No se pudo cargar la imagen.');
        }
    };

    const handleSavePromo = async () => {
        if (!promoForm.title || !promoForm.start_date || !promoForm.end_date) {
            showNotification('warning', 'Campos requeridos', 'Por favor completa el nombre y el rango de fechas.');
            return;
        }

        setIsSavingPromo(true);
        try {
            const promoData = {
                title: promoForm.title,
                description: promoForm.description,
                start_date: promoForm.start_date,
                end_date: promoForm.end_date,
                image_url: promoForm.image_url,
                business_id: business.id,
                is_active: true
            };

            let error;
            if (promoView === 'edit' && promoToEdit) {
                const { error: updateError } = await supabase
                    .from('promotions')
                    .update(promoData)
                    .eq('id', promoToEdit.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('promotions')
                    .insert([promoData]);
                error = insertError;
            }

            if (error) throw error;

            showNotification('success', '¡Éxito!', promoView === 'edit' ? 'Promoción actualizada.' : 'Promoción creada con éxito.');
            setPromoView('list');
            fetchPromotions();
            setPromoForm({ title: '', description: '', start_date: '', end_date: '', image_url: 'Promo_Kpoint.png' });
        } catch (err) {
            console.error('Error saving promo:', err);
            showNotification('error', 'Error', 'No se pudo guardar la promoción.');
        } finally {
            setIsSavingPromo(false);
        }
    };

    const handleDeletePromo = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta promoción?')) return;

        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showNotification('success', '¡Eliminada!', 'La promoción ha sido borrada.');
            fetchPromotions();
        } catch (err) {
            console.error('Error deleting promo:', err);
            showNotification('error', 'Error', 'No se pudo eliminar la promoción.');
        }
    };

    const handleEditPromo = (promo) => {
        setPromoToEdit(promo);
        setPromoForm({
            title: promo.title,
            description: promo.description || '',
            start_date: promo.start_date ? new Date(promo.start_date).toISOString().split('T')[0] : '',
            end_date: promo.end_date ? new Date(promo.end_date).toISOString().split('T')[0] : '',
            image_url: promo.image_url || 'Promo_Kpoint.png'
        });
        setPromoView('edit');
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${business.id}-${Math.random()}.${fileExt}`;
            const filePath = `logos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('business-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

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
                    registration_data: true
                })
                .eq('id', business.id);

            if (error) throw error;
            showNotification('success', '¡Ajustes Guardados!', 'La configuración de tu negocio se ha actualizado correctamente.');

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
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24 font-display antialiased">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-[#f8fafc]/80 backdrop-blur-xl z-50 border-b border-slate-200">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col w-full">
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            {activeTab && (
                                <button 
                                    onClick={() => setActiveTab(null)}
                                    className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-primary transition-all mr-1"
                                >
                                    <span className="material-symbols-outlined !text-xl">arrow_back</span>
                                </button>
                            )}
                            <span className="material-symbols-outlined text-primary !text-3xl font-black">storefront</span>
                            {activeTab ? (
                                <span>
                                    {activeTab === 'info' && 'Identidad'}
                                    {activeTab === 'promos' && 'Promociones'}
                                    {activeTab === 'marketing' && 'Marketing Hub'}
                                    {activeTab === 'staff' && 'Equipo'}
                                    {activeTab === 'support' && 'Soporte'}
                                </span>
                            ) : (
                                'Ajustes del Negocio'
                            )}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">
                            {activeTab ? 'Configuración de Sección' : 'Identidad y Reglas'}
                        </p>
                    </div>
                </div>
            </header>

            <main className="px-6 py-6 space-y-6">
                {!activeTab && (
                    <>
                        {/* Instructional Header Card - Compact & Balanced */}
                        <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-[2rem] p-6 border-2 border-[#595A5B] shadow-xl relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
                                        <span className="material-symbols-outlined text-primary !text-xl font-black">rocket_launch</span>
                                    </div>
                                    <h3 className="text-xl font-black text-white tracking-tight">Centro de Control</h3>
                                </div>
                                <div className="pl-1">
                                    <p className="text-slate-400 text-[11px] font-bold leading-relaxed max-w-[280px]">
                                        Optimiza la fidelización de tu negocio configurando cada módulo según tus necesidades comerciales.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Decorative Spotlight */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full -translate-x-4 -translate-y-4"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SettingCard 
                            icon="info" 
                            label="Info Básica" 
                            color="blue"
                            onClick={() => setActiveTab('info')} 
                        />
                        <SettingCard 
                            icon="redeem" 
                            label="Promociones" 
                            color="purple"
                            onClick={() => setActiveTab('promos')} 
                        />
                        <SettingCard 
                            icon="campaign" 
                            label="Marketing" 
                            color="orange"
                            onClick={() => setActiveTab('marketing')} 
                        />
                        <SettingCard 
                            icon="badge" 
                            label="Equipo" 
                            color="emerald"
                            onClick={() => setActiveTab('staff')} 
                        />
                        <SettingCard 
                            icon="support_agent" 
                            label="Soporte" 
                            color="cyan"
                            onClick={() => setActiveTab('support')} 
                        />
                        <SettingCard 
                            icon="payments" 
                            label="Mi Plan" 
                            color="indigo"
                            onClick={() => navigate('/subscription')} 
                        />
                    </div>
                </>
            )}

                {activeTab === 'info' && (
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-4 px-1">
                            {/* Section Header */}
                            <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                                <span className="material-symbols-outlined text-primary !text-xl font-black">info</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identidad del Negocio</span>
                            </div>

                            {/* Logo Upload */}
                            <div className="flex flex-col items-center mb-1">
                                <div className="relative group w-full flex justify-center">
                                    <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] shadow-inner relative group">
                                        <div className="size-56 rounded-[2.5rem] bg-white border-2 border-[#595A5B] overflow-hidden flex items-center justify-center group-hover:border-primary transition-all relative shadow-xl">
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
                                        <label className="absolute -bottom-2 right-2 size-14 rounded-2xl bg-white border-2 border-[#595A5B] shadow-2xl flex items-center justify-center cursor-pointer hover:bg-slate-50 active:scale-90 transition-all z-30">
                                            <span className="material-symbols-outlined text-primary text-3xl font-black">upload</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                        </label>
                                    </div>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Logo comercial</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nombre Comercial</label>
                                <input
                                    type="text"
                                    required
                                    value={business?.name || ''}
                                    onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                                    className="w-full bg-white border-2 border-slate-200 h-16 rounded-2xl px-6 text-slate-900 focus:border-primary/40 outline-none transition-all font-bold"
                                    placeholder="Nombre de tu negocio"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Representante Legal</label>
                                <input
                                    type="text"
                                    required
                                    value={business?.legal_representative || ''}
                                    onChange={(e) => setBusiness({ ...business, legal_representative: e.target.value })}
                                    className="w-full bg-white border-2 border-slate-200 h-16 rounded-2xl px-6 text-slate-900 focus:border-primary/40 outline-none transition-all font-bold"
                                    placeholder="Nombre del representante"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">RIF / Registro</label>
                                    <input
                                        type="text"
                                        required
                                        value={business?.rif || ''}
                                        onChange={(e) => setBusiness({ ...business, rif: e.target.value })}
                                        className="w-full bg-white border-2 border-slate-200 h-16 rounded-2xl px-6 text-slate-900 focus:border-primary/40 outline-none transition-all font-bold uppercase"
                                        placeholder="J-12345678-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Ciudad</label>
                                    <input
                                        type="text"
                                        required
                                        value={business?.city || ''}
                                        onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                                        className="w-full bg-white border-2 border-slate-200 h-16 rounded-2xl px-6 text-slate-900 focus:border-primary/40 outline-none transition-all font-bold"
                                        placeholder="Caracas"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Rules Section */}
                        <div className="space-y-4 px-1">
                            <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                                <span className="material-symbols-outlined text-primary !text-xl font-black">settings_account_box</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Reglas y Puntos</span>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Puntos por Dólar ($1.00 = pts)</label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        required
                                        value={business?.points_per_dollar || 10}
                                        onChange={(e) => setBusiness({ ...business, points_per_dollar: parseInt(e.target.value) })}
                                        className="w-full bg-white border-2 border-slate-200 h-24 rounded-[2rem] pl-8 pr-28 text-5xl font-black text-slate-900 focus:border-primary/40 outline-none transition-all"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Ptos x</p>
                                        <p className="text-xl font-black text-primary">$1 USD</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Legal Section for Owners */}
                        <div className="bg-slate-100 rounded-[2rem] p-6 border-2 border-slate-200 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-slate-400 font-bold text-lg">gavel</span>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Compromiso Legal</p>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                Como dueño de negocio, te comprometes a cumplir con nuestros <button type="button" onClick={() => navigate('/terms')} className="text-primary font-black hover:underline">Términos de Servicio</button> y la <button type="button" onClick={() => navigate('/privacy')} className="text-primary font-black hover:underline">Política de Privacidad</button> en el tratamiento de los datos de tus clientes.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary text-white h-16 rounded-[2rem] font-black text-sm uppercase shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            {saving ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'GUARDAR CAMBIOS'}
                        </button>
                    </form>
                )}

                {activeTab === 'promos' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black text-slate-900 uppercase">Centro de Promociones</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Gestiona tus campañas flash</p>
                            </div>
                            {promoView === 'list' && (
                                <button 
                                    onClick={() => {
                                        setPromoView('create');
                                        setPromoForm({ title: '', description: '', start_date: '', end_date: '', image_url: 'Promo_Kpoint.png' });
                                    }}
                                    className="h-10 px-5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
                                >
                                    <span className="material-symbols-outlined !text-sm">add</span>
                                    Crear Nueva
                                </button>
                            )}
                            {promoView !== 'list' && (
                                <button 
                                    onClick={() => setPromoView('list')}
                                    className="h-10 px-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined !text-sm">arrow_back</span>
                                    Volver
                                </button>
                            )}
                        </div>

                        {promoView === 'list' ? (
                            <div className="grid grid-cols-1 gap-4">
                                {promotions.length > 0 ? (
                                    promotions.map((promo) => (
                                        <div key={promo.id} className="bg-white border-2 border-slate-200 rounded-[2rem] p-4 flex items-center gap-4">
                                            <div className="size-28 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                <img 
                                                    src={promo.image_url.startsWith('http') ? promo.image_url : `/${promo.image_url}`} 
                                                    alt={promo.title} 
                                                    className="w-full h-full object-contain" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-slate-900 leading-tight truncate uppercase text-sm">{promo.title}</h3>
                                                <p className="text-[10px] text-slate-500 font-medium line-clamp-1">{promo.description}</p>
                                                <p className="text-[9px] font-black text-slate-400 mt-1 uppercase">
                                                    {new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => handleEditPromo(promo)} className="size-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                                                    <span className="material-symbols-outlined !text-sm">edit</span>
                                                </button>
                                                <button onClick={() => handleDeletePromo(promo.id)} className="size-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center">
                                                    <span className="material-symbols-outlined !text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 flex flex-col items-center justify-center gap-4">
                                        <span className="material-symbols-outlined text-slate-200 !text-6xl">celebration</span>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay promociones activas</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-6 space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative group">
                                        <div className="w-full h-80 rounded-[2.5rem] bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-2xl relative">
                                            <img 
                                                src={promoForm.image_url.startsWith('http') ? promoForm.image_url : `/${promoForm.image_url}`} 
                                                alt="Promo" 
                                                className="w-full h-full object-contain" 
                                            />
                                        </div>
                                        <label className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white cursor-pointer active:scale-90 transition-all">
                                            <span className="material-symbols-outlined !text-xl">add_a_photo</span>
                                            <input type="file" accept="image/*" onChange={handlePromoImageUpload} className="hidden" />
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Imagen de la Promoción</p>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de la Promoción</label>
                                        <input 
                                            type="text" 
                                            value={promoForm.title}
                                            onChange={(e) => setPromoForm({...promoForm, title: e.target.value})}
                                            className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 text-sm font-bold"
                                            placeholder="Ej: Promo 2x1"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descripción</label>
                                        <textarea 
                                            rows="3"
                                            value={promoForm.description}
                                            onChange={(e) => setPromoForm({...promoForm, description: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 text-sm font-bold resize-none"
                                            placeholder="Detalles de la oferta..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Inicia (Desde)</label>
                                            <input 
                                                type="date" 
                                                value={promoForm.start_date}
                                                onChange={(e) => setPromoForm({...promoForm, start_date: e.target.value})}
                                                className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 text-sm font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Finaliza (Hasta)</label>
                                            <input 
                                                type="date" 
                                                value={promoForm.end_date}
                                                onChange={(e) => setPromoForm({...promoForm, end_date: e.target.value})}
                                                className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSavePromo}
                                        disabled={isSavingPromo}
                                        className="w-full h-16 bg-primary text-white rounded-[2rem] font-black uppercase shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all"
                                    >
                                        {isSavingPromo ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'GUARDAR PROMOCIÓN'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'marketing' && <MarketingHub />}

                {activeTab === 'staff' && (
                    <div className="pb-8">
                        <StaffSection />
                    </div>
                )}

                {activeTab === 'support' && (
                    <div className="pb-8">
                        <SupportSection userType="owner" />
                    </div>
                )}
            </main>

            <Navigation />
        </div>
    );
};

const SettingCard = ({ icon, label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="bg-primary border border-slate-200 rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all group overflow-hidden relative min-h-[130px]"
        >
            <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center text-white transition-all duration-300 group-hover:scale-110 shadow-inner">
                <span className="material-symbols-outlined !text-4xl font-black">{icon}</span>
            </div>
            <span className="text-[12px] font-black text-white uppercase tracking-widest text-center leading-tight px-1 drop-shadow-sm">{label}</span>
            
            {/* Subtle Shine */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
        </button>
    );
};

export default BusinessSettings;
