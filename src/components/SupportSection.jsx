import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const SupportSection = ({ userType = 'client' }) => {
    const { user } = useAuth();
    const [profileData, setProfileData] = useState({
        businessName: '',
        legalName: '',
        phone: ''
    });

    useEffect(() => {
        const fetchInfo = async () => {
            if (!user) return;
            
            try {
                // Fetch profile info
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, phone')
                    .eq('id', user.id)
                    .single();

                let bName = 'N/A';
                let lName = profile?.full_name || '';
                let phone = profile?.phone || '';

                if (userType === 'owner') {
                    const { data: business } = await supabase
                        .from('businesses')
                        .select('name, legal_representative, phone')
                        .eq('owner_id', user.id)
                        .maybeSingle();
                    
                    if (business) {
                        bName = business.name || '';
                        lName = business.legal_representative || lName;
                        phone = business.phone || phone;
                    }
                }

                setProfileData({
                    businessName: bName,
                    legalName: lName,
                    phone: phone
                });
            } catch (err) {
                console.error('Error fetching support info:', err);
            }
        };

        fetchInfo();
    }, [user, userType]);

    const handleEmailSupport = () => {
        const subject = encodeURIComponent(`Soporte KPoint - ${userType === 'owner' ? 'Comercio' : 'Cliente'}`);
        
        let bodyContent = `Hola equipo de KPoint,\n\nEscribo para solicitar apoyo con respecto a mi cuenta.\n\nTipo de Usuario: ${userType === 'owner' ? 'Comercio' : 'Cliente'}\n`;
        
        if (userType === 'owner') {
            bodyContent += `Nombre del Comercio: ${profileData.businessName}\n`;
            bodyContent += `Nombre del Representante Legal: ${profileData.legalName}\n`;
        } else {
            bodyContent += `Nombre del Cliente: ${profileData.legalName}\n`;
        }
        
        bodyContent += `Teléfono de Contacto: ${profileData.phone}\n\n`;
        bodyContent += `Detalles del problema:\n`;
        
        const body = encodeURIComponent(bodyContent);
        window.location.href = `mailto:soporte.kpointve@gmail.com?subject=${subject}&body=${body}`;
    };

    const handleWhatsAppSupport = () => {
        const text = encodeURIComponent(`Hola KPoint! Soy ${userType === 'owner' ? 'dueño de un negocio' : 'un cliente'} y necesito soporte con la aplicación.`);
        window.open(`https://wa.me/584225835141?text=${text}`, '_blank');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-[#595A5B] shadow-lg relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                <span className="material-symbols-outlined !text-4xl font-black">support_agent</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">¿Necesitas Ayuda?</h3>
                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Estamos aquí para apoyarte</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
                            Si tienes dudas sobre el funcionamiento de la plataforma, problemas con tus puntos o necesitas asistencia técnica, contáctanos por cualquiera de nuestros canales oficiales.
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={handleEmailSupport}
                                className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
                            >
                                <span className="material-symbols-outlined !text-xl">mail</span>
                                Enviar Correo Directo
                            </button>

                            <button
                                disabled
                                className="w-full h-16 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined !text-xl">chat</span>
                                Chat por WhatsApp
                            </button>
                        </div>
                    </div>

                    {/* Decorative abstract shape */}
                    <div className="absolute -bottom-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                </div>
            </div>
        </div>
    );
};

export default SupportSection;
