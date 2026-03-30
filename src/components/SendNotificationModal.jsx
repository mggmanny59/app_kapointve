import React, { useState } from 'react';
import { useMessages } from '../context/MessageContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendPushToProfile } from '../lib/pushNotifications';

const SendNotificationModal = ({ isOpen, onClose, businessId, targetClient = null }) => {
    const { sendMessage } = useMessages();
    const { showNotification } = useNotification();
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('GENERAL');
    const [sendPush, setSendPush] = useState(false);
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !message) {
            showNotification('error', 'Campos requeridos', 'Por favor llena el título y el mensaje.');
            return;
        }

        setSending(true);
        try {
            // 1. Send Internal Notification (In-App)
            const result = await sendMessage(
                businessId,
                targetClient ? targetClient.profile_id : null,
                title,
                message,
                type
            );

            if (!result.success) throw new Error(result.error);

            // 2. Send Real Push Notification (Edge Function) if enabled
            let pushCount = 0;
            if (sendPush && (user?.is_super_admin || user?.role === 'owner')) {
                let recipients = [];
                let businessName = 'KPoint';
                let businessLogo = null;

                // Fetch business info to personalize push
                if (businessId) {
                    const { data: bData } = await supabase
                        .from('businesses')
                        .select('name, logo_url')
                        .eq('id', businessId)
                        .single();
                    if (bData) {
                        businessName = bData.name;
                        businessLogo = bData.logo_url;
                    }
                }

                if (targetClient) {
                    recipients = [targetClient.profile_id];
                } else if (businessId) {
                    // Fetch all clients for this business
                    const { data } = await supabase
                        .from('loyalty_cards')
                        .select('profile_id')
                        .eq('business_id', businessId);
                    recipients = data?.map(d => d.profile_id) || [];
                } else {
                    // Global Push: Fetch everyone with a subscription
                    const { data } = await supabase
                        .from('push_subscriptions')
                        .select('profile_id');
                    recipients = [...new Set(data?.map(d => d.profile_id) || [])];
                }

                if (recipients.length > 0) {
                    // Execute Push batches
                    const pushPromises = recipients.map(pid => 
                        sendPushToProfile({
                            profileId: pid,
                            title: businessId ? `${businessName}: ${title}` : title,
                            message: message,
                            url: '/my-points',
                            icon: businessLogo || '/pwa-192x192.png'
                        })
                    );
                    const pushResults = await Promise.all(pushPromises);
                    pushCount = pushResults.filter(r => r.success).length;
                }
            }

            showNotification(
                'success', 
                '¡Comunicado Enviado!', 
                pushCount > 0 
                    ? `Notificación interna enviada y ${pushCount} alertas Push móviles procesadas.`
                    : 'La notificación interna ha sido enviada con éxito.'
            );
            
            onClose();
            setTitle('');
            setMessage('');
            setType('GENERAL');
            setSendPush(false);
        } catch (err) {
            showNotification('error', 'Error de Envío', err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-slate-50 animate-in slide-in-from-right duration-300 flex flex-col font-display text-slate-900 overflow-hidden">
            {/* Header Area (Similar to KPannel) */}
            <div className="bg-primary rounded-b-[2rem] px-6 pt-7 pb-5 relative z-20 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined !text-2xl font-black">campaign</span>
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white tracking-tight leading-tight">
                                {targetClient ? 'Mensaje Directo' : 'Aviso Masivo'}
                            </h2>
                            <p className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em] mt-0.5 flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-white animate-pulse"></span>
                                {targetClient ? (targetClient.profiles?.full_name || 'CLIENTE') : 'ESTRATEGIA FIDELIZACIÓN'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 px-5 md:px-8 py-2 -mt-4 relative z-30 custom-scrollbar overflow-y-auto">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-5 pt-4">
                    
                    {/* Title Field */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">TÍTULO DEL MENSAJE</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200 rounded-2xl h-12 px-6 text-[15px] outline-none focus:border-primary/40 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                            placeholder="Ej: ¡Hoy tenemos café 2x1!"
                            required
                        />
                    </div>

                    {/* Category and Push Settings Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">CATEGORÍA</label>
                            <div className="relative">
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl h-12 px-6 text-[14px] outline-none focus:border-primary/40 transition-all appearance-none font-bold text-slate-900 cursor-pointer pr-12"
                                >
                                    <option value="GENERAL">General / Informativa</option>
                                    <option value="PROMO">Promoción Especial</option>
                                    <option value="POINTS">Bono de Puntos</option>
                                    <option value="REWARD">Premio Disponible</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none !text-xl font-black">expand_more</span>
                            </div>
                        </div>

                        {(user?.is_super_admin || user?.role === 'owner') && (
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">TRANSMISIÓN_PUSH</label>
                                <div className="flex items-center justify-between h-12 px-6 bg-primary/5 rounded-2xl border-2 border-primary/10 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined !text-lg font-normal">notifications_active</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Enviar Push Mobile</p>
                                            <p className="text-[8px] font-bold text-primary uppercase opacity-70">Edge Function Active</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={sendPush}
                                            onChange={(e) => setSendPush(e.target.checked)}
                                            className="sr-only peer" 
                                        />
                                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Message Body */}
                    <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">CUERPO DEL MENSAJE</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200 rounded-[1.5rem] h-28 p-5 text-[14px] outline-none focus:border-primary/40 transition-all resize-none font-medium text-slate-600 placeholder:text-slate-300 leading-relaxed custom-scrollbar"
                            placeholder="Detalla aquí la información importante para tus clientes..."
                            required
                        />
                    </div>

                    {/* Actions Row */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                            Cerrar
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex-[2] bg-primary text-white h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {sending ? (
                                <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <span className="material-symbols-outlined !text-xl">send</span>
                            )}
                            {sending ? 'ENVIANDO...' : 'ENVIAR AHORA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SendNotificationModal;
