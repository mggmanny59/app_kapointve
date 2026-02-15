import React, { useEffect, useState } from 'react';

const Notification = ({ type = 'success', title, message, onClose, duration = 5000 }) => {
    const [isVisible, setIsVisible] = useState(true);

    // Auto-dismiss disabled per user request to force manual closure
    useEffect(() => {
        // We keep the useEffect structure if needed for other side effects, 
        // but the timer logic is removed.
    }, [onClose]);

    if (!isVisible) return null;

    const styles = {
        success: {
            border: 'border-primary/20',
            bg: 'bg-primary/10',
            icon: 'check_circle',
            iconColor: 'text-primary',
            glow: 'shadow-[0_0_30px_-10px_rgba(57,224,121,0.3)]'
        },
        error: {
            border: 'border-red-500/20',
            bg: 'bg-red-500/10',
            icon: 'error',
            iconColor: 'text-red-500',
            glow: 'shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]'
        }
    };

    const currentStyle = styles[type] || styles.success;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none">
            <div className={`max-w-sm w-full bg-navy-card border ${currentStyle.border} rounded-3xl p-6 shadow-2xl ${currentStyle.glow} flex flex-col items-center text-center gap-4 pointer-events-auto animate-in zoom-in fade-in duration-300`}>
                {/* Icon */}
                <div className={`size-16 rounded-full ${currentStyle.bg} flex items-center justify-center border ${currentStyle.border} mb-2`}>
                    <span className={`material-symbols-outlined !text-4xl ${currentStyle.iconColor} animate-bounce-short`}>
                        {currentStyle.icon}
                    </span>
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <h4 className="font-black text-white text-xl uppercase tracking-wider">
                        {title}
                    </h4>
                    <p className="text-base text-slate-400 font-medium leading-relaxed whitespace-pre-line">
                        {message}
                    </p>
                </div>

                {/* Button for center layout */}
                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className="mt-2 px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-base hover:bg-white/10 transition-colors w-full"
                >
                    Entendido
                </button>
            </div>
        </div>
    );
};

export default Notification;
