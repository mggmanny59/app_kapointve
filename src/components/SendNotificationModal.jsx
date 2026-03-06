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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 antialiased">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose}></div>

            {/* Modal Body */}
            <div className="relative w-full max-w-md bg-white border-2 border-[#595A5B] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-400">
                <form onSubmit={handleSubmit} className="p-10">
                    <header className="flex items-center gap-5 mb-10">
                        <div className="size-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-xl shadow-primary/5">
                            <span className="material-symbols-outlined !text-3xl font-black">campaign</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                {targetClient ? 'Mensaje Directo' : 'Aviso Masivo'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                                {targetClient ? `DESTINO: ${targetClient.full_name || 'CLIENTE'}` : 'ESTRATEGIA FIDELIZACIÓN'}
                            </p>
                        </div>
                    </header>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Título del Mensaje</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-[#f8fafc] border-2 border-[#595A5B] rounded-[1.25rem] h-16 px-6 text-[15px] outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all font-bold text-slate-900 placeholder:text-slate-300 shadow-inner"
                                placeholder="Ej: ¡Hoy tenemos café 2x1!"
                                required
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Categoría</label>
                            <div className="relative">
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full bg-[#f8fafc] border-2 border-[#595A5B] rounded-[1.25rem] h-16 px-6 text-[15px] outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all appearance-none font-bold text-slate-900 cursor-pointer shadow-inner pr-12"
                                >
                                    <option value="GENERAL">General / Informativa</option>
                                    <option value="PROMO">Promoción Especial</option>
                                    <option value="POINTS">Bono de Puntos</option>
                                    <option value="REWARD">Premio Disponible</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none !text-xl font-black">expand_more</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Cuerpo del Mensaje</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-[#f8fafc] border-2 border-[#595A5B] rounded-[1.5rem] h-40 p-6 text-[15px] outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all resize-none font-bold text-slate-600 placeholder:text-slate-300 shadow-inner leading-relaxed"
                                placeholder="Detalla aquí la información importante para tus clientes..."
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-16 rounded-[1.25rem] bg-slate-50 border-2 border-[#595A5B] font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
                        >
                            Cerrar
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex-[1.8] bg-slate-900 text-white h-16 rounded-[1.25rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover:bg-slate-800"
                        >
                            {sending ? (
                                <span className="animate-spin material-symbols-outlined !text-xl">refresh</span>
                            ) : (
                                <span className="material-symbols-outlined !text-xl font-black">send</span>
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
