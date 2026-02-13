import React from 'react';
import { useMessages } from '../context/MessageContext';

const MessageCenter = ({ isOpen, onClose }) => {
    const { messages, markAsRead, markAllAsRead, loading } = useMessages();

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
        <div className="fixed inset-0 z-[200] overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            {/* Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-navy-card shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-white/5">
                <header className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-white">Notificaciones</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Centro de Mensajes</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="size-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors group"
                    >
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white">close</span>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length > 0 ? (
                        <>
                            <div className="flex justify-end px-2">
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-black text-primary uppercase tracking-wider hover:opacity-80 transition-opacity"
                                >
                                    Marcar todo como leído
                                </button>
                            </div>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    onClick={() => !msg.read_at && markAsRead(msg.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.02] active:scale-[0.98] ${msg.read_at
                                            ? 'bg-white/5 border-transparent opacity-60'
                                            : 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black overflow-hidden border border-white/5">
                                                {msg.businesses?.logo_url ? (
                                                    <img src={msg.businesses.logo_url} className="w-full h-full object-cover" alt="Logo" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-primary text-sm">store</span>
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                                                {msg.businesses?.name || 'Sistema KPoint'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-bold">{formatTime(msg.created_at)}</span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1">{msg.title}</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">{msg.message}</p>

                                    {!msg.read_at && (
                                        <div className="mt-3 flex justify-end">
                                            <div className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(57,224,121,0.5)]"></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4 opacity-50">
                            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-500 !text-5xl">notifications_off</span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-white">Sin mensajes</h3>
                                <p className="text-xs text-slate-400">Te avisaremos cuando tengas nuevas noticias o premios disponibles.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageCenter;
