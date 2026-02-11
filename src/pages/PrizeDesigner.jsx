import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PrizeCalculator from '../components/PrizeCalculator';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const PrizeDesigner = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [view, setView] = useState('create'); // 'create' or 'list'
    const [prizes, setPrizes] = useState([]);
    const [isLoadingPrizes, setIsLoadingPrizes] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        points: '',
        image: null,
        is_active: true
    });
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingPrizeId, setEditingPrizeId] = useState(null);
    const [showCalculator, setShowCalculator] = useState(false);
    const { showNotification } = useNotification();

    const fetchPrizes = async () => {
        try {
            setIsLoadingPrizes(true);
            const { data: memberData } = await supabase
                .from('business_members')
                .select('business_id')
                .eq('profile_id', user?.id)
                .single();

            const bizId = memberData?.business_id || '00000000-0000-0000-0000-000000000001';

            const { data, error } = await supabase
                .from('rewards')
                .select('*')
                .eq('business_id', bizId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPrizes(data || []);
        } catch (err) {
            console.error('Error fetching prizes:', err);
        } finally {
            setIsLoadingPrizes(false);
        }
    };

    useEffect(() => {
        if (view === 'list') {
            fetchPrizes();
        }
    }, [view]);

    const handleEdit = (prize) => {
        setEditingPrizeId(prize.id);
        setFormData({
            name: prize.name,
            description: prize.description || '',
            points: prize.cost_points.toString(),
            image: null,
            is_active: prize.is_active ?? true
        });
        setPreviewUrl(prize.image_url);
        setView('create');
    };

    const handleDelete = async () => {
        if (!editingPrizeId) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar este premio? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('rewards')
                .delete()
                .eq('id', editingPrizeId);

            if (error) throw error;
            showNotification('success', '¡Eliminado!', 'El premio ha sido eliminado del catálogo.');
            await fetchPrizes();
            resetForm();
            setView('list');
        } catch (err) {
            console.error('Delete error:', err);
            showNotification('error', 'Error al eliminar', err.message);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', description: '', points: '', image: null, is_active: true });
        setPreviewUrl(null);
        setEditingPrizeId(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, image: file });
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleApplyPoints = (calculatedPoints) => {
        setFormData({ ...formData, points: calculatedPoints.toString() });
        setShowCalculator(false);
        showNotification('success', 'Puntos Aplicados', 'Los puntos calculados se han cargado en el formulario.');
    };

    const handleSave = async (e) => {
        e.preventDefault();

        try {
            setIsSaving(true);

            // Validation
            if (!formData.name || !formData.points) {
                throw new Error('El nombre y los puntos son obligatorios');
            }

            // 1. Process Image to Base64 (if changed)
            let finalImageUrl = previewUrl;
            if (formData.image) {
                finalImageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(formData.image);
                });
            }

            // 3. Save Reward
            if (editingPrizeId) {
                // Update
                const { error: updateError } = await supabase
                    .from('rewards')
                    .update({
                        name: formData.name,
                        description: formData.description,
                        cost_points: parseInt(formData.points),
                        image_url: finalImageUrl,
                        is_active: formData.is_active
                    })
                    .eq('id', editingPrizeId);

                if (updateError) throw updateError;
                showNotification('success', '¡Actualizado!', 'El premio se ha modificado correctamente.');
            } else {
                // Insert - Only fetch businessId for new prizes
                const { data: memberData, error: memberError } = await supabase
                    .from('business_members')
                    .select('business_id')
                    .eq('profile_id', user?.id)
                    .single();

                if (memberError && !memberData) {
                    console.error('Error fetching business_id:', memberError);
                }

                const businessId = memberData?.business_id || '00000000-0000-0000-0000-000000000001';

                const { error: insertError } = await supabase
                    .from('rewards')
                    .insert({
                        business_id: businessId,
                        name: formData.name,
                        description: formData.description,
                        cost_points: parseInt(formData.points),
                        image_url: finalImageUrl || 'https://via.placeholder.com/400x400.png?text=Sin+Imagen',
                        is_active: formData.is_active
                    });

                if (insertError) throw insertError;
                showNotification('success', '¡Creado!', 'El nuevo premio se ha añadido a tu catálogo.');
            }

            // Refresh list and return
            await fetchPrizes();
            resetForm();
            setView('list');
        } catch (err) {
            console.error('Save error:', err);
            showNotification('error', 'Error en Operación', err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-navy-dark text-white pb-24">
            {/* Header */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-navy-dark/90 backdrop-blur-xl z-50 space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => {
                            if (view === 'list') {
                                setView('create');
                            } else if (editingPrizeId) {
                                setView('list');
                                resetForm();
                            } else {
                                navigate('/dashboard');
                            }
                        }}
                        className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCalculator(true)}
                            className="h-9 px-4 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 text-slate-300 active:scale-95 transition-all outline-none"
                        >
                            <span className="material-symbols-outlined font-bold !text-lg text-accent">calculate</span>
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Calculadora</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (view === 'list') {
                                    resetForm();
                                    setView('create');
                                } else {
                                    setView('list');
                                }
                            }}
                            className="h-9 px-4 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 text-primary active:scale-95 transition-all outline-none"
                        >
                            <span className="material-symbols-outlined font-black !text-lg">
                                {view === 'create' ? 'list_alt' : 'add_circle'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                {view === 'create' ? 'Listado' : 'Nuevo'}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary !text-3xl">featured_seasonal_and_gifts</span>
                        {view === 'create'
                            ? (editingPrizeId ? 'Editar Premio' : 'Diseñador de Premios')
                            : 'Mis Premios'}
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 ml-1">
                        {view === 'create'
                            ? (editingPrizeId ? 'Modificar Beneficio' : 'Crear Nuevo Beneficio')
                            : 'Catálogo Registrado'}
                    </p>
                </div>
            </header>

            <main className="px-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {view === 'create' ? (
                    <form onSubmit={handleSave} className="space-y-4">

                        {/* Image Upload Area */}
                        <div className="flex flex-col items-center">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="size-36 rounded-[2rem] bg-navy-card border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer hover:border-primary/50 transition-colors"
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-3">
                                        <span className="material-symbols-outlined text-primary !text-3xl mb-1 block animate-pulse">add_a_photo</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Foto del premio</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Premio</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-navy-card border border-white/5 h-12 rounded-xl px-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-slate-600"
                                    placeholder="Ej. Hamburguesa Gratis"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción corta</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-navy-card border border-white/5 h-12 rounded-xl px-4 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium placeholder:text-slate-600"
                                    placeholder="Ej. Válido para 1 hamburguesa clásica..."
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Puntos</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-accent !text-xl">stars</span>
                                        <input
                                            type="number"
                                            required
                                            value={formData.points}
                                            onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                                            className="w-full bg-navy-card border border-white/5 h-12 rounded-xl pl-12 pr-4 text-white text-xl font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-600"
                                            placeholder="500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1 min-w-[120px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Estado</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`w-full h-12 rounded-full border flex items-center justify-center gap-2 transition-all ${formData.is_active
                                            ? 'bg-primary/10 border-primary/30 text-primary'
                                            : 'bg-red-500/10 border-red-500/30 text-red-500'}`}
                                    >
                                        <span className="material-symbols-outlined !text-lg">
                                            {formData.is_active ? 'check_circle' : 'cancel'}
                                        </span>
                                        <span className="text-[10px] font-black uppercase">{formData.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            {editingPrizeId && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 h-14 rounded-full font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined !text-lg">delete</span>
                                    Eliminar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`${editingPrizeId ? 'flex-[2]' : 'w-full'} bg-primary text-navy-dark h-14 rounded-full font-black text-sm uppercase shadow-[0_8px_25px_rgb(57,224,121,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                            >
                                {isSaving ? (editingPrizeId ? 'Actualizando...' : 'Guardando...') : (editingPrizeId ? 'ACTUALIZAR' : 'Guardar Premio')}
                                <span className="material-symbols-outlined !text-lg">{editingPrizeId ? 'done_all' : 'save'}</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {isLoadingPrizes ? (
                            <div className="col-span-2 flex flex-col items-center justify-center py-20 space-y-4">
                                <span className="material-symbols-outlined text-primary animate-spin !text-4xl">sync</span>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando Catálogo...</p>
                            </div>
                        ) : prizes.length > 0 ? (
                            prizes.map((prize) => (
                                <div key={prize.id} className="bg-navy-card rounded-3xl border border-white/5 overflow-hidden flex flex-col group active:scale-[0.98] transition-all relative">
                                    {/* Edit floating button */}
                                    <button
                                        onClick={() => handleEdit(prize)}
                                        className="absolute top-2 left-2 z-10 size-8 rounded-full bg-navy-dark/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-300 active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined !text-lg">edit</span>
                                    </button>

                                    <div className="relative h-28 bg-white/5 flex items-center justify-center p-2">
                                        <img
                                            src={prize.image_url}
                                            alt={prize.name}
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute top-2 right-2 bg-accent/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                                            <span className="text-[10px] font-black text-navy-dark">{prize.cost_points} pts</span>
                                        </div>
                                    </div>

                                    <div className="p-3 flex flex-col flex-1">
                                        <h3 className="text-sm font-black text-white line-clamp-1 leading-tight">{prize.name}</h3>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1 line-clamp-1 flex-1">{prize.description || 'Sin descripción'}</p>

                                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${prize.is_active ? 'text-primary' : 'text-red-400'}`}>
                                                {prize.is_active ? 'Disponible' : 'Agotado'}
                                            </span>
                                            <span className="material-symbols-outlined text-slate-600 !text-xs">
                                                {prize.is_active ? 'check_circle' : 'cancel'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-2 text-center py-20">
                                <span className="material-symbols-outlined text-slate-700 !text-6xl mb-4">featured_seasonal_and_gifts</span>
                                <p className="text-slate-500 font-bold italic">No has creado premios aún</p>
                                <button
                                    onClick={() => setView('create')}
                                    className="mt-4 text-primary font-black uppercase tracking-widest text-xs"
                                >
                                    ¡Crea el primero aquí!
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Calculator Modal */}
            {showCalculator && (
                <PrizeCalculator
                    onClose={() => setShowCalculator(false)}
                    onApply={handleApplyPoints}
                />
            )}

            {/* Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-50">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">dashboard</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Panel</span>
                </button>
                <button
                    onClick={() => navigate('/clients')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">group</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Clientes</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-primary">
                    <span className="material-symbols-outlined font-bold">featured_seasonal_and_gifts</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Premios</span>
                </button>
                <button
                    onClick={() => navigate('/settings')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes</span>
                </button>
            </nav>
        </div>
    );
};

export default PrizeDesigner;
