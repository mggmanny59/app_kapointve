import React, { useState } from 'react';
import { useMessages } from '../context/MessageContext';
import { useNotification } from '../context/NotificationContext';

const SendNotificationModal = ({ isOpen, onClose, businessId, targetClient = null }) => {
    const { sendMessage } = useMessages();
    const { showNotification } = useNotification();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('GENERAL');
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !message) {
            showNotification('error', 'Campos requeridos', 'Por favor llena el título y el mensaje.');
            return;
        }

        setSending(true);
        const result = await sendMessage(
            businessId,
            targetClient ? targetClient.profile_id : null,
            title,
            message,
            type
        );

        if (result.success) {
            showNotification('success', '¡Enviado!', targetClient ? 'La notificación ha sido enviada al cliente.' : 'La notificación masiva ha sido enviada con éxito.');
            onClose();
            setTitle('');
            setMessage('');
            setType('GENERAL');
        } else {
            showNotification('error', 'Error de Envío', result.error);
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>

            {/* Modal Body */}
            <div className="relative w-full max-w-md bg-navy-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <form onSubmit={handleSubmit} className="p-8">
                    <header className="flex items-center gap-4 mb-8">
                        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_20px_rgba(57,224,121,0.2)]">
                            <span className="material-symbols-outlined !text-3xl font-black">campaign</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-tight">
                                {targetClient ? 'Mensaje Directo' : 'Notificación Masiva'}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
                                {targetClient ? `PARA: ${targetClient.profiles?.full_name}` : 'ESTRATEGIA DE FIDELIZACIÓN'}
                            </p>
                        </div>
                    </header>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 block">Asunto / Título</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-navy-dark border border-white/10 rounded-2xl h-14 px-5 text-sm outline-none focus:border-primary/50 transition-all font-bold placeholder:text-slate-600"
                                placeholder="Ej: ¡Tienes una oferta esperándote!"
                                required
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 block">Tipo de Notificación</label>
                            <div className="relative">
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full bg-navy-dark border border-white/10 rounded-2xl h-14 px-5 text-sm outline-none focus:border-primary/50 transition-all appearance-none font-bold text-white cursor-pointer"
                                >
                                    <option value="GENERAL">General / Informativa</option>
                                    <option value="PROMO">Promoción Especial</option>
                                    <option value="POINTS">Bono de Puntos</option>
                                    <option value="REWARD">Premio Disponible</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 block">Contenido del Mensaje</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-navy-dark border border-white/10 rounded-[2rem] h-36 p-6 text-sm outline-none focus:border-primary/50 transition-all resize-none font-medium text-slate-200 placeholder:text-slate-600 leading-relaxed"
                                placeholder="Escribe el mensaje detallado para tus clientes..."
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-14 rounded-full border border-white/10 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex-[1.5] bg-primary text-navy-dark h-14 rounded-full font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {sending ? (
                                <span className="animate-spin material-symbols-outlined text-sm">refresh</span>
                            ) : (
                                <span className="material-symbols-outlined text-sm font-black">send</span>
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
