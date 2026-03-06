import React, { useEffect, useState } from 'react';

const Notification = ({ type = 'success', title, message, onClose, duration = 5000 }) => {
    const [isVisible, setIsVisible] = useState(true);

    // Auto-dismiss disabled per user request to force manual closure
    useEffect(() => {
    }, [onClose]);

    if (!isVisible) return null;

    const styles = {
        success: {
            border: 'border-green-100',
            bg: 'bg-green-50',
            icon: 'check_circle',
            iconColor: 'text-green-500',
            button: 'bg-green-500 text-white shadow-green-200'
        },
        error: {
            border: 'border-red-100',
            bg: 'bg-red-50',
            icon: 'report',
            iconColor: 'text-red-500',
            button: 'bg-red-500 text-white shadow-red-200'
        },
        warning: {
            border: 'border-amber-100',
            bg: 'bg-amber-50',
            icon: 'warning',
            iconColor: 'text-amber-500',
            button: 'bg-amber-500 text-white shadow-amber-200'
        }
    };

    const currentStyle = styles[type] || styles.success;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="max-w-[340px] w-full bg-white border border-white rounded-[2.5rem] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] flex flex-col items-center text-center animate-in zoom-in-95 duration-400">
                {/* Icon Circle */}
                <div className={`size-20 rounded-[2rem] ${currentStyle.bg} flex items-center justify-center border-4 border-white shadow-inner mb-6`}>
                    <span className={`material-symbols-outlined !text-4xl ${currentStyle.iconColor} font-black`}>
                        {currentStyle.icon}
                    </span>
                </div>

                {/* Content */}
                <div className="space-y-3 mb-8">
                    <h4 className="font-black text-slate-900 text-2xl tracking-tight leading-tight">
                        {title}
                    </h4>
                    <p className="text-sm text-slate-400 font-bold leading-relaxed px-2">
                        {message}
                    </p>
                </div>

                {/* Confirm Button */}
                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className={`w-full h-14 rounded-2xl ${currentStyle.button || 'bg-slate-900 text-white'} font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.97] hover:brightness-110 pointer-events-auto`}
                >
                    Entendido
                </button>
            </div>
        </div>
    );
};

export default Notification;
