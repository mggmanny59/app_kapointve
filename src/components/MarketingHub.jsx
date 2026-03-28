import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { jsPDF } from 'jspdf';

const CATEGORIES = [
    { id: 'General', name: 'General', icon: 'storefront' },
    { id: 'Gastronomia', name: 'Gastronomía', icon: 'restaurant' },
    { id: 'Salud-Belleza', name: 'Salud y Belleza', icon: 'spa' },
    { id: 'Tiendas', name: 'Tiendas', icon: 'shopping_bag' },
    { id: 'Servicios-Varios', name: 'Servicios', icon: 'build_circle' }
];

const MarketingHub = () => {
    const { showNotification } = useNotification();
    const [activeCategory, setActiveCategory] = useState('General');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        fetchTemplates(activeCategory);
    }, [activeCategory]);

    const fetchTemplates = async (category) => {
        setLoading(true);
        setSelectedTemplate(null);
        try {
            const { data, error } = await supabase.storage
                .from('marketing_assets')
                .list(category, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' }
                });

            if (error) throw error;

            // Filter out the placeholder files and get public URLs
            const validTemplates = data
                .filter(file => file.name !== '.emptyFolderPlaceholder' && file.name !== '.DS_Store')
                .map(file => {
                    const { data: { publicUrl } } = supabase.storage
                        .from('marketing_assets')
                        .getPublicUrl(`${category}/${file.name}`);
                    return {
                        name: file.name,
                        url: publicUrl
                    };
                });

            setTemplates(validTemplates);
        } catch (err) {
            console.error('Error fetching templates:', err);
            showNotification('error', 'Error', 'No se pudieron cargar las plantillas de ' + category);
        } finally {
            setLoading(false);
        }
    };

    // Helper to load image securely for jsPDF
    const loadImage = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // Important for fetching from foreign origins like Supabase Storage
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    };

    const handleDownload = async (format) => {
        if (!selectedTemplate) return;
        setIsGenerating(true);

        try {
            const img = await loadImage(selectedTemplate.url);

            if (format === 'carta') {
                // PDF Carta en Horizontal (Landscape): 11 ancho x 8.5 alto
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
                pdf.addImage(img, 'JPEG', 0, 0, 11, 8.5);
                pdf.save(`KPoint-Promo-${activeCategory}-Carta.pdf`);
                showNotification('success', '¡Descarga Exitosa!', 'Tu volante Carta (Horizontal) está listo para imprimir.');
            } else if (format === 'media-carta') {
                // PDF Media Carta para imagenes Horizontales
                // Usa hoja Vertical (Portrait): 8.5 ancho x 11 alto
                // Coloca una imagen arriba (8.5x5.5) y otra abajo (8.5x5.5)
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
                // Imagen Arriba
                pdf.addImage(img, 'JPEG', 0, 0, 8.5, 5.5);
                // Imagen Abajo
                pdf.addImage(img, 'JPEG', 0, 5.5, 8.5, 5.5);
                
                pdf.save(`KPoint-Promo-${activeCategory}-MediaCarta.pdf`);
                showNotification('success', '¡Descarga Exitosa!', 'Tu PDF con dos volantes ha sido generado exitosamente.');
            }
        } catch (error) {
            console.error('Error al generar PDF:', error);
            showNotification('error', 'Error en Generación', 'Hubo un problema procesando la imagen. Reintenta.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-primary/10 rounded-3xl p-6 border-2 border-primary/20 text-center">
                <span className="material-symbols-outlined text-primary text-4xl mb-2">campaign</span>
                <h2 className="text-xl font-black text-slate-900 mb-1">Centro de Marketing</h2>
                <p className="text-xs text-slate-500 font-bold">Plantillas listas para imprimir y atraer pings de fidelidad a tu negocio.</p>
            </div>

            {/* Categorías */}
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-none snap-x">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`snap-center flex-shrink-0 flex items-center gap-2 h-12 px-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border-2 ${
                            activeCategory === cat.id 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <span className="material-symbols-outlined !text-lg">{cat.icon}</span>
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Carrusel de Plantillas */}
            <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm min-h-[300px]">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl font-black">burst_mode</span>
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Plantillas Disponibles</h3>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <span className="material-symbols-outlined text-primary animate-spin !text-4xl mb-4">sync</span>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando galería...</p>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
                        <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">image_not_supported</span>
                        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Sin plantillas en esta categoría</p>
                    </div>
                ) : (
                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
                        {templates.map((template, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => setSelectedTemplate(template)}
                                className={`snap-center flex-shrink-0 w-56 aspect-[11/8.5] rounded-2xl overflow-hidden border-4 transition-all relative flex items-center justify-center bg-slate-50 ${
                                    selectedTemplate?.name === template.name 
                                    ? 'border-primary shadow-xl shadow-primary/20 scale-100' 
                                    : 'border-slate-200 hover:border-slate-400 scale-95 opacity-80'
                                }`}
                            >
                                <img 
                                    src={template.url} 
                                    alt={template.name} 
                                    className="max-w-full max-h-full object-contain" 
                                />
                                {selectedTemplate?.name === template.name && (
                                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="bg-white size-10 rounded-full flex items-center justify-center shadow-lg">
                                            <span className="material-symbols-outlined text-primary font-black">check</span>
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Zona de Descarga Activa */}
                {selectedTemplate && (
                    <div className="mt-6 pt-6 border-t-2 border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-4 text-center">Exportar para Imprimir</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => handleDownload('carta')}
                                className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-primary text-3xl">description</span>
                                <span className="font-black text-slate-900 text-xs">Formato Carta</span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold text-center">1 volante grande<br/>por hoja (8.5"x11")</span>
                            </button>

                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => handleDownload('media-carta')}
                                className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-primary bg-primary hover:bg-orange-600 active:scale-95 transition-all gap-2 disabled:opacity-50 shadow-lg shadow-primary/30"
                            >
                                <span className="material-symbols-outlined text-white text-3xl">file_copy</span>
                                <span className="font-black text-white text-xs">Media Carta</span>
                                <span className="text-[9px] text-white/80 uppercase tracking-widest font-bold text-center">2 volantes medianos<br/>por hoja (ahorra papel)</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketingHub;
