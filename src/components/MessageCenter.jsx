import React from 'react';
import Icon from './Icon';
import { useMessages } from '../context/MessageContext';

const MessageCenter = ({ isOpen, onClose }) => {
    const { messages, markAsRead, markAllAsRead, deleteMessage, loading } = useMessages();

    if (!isOpen) return null;

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / 60000);
        if (diffInMinutes < 1) return 'Ahora';
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h`;
        return date.toLocaleDateString();
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-hidden antialiased">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500" onClick={onClose}></div>

            {/* Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-400 flex flex-col border-l border-[#595A5B]">
                <header className="p-8 border-b border-[#595A5B] flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Notificaciones</h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Centro de Actividad</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="size-11 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-400 active:scale-90 transition-all shadow-sm group"
                    >
                        <Icon name="close" className="!w-5 !h-5 group-hover:text-slate-900" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#f8fafc]/50">
                    {messages.length > 0 ? (
                        <>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevos Mensajes</span>
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:brightness-90 transition-all border-b border-primary/20"
                                >
                                    Marcar leídos
                                </button>
                            </div>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    onClick={() => !msg.read_at && markAsRead(msg.id)}
                                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer group hover:shadow-xl hover:-translate-y-1 relative overflow-hidden ${msg.read_at
                                        ? 'bg-white border-[#595A5B] opacity-70 shadow-sm'
                                        : 'bg-white border-primary/10 shadow-lg shadow-primary/5 ring-4 ring-primary/[0.02]'
                                        }`}
                                >
                                    {!msg.read_at && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-12 -mt-12" />}

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary shadow-inner border-2 border-[#595A5B] overflow-hidden">
                                                {msg.businesses?.logo_url ? (
                                                    <img src={msg.businesses.logo_url} className="w-full h-full object-cover" alt="Logo" />
                                                ) : (
                                                    <Icon name="storefront" className="!w-5 !h-5" />
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-slate-900 tracking-tight">
                                                {msg.businesses?.name || 'KPoint System'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">{formatTime(msg.created_at)}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Borrar esta notificación?')) {
                                                        deleteMessage(msg.id);
                                                    }
                                                }}
                                                className="size-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all border-2 border-[#595A5B]"
                                            >
                                                <Icon name="delete" className="!w-4 !h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-[15px] font-black text-slate-900 mb-2 leading-snug relative z-10">{msg.title}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed font-bold relative z-10">{msg.message}</p>

                                    {!msg.read_at && (
                                        <div className="mt-4 flex justify-end">
                                            <div className="px-3 py-1 rounded-full bg-primary text-white text-[8px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Nueva</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6">
                            <div className="size-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-200 border-2 border-[#595A5B] group shadow-inner">
                                <Icon name="notifications_off" className="!w-12 !h-12 group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Bandeja Vacía</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">No tienes actividad reciente en tu cuenta</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageCenter;
