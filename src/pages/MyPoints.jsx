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
import { subscribeUserToPush, sendPushToProfile, unsubscribeUserFromPush } from '../lib/pushNotifications';
import { forceAppUpdate } from '../utils/appUpdate';

const MyPoints = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loyaltyCards, setLoyaltyCards] = useState([]);
    const [profile, setProfile] = useState(null);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [businessPrizes, setBusinessPrizes] = useState([]);
    const [businessPromotions, setBusinessPromotions] = useState([]);
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
            // Fetch Rewards
            const { data: prizes, error: prizesError } = await supabase
                .from('rewards')
                .select('*')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .order('cost_points', { ascending: true });

            if (prizesError) throw prizesError;
            setBusinessPrizes(prizes || []);

            // Fetch Promotions
            const now = new Date();
            const { data: promos, error: promosError } = await supabase
                .from('promotions')
                .select('*')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (promosError) throw promosError;

            // Filter promotions locally to guarantee local timezone accuracy
            // Start of today locally
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const activePromos = promos?.filter(p => {
                const pStartTz = new Date(p.start_date);
                const pEndTz = new Date(p.end_date);
                
                // Extract just the local day/month/year from the converted timestamp
                const pStart = new Date(pStartTz.getFullYear(), pStartTz.getMonth(), pStartTz.getDate());
                const pEnd = new Date(pEndTz.getFullYear(), pEndTz.getMonth(), pEndTz.getDate());
                
                return startOfToday >= pStart && startOfToday <= pEnd;
            }) || [];

            setBusinessPromotions(activePromos);

        } catch (err) {
            console.error('Error fetching business data:', err);
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

    const handleDisablePush = async () => {
        try {
            await unsubscribeUserFromPush();
            setIsSubscribed(false);
            showNotification('success', 'Aviso', 'Alertas desactivadas correctamente. El buzón fue borrado.');
        } catch (error) {
            showNotification('error', 'Error', 'No se pudieron desactivar las alertas.');
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
                
                // Actualización optimista del estado local
                setLoyaltyCards(prev => prev.map(card => {
                    if (card.businesses?.name === payload.payload.businessName) {
                        return { 
                            ...card, 
                            current_points: Number(card.current_points) + Number(payload.payload.points) 
                        };
                    }
                    return card;
                }));

                setTimeout(() => fetchUserData(), 1000);

                // Opción: Cerrar cualquier modal abierto (como el del código QR) para que vean el saldo
                setShowMainQRModal(false);
            })
            .on('broadcast', { event: 'reward_redeemed' }, (payload) => {
                console.log('¡Broadcast de CANJE recibido!', payload);
                showNotification('success', '¡BRUTAL! ¡YA ES TUYO! 🎁✨', `¡Woooow! Acabas de canjear "${payload.payload.prizeName}" en ${payload.payload.businessName}. ¡Te lo mereces! Disfrútalo al máximo. 🥳🔥`);
                
                // Actualización optimista del estado local
                setLoyaltyCards(prev => prev.map(card => {
                    if (card.businesses?.name === payload.payload.businessName) {
                        return { 
                            ...card, 
                            current_points: Math.max(0, Number(card.current_points) - Number(payload.payload.pointsSpent)) 
                        };
                    }
                    return card;
                }));

                setTimeout(() => fetchUserData(), 1000);
                
                // Solo cerrar modal del QR de canje (no salir de la vista del comercio)
                setShowRedemptionQR(null);
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('Cambio en base de datos detectado:', payload.new);
                
                // Actualización optimista hiper-rápida (en línea)
                if (payload.new && payload.new.points_amount) {
                    setLoyaltyCards(prev => prev.map(card => {
                        if (card.business_id === payload.new.business_id) {
                            return {
                                ...card,
                                current_points: Math.max(0, Number(card.current_points) + Number(payload.new.points_amount))
                            };
                        }
                        return card;
                    }));
                }

                setTimeout(() => fetchUserData(), 1500);

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
                setTimeout(() => fetchUserData(), 1000);
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

    // Redundancia Activa (Polling) cuando el cliente está esperando que le escaneen un premio
    useEffect(() => {
        if (!showRedemptionQR || !selectedBusiness || !user) return;

        const checkBalanceInterval = setInterval(async () => {
            try {
                const { data } = await supabase
                    .from('loyalty_cards')
                    .select('current_points')
                    .eq('profile_id', user.id)
                    .eq('business_id', selectedBusiness.id)
                    .single();
                
                if (data) {
                    const currentLocalPoints = loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points || 0;
                    
                    // Si los puntos bajaron en la DB, ¡el cajero escaneó!
                    if (data.current_points < currentLocalPoints) {
                        clearInterval(checkBalanceInterval);
                        
                        // Refrescar restando los puntos en TODOS LOS CAMPOS de la App optimísticamente
                        setLoyaltyCards(prev => prev.map(card => {
                            if (card.business_id === selectedBusiness.id) {
                                return { ...card, current_points: data.current_points };
                            }
                            return card;
                        }));
                        
                        showNotification('success', '¡Canje Efectuado!', `Tu premio "${showRedemptionQR.name}" ha sido reclamado satisfactoriamente.`);
                        setShowRedemptionQR(null);
                        fetchUserData(); // Actualización final
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }, 2000); // 2 segundos

        return () => clearInterval(checkBalanceInterval);
    }, [showRedemptionQR, selectedBusiness, user, loyaltyCards]);

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
            <header className="pt-8 pb-4 px-6 sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40 flex flex-col gap-4">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden border-2 border-[#595A5B] shadow-sm">
                            <img src="/Logo KPoint Solo K (sin Fondo).png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">Dashboard</h1>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tablero de Mando</p>
                        </div>
                    </div>
                </div>

                {/* Second row for Logout button */}
                <div className="flex justify-end pr-1">
                    <button
                        onClick={signOut}
                        className="h-10 pl-2 pr-5 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center gap-2 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm active:scale-95 group shrink-0"
                    >
                        <div className="size-7 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                            <span className="material-symbols-outlined !text-base font-black text-red-500 group-hover:text-white">logout</span>
                        </div>
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em] mt-0.5 group-hover:text-white">Cerrar Sesión</span>
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
                <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(255,101,14)] to-[#e65a0c] p-6 rounded-[2.5rem] shadow-xl text-white animate-zoom-in-custom">
                    <p className="text-lg font-bold opacity-90 animate-slide-left-custom delay-200-custom fill-mode-both">¡Hola!</p>
                    <h2 className="text-3xl font-black mt-1 tracking-tight animate-slide-left-custom delay-300-custom fill-mode-both">{profile?.full_name?.split(' ')[0] || 'Cliente'}</h2>
                    
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-2xl border border-white/30 animate-slide-bottom-custom delay-500-custom fill-mode-both shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        <span className="material-symbols-outlined text-white text-base font-black animate-pulse">stars</span>
                        <p className="text-white text-[9px] font-black uppercase tracking-[0.15em]">¡TODO LISTO PARA GANAR!</p>
                    </div>

                    {/* Indicador de Alertas Push */}
                    <div className="relative z-10 mt-3 flex items-center justify-between animate-fade-in-custom delay-700-custom fill-mode-both">
                        <div className="flex items-center gap-2">
                            <div className={`size-2.5 rounded-full ${isSubscribed ? 'bg-green-300 shadow-[0_0_12px_rgba(134,239,172,0.8)]' : 'bg-white/50'}`}></div>
                            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest leading-none">
                                {isSubscribed ? 'Alertas Activas' : 'Alertas Desactivadas'}
                            </span>
                        </div>
                        {isSubscribed ? (
                            <button
                                onClick={handleDisablePush}
                                className="text-[10px] font-black bg-white/10 text-white/70 border border-white/20 px-3 py-1.5 rounded-xl hover:bg-white/20 active:scale-95 transition-all uppercase tracking-widest leading-none"
                            >
                                Desactivar
                            </button>
                        ) : (
                            <button
                                onClick={handleEnablePush}
                                className="text-[10px] font-black bg-white/25 text-white border border-white/40 px-3 py-1.5 rounded-xl hover:bg-white/40 active:scale-95 transition-all uppercase tracking-widest leading-none"
                            >
                                Activar
                            </button>
                        )}
                    </div>

                    {/* Icono decorativo con animación flotante */}
                    <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-white/[0.07] !text-[140px] font-black rotate-12 pointer-events-none select-none animate-bounce [animation-duration:3s]">account_balance_wallet</span>
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

                {/* Legal Links Footer */}
                <div className="pt-8 pb-4 flex flex-col items-center gap-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">KPoint Loyalty Platform</p>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/terms')} className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline">Términos</button>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        <button onClick={() => navigate('/privacy')} className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline">Privacidad</button>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {/* Premium Rewards Gallery */}
            {/* Premium Rewards Gallery - Light Version */}
            {selectedBusiness && (
                <div className="fixed inset-0 z-[60] bg-white overflow-y-auto pb-32">
                    {/* Header */}
                    <div className="sticky top-0 bg-white z-50">
                        <div className="px-6 pt-8 pb-4 flex items-center justify-between">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary font-black text-3xl">card_giftcard</span>
                                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Canje de Premios</h1>
                                </div>

                                <div className="flex items-center gap-3 mt-3 bg-slate-50 border-2 border-slate-200 pl-4 pr-5 py-2.5 rounded-[1.5rem] w-fit shadow-md">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Tu Saldo:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-2xl text-amber-500 font-black">stars</span>
                                        <span className="text-2xl font-black text-amber-600 leading-none tracking-tight">
                                            {loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points || 0}
                                            <span className="text-xs ml-1 font-black text-amber-500/80">PTS</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedBusiness(null)}
                                className="size-12 rounded-full bg-slate-50 border border-slate-200 text-slate-900 flex items-center justify-center active:scale-90 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined !text-2xl">close</span>
                            </button>
                        </div>

                        {/* Orange Banner Section */}
                        <div className="relative mb-14 px-6">
                            <div className="w-full h-24 bg-primary rounded-b-[2.5rem] shadow-xl shadow-primary/30"></div>
                            
                            {/* Logo Circle with defined border */}
                            <div className="absolute left-1/2 -bottom-14 -translate-x-1/2">
                                <div className="size-28 rounded-full border-2 border-[#595A5B] bg-white shadow-xl flex items-center justify-center overflow-hidden">
                                    {selectedBusiness?.logo_url ? (
                                        <img src={selectedBusiness.logo_url} alt={selectedBusiness.name} className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <span className="material-symbols-outlined text-primary !text-4xl font-black">store</span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Logo</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-2 mb-20 space-y-8">
                        {/* Promotions Section */}
                        {businessPromotions.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary font-black">celebration</span>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Promociones del Momento ({businessPromotions.length})</h3>
                                    </div>
                                    {businessPromotions.length > 1 && (
                                        <div className="flex items-center gap-1 text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse">
                                            <span className="text-[9px] font-black uppercase tracking-wider">Desliza</span>
                                            <span className="material-symbols-outlined !text-[14px]">arrow_forward</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-6 px-[7.5vw] snap-x snap-mandatory">
                                    {businessPromotions.map(promo => (
                                        <div key={promo.id} className="w-[85vw] min-w-[85vw] max-w-[85vw] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] shrink-0 bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-100/50 flex flex-col snap-center">
                                            <div className="h-[220px] w-full relative bg-slate-50 border-b border-slate-100">
                                                <img 
                                                    src={promo.image_url.startsWith('http') ? promo.image_url : `/${promo.image_url}`} 
                                                    alt={promo.title} 
                                                    className="w-full h-full object-contain p-2" 
                                                />
                                                <div className="absolute top-4 right-4 bg-primary text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg z-10">
                                                    ¡ACTIVA!
                                                </div>
                                            </div>
                                            <div className="p-5 flex flex-col justify-center flex-1">
                                                <h4 className="font-black text-slate-900 uppercase leading-tight mb-2 whitespace-normal">{promo.title}</h4>
                                                <p className="text-[12px] text-slate-500 font-medium leading-relaxed mb-4 whitespace-normal line-clamp-3">{promo.description}</p>
                                                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-auto">
                                                    <span className="material-symbols-outlined !text-sm text-slate-400">calendar_today</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Válido hasta el {new Date(promo.end_date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rewards Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <span className="material-symbols-outlined text-primary font-black">card_giftcard</span>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Premios por Fidelidad</h3>
                            </div>
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

                        {businessPrizes.length === 0 && businessPromotions.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-100">sentiment_dissatisfied</span>
                                <p className="mt-4 text-slate-400 font-bold">Aún no hay premios ni promociones cargadas para este negocio.</p>
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
                    <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 flex flex-col items-center gap-6 border-4 border-primary/20 shadow-2xl relative overflow-hidden">
                        
                        <div className="text-center w-full">
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{showRedemptionQR.name}</h3>
                            <p className="text-[13px] font-medium text-slate-500 py-2 leading-tight">
                                {showRedemptionQR.description || 'Pide en la caja que escaneen tu código.'}
                            </p>
                            <div className="flex items-center justify-center gap-1.5 mt-2 bg-amber-50 mx-auto w-max px-4 py-1.5 rounded-full border border-amber-100">
                                <span className="material-symbols-outlined text-amber-500 font-black">stars</span>
                                <span className="font-black text-amber-600 text-[15px]">{showRedemptionQR.cost_points} Pts Requeridos</span>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm">
                            <QRCodeSVG value={JSON.stringify({ type: 'REDEEM_REQUEST', clientId: user?.id, prizeId: showRedemptionQR.id })} size={190} level="H" />
                        </div>
                        
                        <button onClick={() => setShowRedemptionQR(null)} className="w-full h-14 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full font-black text-slate-700 tracking-wider">CERRAR CÓDIGO</button>
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
