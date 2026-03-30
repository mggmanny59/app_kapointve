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
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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
            <div className="bg-primary/10 rounded-[1.5rem] p-4 border-2 border-primary/20 flex items-center gap-4">
                <div className="bg-white/60 p-3 rounded-2xl flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-primary !text-[28px]">campaign</span>
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-900 mb-0.5 whitespace-nowrap">Centro de Marketing</h2>
                    <p className="text-[10px] leading-snug text-slate-600 font-bold pr-2">Imprime plantillas para promover tu negocio en KPoint.</p>
                </div>
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
                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x pr-4">
                        {templates.map((template, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    setSelectedTemplate(template);
                                    setIsPreviewModalOpen(true);
                                }}
                                className="snap-center flex-shrink-0 w-[85vw] sm:w-[340px] aspect-[16/9] sm:aspect-[4/3] rounded-3xl overflow-hidden border-2 border-slate-200 transition-all relative flex items-center justify-center bg-slate-50 active:scale-95 hover:border-primary/50 shadow-sm"
                            >
                                <img 
                                    src={template.url} 
                                    alt={template.name} 
                                    className="w-full h-full object-contain p-2" 
                                />
                            </button>
                        ))}
                    </div>
                )}

                {/* Modal de Vista Previa y Exportación */}
                {isPreviewModalOpen && selectedTemplate && (
                    <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col backdrop-blur-md animate-in fade-in duration-300">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-5 bg-gradient-to-b from-black/50 to-transparent">
                            <h3 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary !text-lg">visibility</span>
                                Vista Previa
                            </h3>
                            <button 
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="size-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/30 transition-colors active:scale-90"
                            >
                                <span className="material-symbols-outlined font-black">close</span>
                            </button>
                        </div>
                        
                        {/* Imagen Grande Central */}
                        <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
                            <img 
                                src={selectedTemplate.url} 
                                alt="Vista Previa" 
                                className="max-w-full max-h-[90%] object-contain drop-shadow-2xl rounded-lg"
                            />
                        </div>

                        {/* Botones de Exportación (Bottom Sheet) */}
                        <div className="bg-white rounded-t-[2rem] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] pb-8 animate-in slide-in-from-bottom-8 duration-500">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                            <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-4 text-center">Imprimir o Generar PDF</h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    disabled={isGenerating}
                                    onClick={() => handleDownload('carta')}
                                    className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all gap-2 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-primary text-3xl">description</span>
                                    <span className="font-black text-slate-900 text-[11px] text-center uppercase tracking-widest">Formato<br/>Carta</span>
                                    <span className="text-[9px] text-slate-500 font-bold text-center mt-1">1 imagen grande<br/>alta resolución</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={isGenerating}
                                    onClick={() => handleDownload('media-carta')}
                                    className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-primary bg-primary hover:bg-orange-600 active:scale-95 transition-all gap-2 disabled:opacity-50 shadow-lg shadow-primary/30"
                                >
                                    <span className="material-symbols-outlined text-white text-3xl">file_copy</span>
                                    <span className="font-black text-white text-[11px] text-center uppercase tracking-widest">Media<br/>Carta</span>
                                    <span className="text-[9px] text-white/80 font-bold text-center mt-1">2 medianos<br/>(ahorra papel)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketingHub;
