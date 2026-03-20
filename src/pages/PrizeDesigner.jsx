import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PrizeCalculator from '../components/PrizeCalculator';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';

const PrizeDesigner = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [view, setView] = useState('create'); // 'create' or 'list'
    const [prizes, setPrizes] = useState([]);
    const [isLoadingPrizes, setIsLoadingPrizes] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        points: '',
        unit_cost: '',
        image: null,
        is_active: true
    });
    const [previewUrl, setPreviewUrl] = useState('/LogoPremio.png');
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
            unit_cost: (prize.unit_cost || 0).toString(),
            image: null,
            is_active: prize.is_active ?? true
        });
        setPreviewUrl(prize.image_url);
        setView('create');
    };

    const handleDelete = async (id) => {
        const prizeId = id || editingPrizeId;
        if (!prizeId) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar este premio? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('rewards')
                .delete()
                .eq('id', prizeId);

            if (error) throw error;
            showNotification('success', '¡Eliminado!', 'El premio ha sido eliminado del catálogo.');
            await fetchPrizes();
            if (editingPrizeId === prizeId) resetForm();
            setView('list');
        } catch (err) {
            console.error('Delete error:', err);
            showNotification('error', 'Error al eliminar', err.message);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', description: '', points: '', unit_cost: '', image: null, is_active: true });
        setPreviewUrl('/LogoPremio.png');
        setEditingPrizeId(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, image: file });
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleApplyPoints = (calculatedPoints, calculatedCost) => {
        setFormData({
            ...formData,
            points: calculatedPoints.toString(),
            unit_cost: calculatedCost.toString()
        });
        setShowCalculator(false);
        showNotification('success', 'Puntos y Costo Aplicados', 'Los valores calculados se han cargado en el formulario.');
    };

    const handleSave = async (e) => {
        e.preventDefault();

        try {
            setIsSaving(true);

            // Validation
            if (!formData.name || !formData.points) {
                throw new Error('El nombre y los puntos son obligatorios');
            }

            // 1. Process Image to Base64 (if changed and it's not the default image)
            let finalImageUrl = previewUrl;
            if (formData.image) {
                finalImageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(formData.image);
                });
            } else if (previewUrl === '/LogoPremio.png') {
                // If it's the default image, we might want to store the actual path or 
                // handle it differently. For now, we'll keep the path /LogoPremio.png 
                // which should work if served from public directory.
                finalImageUrl = '/LogoPremio.png';
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
                        unit_cost: parseFloat(formData.unit_cost) || 0,
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
                        unit_cost: parseFloat(formData.unit_cost) || 0,
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
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-32 antialiased">
            {/* Header */}
            <header className="px-6 pt-8 pb-6 sticky top-0 bg-[#f8fafc]/95 backdrop-blur-md z-50 transition-all border-b border-slate-100/50">
                <div className="flex flex-col mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-2xl bg-orange-50 flex items-center justify-center text-primary shadow-inner border-2 border-[#595A5B]">
                                <span className="material-symbols-outlined !text-3xl font-black">inventory_2</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                                    {view === 'create'
                                        ? (editingPrizeId ? 'Actualizar' : 'Diseñador')
                                        : 'Mis Premios'}
                                </h1>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1.5 opacity-70">
                                    {view === 'create'
                                        ? (editingPrizeId ? 'Editando beneficio existente' : 'Configuración de nuevo premio')
                                        : 'Gestión de recompensas activas'}
                                </p>
                            </div>
                        </div>

                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setShowCalculator(true)}
                            className="flex-1 h-12 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center gap-2 text-slate-600 active:scale-95 transition-all shadow-sm hover:border-primary/20"
                        >
                            <span className="material-symbols-outlined font-black !text-xl text-primary">calculate</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">Motor Puntos</span>
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
                            className="flex-1 h-12 rounded-full bg-primary text-white flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            <span className="material-symbols-outlined font-black !text-xl">
                                {view === 'create' ? 'list_alt' : 'add_circle'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {view === 'create' ? 'Catálogo' : 'Crear'}
                            </span>
                        </button>
                    </div>
                </div>

                            {view === 'create' && (
                    <div className="mt-6 space-y-4">
                        {/* Progress Stepper with Labels */}
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-end px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Paso 02 de 04</span>
                                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mt-0.5">
                                        Identidad del Premio
                                    </h2>
                                </div>
                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                                    <span className="text-primary font-black text-xs">2</span>
                                </div>
                            </div>

                            <div className="flex gap-1.5 px-0.5">
                                <div className="h-2 flex-1 bg-primary rounded-full shadow-lg shadow-primary/20 transition-all duration-700"></div>
                                <div className="h-2 flex-1 bg-primary rounded-full relative overflow-hidden shadow-lg shadow-primary/20">
                                    <div className="absolute inset-0 bg-white/40 animate-[shimmer_1.5s_infinite] -skew-x-[20deg]"></div>
                                </div>
                                <div className="h-2 flex-1 bg-slate-200 rounded-full"></div>
                                <div className="h-2 flex-1 bg-slate-100 rounded-full"></div>
                            </div>
                            
                            <p className="text-[10px] font-medium text-slate-400 px-1 leading-tight italic">
                                Sube una imagen atractiva y asigna el valor en puntos para tu recompensa.
                            </p>
                        </div>
                    </div>
                )}
            </header>

            <main className="px-6 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {view === 'create' ? (
                    <form onSubmit={handleSave} className="space-y-1">

                        {/* Image Upload Area - Directo en pantalla */}
                        <div className="flex flex-col items-center mb-1">
                            <div className="relative">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="size-44 rounded-[1.5rem] border-2 border-dashed border-[#595A5B] flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="text-center p-6 space-y-2">
                                            <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border-2 border-[#595A5B]">
                                                <span className="material-symbols-outlined text-slate-200 !text-2xl">image</span>
                                            </div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Carga la foto del premio</p>
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
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute -bottom-1 -right-1 size-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-white active:scale-90 transition-all z-10"
                                >
                                    <span className="material-symbols-outlined !text-xl font-black">photo_camera</span>
                                </button>
                            </div>
                        </div>

                        {/* Inputs - Colocados directamente en pantalla */}
                        <div className="space-y-1 px-1">
                            <div className="space-y-0.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Identificación del Premio</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl px-6 text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold placeholder:text-slate-300"
                                    placeholder="Nombre del beneficio..."
                                />
                            </div>

                            <div className="space-y-0.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Descripción de Canje</label>
                                <textarea
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-white border-2 border-[#595A5B] rounded-2xl p-6 text-slate-600 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-semibold placeholder:text-slate-300 resize-none min-h-[120px]"
                                    placeholder="Válido por una unidad de barra de chocolate rellena de fresa. Sujeto a disponibilidad en tienda."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Costo Unitario</label>
                                    <div className="relative group">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.unit_cost}
                                            onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                                            className="w-full bg-white border-2 border-[#595A5B] h-16 rounded-2xl pl-12 pr-6 text-slate-600 text-lg font-black focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all placeholder:text-slate-200 tabular-nums"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Valor en Puntos</label>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-primary/[0.03] rounded-2xl -z-10 group-focus-within:bg-primary/[0.05] transition-all"></div>
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary !text-2xl font-black">token</span>
                                        <input
                                            type="number"
                                            required
                                            value={formData.points}
                                            onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                                            className="w-full bg-transparent border-2 border-primary/10 h-16 rounded-2xl pl-16 pr-6 text-primary text-2xl font-black focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-primary/20 tabular-nums shadow-[0_4px_20px_-4px_rgba(255,101,14,0.1)]"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    className={`w-full h-14 rounded-2xl border-2 flex items-center justify-between px-6 transition-all shadow-sm ${formData.is_active
                                        ? 'bg-white border-primary text-primary'
                                        : 'bg-white border-[#595A5B] text-slate-400 opacity-60'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined font-black">
                                            {formData.is_active ? 'visibility' : 'visibility_off'}
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Estado en Catálogo</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${formData.is_active ? 'bg-primary/10' : 'bg-slate-100'}`}>
                                        {formData.is_active ? 'PÚBLICO' : 'OCULTO'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 py-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-primary text-white h-20 rounded-3xl font-black text-base tracking-[0.05em] shadow-2xl shadow-primary/30 active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isSaving ? 'Procesando...' : (editingPrizeId ? 'Guardar cambios' : 'Continuar al paso final')}
                            </button>

                            {editingPrizeId && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="w-full h-14 rounded-2xl border border-red-100 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined !text-lg font-black">delete_forever</span>
                                    Eliminar Definitivamente
                                </button>
                            )}
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {isLoadingPrizes ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#595A5B] border-t-primary"></div>
                                <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-[10px]">Actualizando catálogo...</p>
                            </div>
                        ) : prizes.length > 0 ? (
                            prizes.map((prize) => (
                                <div key={prize.id} className="bg-white rounded-[2rem] border-2 border-[#595A5B] flex items-center p-4 gap-4 active:scale-[0.98] transition-all hover:bg-slate-50/50 group relative shadow-sm">
                                    {/* Medium Image Area */}
                                    <div className="size-20 rounded-2xl bg-slate-50 flex items-center justify-center p-3 shrink-0 border-2 border-[#595A5B] shadow-inner relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
                                        <img
                                            src={prize.image_url}
                                            alt={prize.name}
                                            className="w-full h-full object-contain relative z-10"
                                        />
                                    </div>

                                    {/* Info Area - Points Capsule Scale +25% */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="mb-2">
                                            <span className="inline-flex items-center bg-green-50 text-[#22C55E] px-3.5 py-1 rounded-full text-[14px] font-black tracking-tight border border-green-100/50 shadow-sm shadow-green-100/20">
                                                + {prize.cost_points} PTS
                                            </span>
                                        </div>

                                        <h3 className="text-[14px] font-black text-slate-800 tracking-tight leading-tight mb-0.5 truncate uppercase">
                                            {prize.name}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-bold leading-snug line-clamp-1 italic opacity-80">
                                            {prize.description || 'Sin descripción'}
                                        </p>
                                    </div>

                                    {/* Discrete Actions */}
                                    <div className="flex flex-col gap-1.5 ml-1 border-l border-[#595A5B] pl-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(prize);
                                            }}
                                            className="size-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-primary active:scale-90 transition-all border-2 border-[#595A5B]"
                                        >
                                            <span className="material-symbols-outlined !text-base font-black">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(prize.id);
                                            }}
                                            className="size-8 rounded-xl bg-red-50/50 flex items-center justify-center text-red-300 hover:text-red-500 active:scale-90 transition-all border border-red-50/50"
                                        >
                                            <span className="material-symbols-outlined !text-base font-black">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-[#595A5B] mx-4">
                                <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border-2 border-[#595A5B]">
                                    <span className="material-symbols-outlined text-slate-300 !text-5xl">inventory</span>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-2">Catálogo Vacío</h3>
                                <p className="text-slate-600 font-bold text-xs mb-8 text-center px-10 leading-relaxed">Aún no has registrado beneficios para tus clientes.</p>
                                <button
                                    onClick={() => setView('create')}
                                    className="px-8 h-12 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                >
                                    ¡EMPEZAMOS AQUÍ!
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Calculator Modal */}
            {showCalculator && (
                <PrizeCalculator
                    initialCost={formData.unit_cost}
                    onClose={() => setShowCalculator(false)}
                    onApply={handleApplyPoints}
                />
            )}

            {/* Navigation */}
            <Navigation />
        </div>
    );
};

export default PrizeDesigner;
