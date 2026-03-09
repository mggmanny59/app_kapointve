import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNotification } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import MessageCenter from '../components/MessageCenter';
import Navigation from '../components/Navigation';
import { subscribeUserToPush, sendPushToProfile } from '../lib/pushNotifications';
import { forceAppUpdate } from '../utils/appUpdate';

const MyPoints = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loyaltyCards, setLoyaltyCards] = useState([]);
    const [profile, setProfile] = useState(null);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [businessPrizes, setBusinessPrizes] = useState([]);
    const [loadingPrizes, setLoadingPrizes] = useState(false);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [showRedemptionQR, setShowRedemptionQR] = useState(null);
    const [showMainQRModal, setShowMainQRModal] = useState(false);
    const { showNotification } = useNotification();
    const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
    const { unreadCount } = useMessages();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isProcessingScanner, setIsProcessingScanner] = useState(false);
    const [showPushBanner, setShowPushBanner] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        const handleOpenMessages = () => setIsMessageCenterOpen(true);
        window.addEventListener('open-message-center', handleOpenMessages);
        return () => window.removeEventListener('open-message-center', handleOpenMessages);
    }, []);

    const fetchBusinessPrizes = async (business) => {
        if (!business || !business.id) return;
        setSelectedBusiness(business);
        setLoadingPrizes(true);
        try {
            const { data, error } = await supabase
                .from('rewards')
                .select('*')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .order('cost_points', { ascending: true });

            if (error) throw error;
            setBusinessPrizes(data || []);
        } catch (err) {
            console.error('Error fetching business prizes:', err);
        } finally {
            setLoadingPrizes(false);
        }
    };

    const fetchUserData = async () => {
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profileData);

            const { data: cardsData, error: cardsError } = await supabase
                .from('loyalty_cards')
                .select('*, businesses(id, name, logo_url)')
                .eq('profile_id', user.id)
                .order('last_activity', { ascending: false });

            if (cardsError) throw cardsError;
            setLoyaltyCards(cardsData || []);

            const { data: txData } = await supabase
                .from('transactions')
                .select('*, businesses(name, logo_url)')
                .eq('profile_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            setRecentTransactions(txData || []);
        } catch (err) {
            console.error('Error fetching client data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchUserData();
    }, [user]);

    useEffect(() => {
        const checkPushStatus = async () => {
            if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

            if (Notification.permission === 'default') {
                // Nunca ha decidido -> mostrar banner
                setShowPushBanner(true);
            } else if (Notification.permission === 'granted') {
                // Tiene permiso: verificar si hay suscripción real
                const registration = await navigator.serviceWorker.ready;
                const sub = await registration.pushManager.getSubscription();
                if (sub) {
                    setIsSubscribed(true);
                    // Sincronizar con Supabase
                    await subscribeUserToPush();
                } else {
                    // Permiso dado pero suscripción perdida (ej: re-instalación)
                    setIsSubscribed(false);
                    setShowPushBanner(true);
                }
            } else {
                // 'denied' -> no podemos hacer nada
                setIsSubscribed(false);
            }
        };
        if (user) checkPushStatus();
    }, [user]);

    const handleEnablePush = async () => {
        try {
            const sub = await subscribeUserToPush();
            if (sub) {
                setShowPushBanner(false);
                setIsSubscribed(true);
                showNotification('success', '¡Excelente!', '¡Buzón digital registrado con éxito! Tu dispositivo ya puede recibir avisos de KPoint.');
            }
        } catch (error) {
            showNotification('warning', 'Aviso', `No se pudieron activar: ${error.message}`);
        }
    };

    useEffect(() => {
        if (!user) return;

        // Listener de Doble Seguridad: Broadcast Directo + Postgres Changes
        const channel = supabase
            .channel(`client-points-realtime-${user.id}`)
            .on('broadcast', { event: 'points_earned' }, (payload) => {
                console.log('¡Broadcast de puntos recibido!', payload);
                showNotification('success', '¡Puntos Recibidos!', `Acabas de ganar ${payload.payload.points} nuevos puntos en ${payload.payload.businessName}.`);
                fetchUserData();

                // Opción: Cerrar cualquier modal abierto (como el del código QR) para que vean el saldo
                setShowMainQRModal(false);
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('Cambio en base de datos detectado:', payload.new);
                fetchUserData();
                if (payload.new.type === 'EARN') {
                    // Solo mostramos si no hemos mostrado el broadcast ya
                    showNotification('success', '¡Saldo Actualizado!', `Has acumulado ${payload.new.points_amount} puntos.`);
                } else if (payload.new.type === 'REDEEM') {
                    showNotification('success', '¡Canje Procesado!', 'Tu premio ha sido procesado con éxito.');
                    setShowRedemptionQR(null);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'loyalty_cards',
                filter: `profile_id=eq.${user.id}`
            }, () => {
                fetchUserData();
            })
            .subscribe((status) => {
                console.log('Estado canal Realtime Cliente:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('--- Canal de Tiempo Real ACTIVADO para este cliente ---');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const startScanner = () => {
        setIsScannerOpen(true);
        setIsProcessingScanner(false);
        setTimeout(async () => {
            try {
                const container = document.getElementById("affiliation-reader");
                if (!container) return;
                const html5QrCode = new Html5Qrcode("affiliation-reader");
                window.affiliationScannerInstance = html5QrCode;
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 15, qrbox: { width: 250, height: 250 } },
                    onScanSuccess,
                    () => { }
                );
            } catch (err) {
                console.error('Scanner error:', err);
                showNotification('error', 'Error', 'No se pudo activar la cámara.');
            }
        }, 400);
    };

    const onScanSuccess = async (decodedText) => {
        try {
            if (window.affiliationScannerInstance) {
                await window.affiliationScannerInstance.stop().catch(() => { });
                window.affiliationScannerInstance = null;
            }
            setIsProcessingScanner(true);
            const { data: businessData, error: businessError } = await supabase
                .from('businesses')
                .select('id, name')
                .eq('business_code', decodedText)
                .single();

            if (businessError || !businessData) throw new Error('Código no válido.');

            const { error } = await supabase.from('loyalty_cards').insert({
                profile_id: user.id,
                business_id: businessData.id,
                current_points: 0
            });

            if (error) throw error;
            showNotification('success', '¡Afiliación Exitosa!', `Bienvenido a ${businessData.name}.`);
            setIsScannerOpen(false);
            fetchUserData();
        } catch (err) {
            showNotification('error', 'Error', err.message);
            setIsScannerOpen(false);
        } finally {
            setIsProcessingScanner(false);
        }
    };

    const closeScanner = async () => {
        setIsScannerOpen(false);
        if (window.affiliationScannerInstance) {
            await window.affiliationScannerInstance.stop().catch(() => { });
            window.affiliationScannerInstance = null;
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
            <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
        </div>
    );

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#F0F2F5] font-display text-slate-900 antialiased">
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden border-2 border-[#595A5B] shadow-sm">
                        <img src="/Logo KPoint Solo K (sin Fondo).png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Mis <span className="text-[rgb(255,101,14)]">Puntos</span></h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">MONEDERO DIGITAL</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { if (confirm('¿Buscar actualizaciones?')) forceAppUpdate(); }} className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined !text-[20px]">sync</span>
                    </button>
                    <button onClick={signOut} className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-300 shadow-sm">
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>

            {/* Banner de Notificaciones para Clientes */}
            {showPushBanner && (
                <div className="mx-6 mb-6 p-5 bg-navy-card rounded-[2rem] border-2 border-[#F59E0B] shadow-xl animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="size-14 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] border border-[#F59E0B]/20">
                            <span className="material-symbols-outlined !text-3xl">notifications_active</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">¡Deseas recibir avisos!</h3>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">Entérate de inmediato cuando ganes puntos o canjees tus premios favoritos.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleEnablePush}
                            className="flex-1 bg-primary text-white h-11 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            Activar ahora
                        </button>
                        <button
                            onClick={() => setShowPushBanner(false)}
                            className="px-5 h-11 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                        >
                            Después
                        </button>
                    </div>
                </div>
            )}

            <main className="px-6 py-4 space-y-6">
                {/* Welcome Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(255,101,14)] to-[#e65a0c] p-8 rounded-[2.5rem] shadow-xl text-white">
                    <p className="text-2xl font-bold opacity-90">¡Hola!</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tight">{profile?.full_name?.split(' ')[0] || 'Cliente'}</h2>
                    <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-2xl border border-white/30">
                        <span className="material-symbols-outlined text-white text-base font-black">stars</span>
                        <p className="text-white text-[10px] font-black uppercase tracking-[0.15em]">¡TODO LISTO PARA GANAR!</p>
                    </div>

                    {/* Indicador de Alertas Push */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`size-2.5 rounded-full ${isSubscribed ? 'bg-green-300 shadow-[0_0_8px_rgba(134,239,172,0.8)]' : 'bg-white/50'}`}></div>
                            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                                {isSubscribed ? 'Alertas Activas' : 'Alertas Desactivadas'}
                            </span>
                        </div>
                        {!isSubscribed && (
                            <button
                                onClick={handleEnablePush}
                                className="text-[10px] font-black bg-white/25 text-white border border-white/40 px-3 py-1.5 rounded-xl hover:bg-white/40 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                Activar
                            </button>
                        )}
                    </div>

                    <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-white/[0.07] !text-[180px] font-black rotate-12">account_balance_wallet</span>
                </div>

                {/* QR Section */}
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-[#595A5B] flex flex-col items-center gap-6">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-slate-900 uppercase">MI CÓDIGO QR</h3>
                        <p className="text-[13px] font-bold text-slate-500">Muestra esto en caja para sumar puntos</p>
                    </div>
                    <div className="p-2 bg-white rounded-[2rem] border-2 border-[#595A5B] shadow-inner">
                        <div className="size-40 bg-white rounded-[1.5rem] flex items-center justify-center p-5 border-2 border-[#595A5B]">
                            <QRCodeSVG value={user?.id || ''} size={120} level="H" />
                        </div>
                    </div>
                    <button onClick={() => setShowMainQRModal(true)} className="w-full bg-[rgb(255,101,14)] text-white h-16 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3">
                        ESCANEO EN CAJA <span className="material-symbols-outlined">qr_code_2</span>
                    </button>
                </div>

                {/* Affiliation CTA */}
                <div onClick={startScanner} className="bg-white border-2 border-[#595A5B] p-6 rounded-[2.5rem] flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-5">
                        <div className="size-16 rounded-[1.25rem] bg-[rgb(255,101,14)]/10 flex items-center justify-center text-[rgb(255,101,14)] border border-[rgb(255,101,14)]/20">
                            <span className="material-symbols-outlined !text-4xl font-black">add_business</span>
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 uppercase">AFILIARME</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Escanea el código del local</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                </div>

                {/* Businesses List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase">Mis Comercios</h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                        {loyaltyCards.map((card) => (
                            <div key={card.id} onClick={() => fetchBusinessPrizes(card.businesses)} className="min-w-[280px] bg-[rgb(255,150,32)] p-4 rounded-[2rem] border-2 border-[#595A5B] snap-center cursor-pointer shadow-lg">
                                {/* Top Section: Logo + Points Box */}
                                <div className="flex items-center gap-3 mb-3">
                                    {/* Logo Container */}
                                    <div className="size-20 min-w-[80px] rounded-[1.5rem] bg-white border-2 border-[#595A5B] p-2.5 flex items-center justify-center overflow-hidden shadow-sm">
                                        {card.businesses?.logo_url ? <img src={card.businesses.logo_url} className="w-full h-full object-contain" /> : <span className="material-symbols-outlined text-primary text-4xl">store</span>}
                                    </div>

                                    {/* Points Box */}
                                    <div className="flex-1 bg-white border-2 border-[#595A5B] rounded-[1.25rem] p-2.5 flex justify-between items-center shadow-inner">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">Saldo</span>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="material-symbols-outlined text-amber-500 text-base font-black">stars</span>
                                                <span className="text-lg font-black text-slate-900 leading-none">{card.current_points}</span>
                                            </div>
                                        </div>
                                        <div className="size-6 min-w-[24px] rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-400 text-xs">chevron_right</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Section: Business Name */}
                                <div className="px-1">
                                    <h3 className="font-extrabold text-slate-900 text-lg leading-tight line-clamp-1">
                                        {card.businesses?.name}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Section */}
                {recentTransactions.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h2 className="text-[11px] font-black text-slate-500 uppercase">Actividad Reciente</h2>
                            <button onClick={() => navigate('/activity-history')} className="text-[10px] font-black text-primary uppercase">Ver Todas</button>
                        </div>
                        <div className="bg-white rounded-[2rem] border-2 border-[#595A5B] shadow-sm overflow-hidden flex flex-col">
                            {recentTransactions.slice(0, 3).map((tx, idx) => (
                                <div key={tx.id} className={`py-2 px-4 flex items-center justify-between ${idx !== recentTransactions.slice(0, 3).length - 1 ? 'border-b border-slate-50' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`size-10 rounded-xl flex items-center justify-center border ${tx.type === 'EARN' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                                            <span className="material-symbols-outlined text-xl">{tx.type === 'EARN' ? 'add_task' : 'redeem'}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 leading-tight">{tx.businesses?.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{new Date(tx.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-sm ${tx.type === 'EARN' ? 'text-primary' : 'text-warning'}`}>{tx.type === 'EARN' ? '+' : ''}{tx.points_amount} pts</p>
                                        <p className="text-[9px] text-slate-400 uppercase font-black">{tx.type === 'EARN' ? 'ACUMULADO' : 'CANJEADO'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Modals */}
            {/* Premium Rewards Gallery */}
            {/* Premium Rewards Gallery - Light Version */}
            {selectedBusiness && (
                <div className="fixed inset-0 z-[60] bg-white overflow-y-auto pb-32">
                    {/* Header */}
                    <div className="sticky top-0 px-6 pt-8 pb-4 bg-white/90 backdrop-blur-xl z-50 flex items-center justify-between border-b border-slate-100">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-500 font-black text-2xl">card_giftcard</span>
                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Canje de Premios</h1>
                            </div>

                            <div className="flex items-center gap-2 mt-2.5 bg-slate-50 border border-slate-200 pl-3 pr-4 py-1.5 rounded-2xl w-fit shadow-sm">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Tu Saldo:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-lg text-amber-500 font-black">stars</span>
                                    <span className="text-base font-black text-amber-600 leading-none">
                                        {loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points || 0}
                                        <span className="text-[10px] ml-0.5 text-amber-500/80">PTS</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedBusiness(null)}
                            className="size-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 flex items-center justify-center active:scale-90 transition-all"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="p-6">
                        {businessPrizes.length > 0 ? (
                            <div className="grid grid-cols-1 gap-5">
                                {businessPrizes.map(p => {
                                    const userPoints = loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points || 0;
                                    const isAffordable = userPoints >= p.cost_points;
                                    const progress = Math.min((userPoints / p.cost_points) * 100, 100);

                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => isAffordable && setShowRedemptionQR(p)}
                                            className={`relative bg-white rounded-[2rem] border-2 transition-all p-1 overflow-hidden shadow-lg shadow-slate-200/50 ${isAffordable ? 'border-[#22C55E] scale-100 active:scale-[0.98]' : 'border-rose-400/40 opacity-95'}`}
                                        >
                                            <div className="flex items-center gap-4 p-4">
                                                {/* Prize Image Container */}
                                                <div className="size-24 min-w-[96px] bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-slate-300 !text-4xl">inventory_2</span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="text-sm font-black text-slate-900 uppercase truncate pr-2">{p.name}</h4>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAffordable ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-rose-100 text-rose-600'}`}>
                                                            {isAffordable ? 'LISTO' : 'BLOQUEADO'}
                                                        </span>
                                                    </div>

                                                    {p.description && (
                                                        <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2 mb-3">
                                                            {p.description}
                                                        </p>
                                                    )}

                                                    <div className="flex items-center justify-between mt-auto">
                                                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                                                            <span className="material-symbols-outlined text-amber-500 text-sm font-black">stars</span>
                                                            <span className="text-xs font-black text-amber-600">{p.cost_points} PTS</span>
                                                        </div>

                                                        {isAffordable ? (
                                                            <div className="size-8 rounded-full bg-[#22C55E] flex items-center justify-center text-white shadow-lg shadow-[#22C55E]/20">
                                                                <span className="material-symbols-outlined font-black text-lg">check</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-right">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Faltan {p.cost_points - userPoints} pts</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar for Locked Rewards - Subtle version */}
                                            {!isAffordable && (
                                                <div className="h-1.5 w-full bg-slate-50 flex border-t border-slate-100">
                                                    <div
                                                        className="h-full bg-amber-400 transition-all duration-500"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-100">sentiment_dissatisfied</span>
                                <p className="mt-4 text-slate-400 font-bold">Aún no hay premios cargados para este negocio.</p>
                            </div>
                        )}
                    </div>

                    {/* Persuasive Bottom Banner - Solid & Fixed */}
                    <div className="fixed bottom-0 left-0 right-0 p-5 pb-8 bg-primary shadow-[0_-10px_40px_rgba(34,197,94,0.2)] flex items-center gap-4 border-t border-white/10 z-[70] rounded-t-[2.5rem]">
                        <div className="size-12 min-w-[48px] bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white font-black text-2xl">rocket_launch</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[14px] font-black text-white leading-tight uppercase tracking-tight">¡Llega más lejos!</h4>
                            <p className="text-[12px] text-white/90 font-medium leading-tight">
                                Cada visita te acerca a tu próximo premio. ¡Sigue sumando y desbloquea beneficios hoy!
                            </p>
                        </div>
                        <span className="material-symbols-outlined text-white/40 text-xl">chevron_right</span>
                    </div>
                </div>
            )}

            {showRedemptionQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 border-2 border-[#595A5B]">
                        <h3 className="text-xl font-black uppercase">Canje</h3>
                        <QRCodeSVG value={`REDEEM:${user?.id}:${showRedemptionQR.id}`} size={200} level="H" />
                        <button onClick={() => setShowRedemptionQR(null)} className="w-full h-14 bg-slate-100 rounded-full font-black">CERRAR</button>
                    </div>
                </div>
            )}

            {showMainQRModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 border-2 border-[#595A5B]">
                        <h3 className="text-xl font-black uppercase tracking-widest text-primary">Mi Código</h3>
                        <div className="p-4 bg-white border-4 border-primary/20 rounded-3xl">
                            <QRCodeSVG value={user?.id || ''} size={200} level="H" />
                        </div>
                        <button onClick={() => setShowMainQRModal(false)} className="w-full h-14 bg-primary text-white rounded-full font-black uppercase">ENTENDIDO</button>
                    </div>
                </div>
            )}

            {isScannerOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 border-2 border-[#595A5B]">
                        <h3 className="text-xl font-black uppercase">Afiliar</h3>
                        <div id="affiliation-reader" className="w-full min-h-[250px] bg-slate-50 rounded-2xl"></div>
                        <button onClick={closeScanner} className="w-full h-14 bg-slate-100 rounded-full font-black">CANCELAR</button>
                    </div>
                </div>
            )}

            <Navigation />
            <MessageCenter isOpen={isMessageCenterOpen} onClose={() => setIsMessageCenterOpen(false)} />
        </div>
    );
};

export default MyPoints;
