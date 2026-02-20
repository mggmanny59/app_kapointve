import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNotification } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import MessageCenter from '../components/MessageCenter';

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
    const [showRedemptionQR, setShowRedemptionQR] = useState(null); // Local state for the QR modal
    const [showMainQRModal, setShowMainQRModal] = useState(false); // New state for main QR modal
    const { showNotification } = useNotification();
    const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
    const { unreadCount } = useMessages();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isProcessingScanner, setIsProcessingScanner] = useState(false);

    const fetchBusinessPrizes = async (business) => {
        console.log('Opening prizes for:', business?.name);
        if (!business || !business.id) {
            console.warn('Invalid business data:', business);
            return;
        }

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
            console.log('Prizes fetched:', data?.length);
            setBusinessPrizes(data || []);
        } catch (err) {
            console.error('Error fetching business prizes:', err);
        } finally {
            setLoadingPrizes(false);
        }
    };

    const fetchUserData = async () => {
        try {
            // 1. Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profileData);

            // 2. Fetch Loyalty Cards (points in different businesses)
            const { data: cardsData, error: cardsError } = await supabase
                .from('loyalty_cards')
                .select('*, businesses(id, name, logo_url)')
                .eq('profile_id', user.id)
                .order('last_activity', { ascending: false });

            if (cardsError) throw cardsError;
            setLoyaltyCards(cardsData || []);

            // 3. Fetch Recent Transactions
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

    // REAL-TIME REDEMPTION & POINTS LISTENER
    useEffect(() => {
        if (!user) return;

        console.log('Configurando escucha Realtime para el usuario:', user.id);

        const channel = supabase
            .channel(`client-updates-${user.id}`)
            // 1. Listen for new REDEEM transactions
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('Nueva transacción detectada:', payload.new.type);
                if (payload.new.type === 'REDEEM') {
                    showNotification('success', '¡Canje Confirmado!', 'Tu premio ha sido procesado con éxito.');
                    setShowRedemptionQR(null);
                    fetchUserData();
                }
            })
            // 2. Listen for point updates in loyalty cards (Fallback/Double Check)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'loyalty_cards',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('Actualización de puntos detectada en tarjeta.');
                fetchUserData();
                // If the QR is open, close it because points changed (likely due to a scan)
                if (showRedemptionQR) {
                    setShowRedemptionQR(null);
                    showNotification('info', 'Puntos Actualizados', 'Tu saldo se ha actualizado correctamente.');
                }
            })
            .subscribe((status) => {
                console.log('Estado de suscripción Realtime:', status);
            });

        return () => {
            console.log('Limpiando canal Realtime');
            supabase.removeChannel(channel);
        };
    }, [user, showRedemptionQR]); // Added showRedemptionQR to check its state inside the update listener

    const startScanner = () => {
        setIsScannerOpen(true);
        setIsProcessingScanner(false);
        setTimeout(async () => {
            try {
                const container = document.getElementById("affiliation-reader");
                if (!container) return;

                if (window.affiliationScannerInstance) {
                    await window.affiliationScannerInstance.stop().catch(() => { });
                }

                const html5QrCode = new Html5Qrcode("affiliation-reader");
                window.affiliationScannerInstance = html5QrCode;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 15, qrbox: { width: 250, height: 250 } },
                    onScanSuccess,
                    (errorMessage) => { }
                );
            } catch (err) {
                console.error('Final scanner error:', err);
                showNotification('error', 'Error de Cámara', 'No se pudo activar la cámara.');
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

            // 1. Find the business by code
            const { data: businessData, error: businessError } = await supabase
                .from('businesses')
                .select('id, name')
                .eq('business_code', decodedText)
                .single();

            if (businessError || !businessData) {
                throw new Error('Código de comercio no válido.');
            }

            // 2. Check if already affiliated
            const isAlreadyAffiliated = loyaltyCards.some(card => card.business_id === businessData.id);
            if (isAlreadyAffiliated) {
                showNotification('info', 'Ya estás afiliado', `Ya tienes una tarjeta en ${businessData.name}.`);
                setIsScannerOpen(false);
                return;
            }

            // 3. Create the loyalty card
            const { error: affiliationError } = await supabase
                .from('loyalty_cards')
                .insert({
                    profile_id: user.id,
                    business_id: businessData.id,
                    current_points: 0
                });

            if (affiliationError) throw affiliationError;

            showNotification('success', '¡Afiliación Exitosa!', `Bienvenido al club de ${businessData.name}.`);
            setIsScannerOpen(false);
            fetchUserData();
        } catch (err) {
            console.error('Affiliation error:', err);
            showNotification('error', 'Error de Afiliación', err.message);
            setIsScannerOpen(false);
        } finally {
            setIsProcessingScanner(false);
        }
    };

    const closeScanner = async () => {
        setIsScannerOpen(false);
        setIsProcessingScanner(false);
        if (window.affiliationScannerInstance) {
            await window.affiliationScannerInstance.stop().catch(() => { });
            window.affiliationScannerInstance = null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-navy-dark flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-navy-dark font-display text-white antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-navy-dark/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden">
                        <img
                            src="/Logo KPoint Solo K (sin Fondo).png"
                            alt="Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight">Mis <span className="text-primary">Puntos</span></h1>
                        <p className="text-[10px] text-slate-subtitle font-bold uppercase tracking-widest">Monedero Digital</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsMessageCenterOpen(true)}
                        className="w-10 h-10 rounded-full bg-navy-card border border-border-subtle flex items-center justify-center relative group active:scale-90 transition-all font-display"
                    >
                        <span className="material-symbols-outlined text-slate-subtitle group-hover:text-primary transition-colors">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-primary text-navy-dark text-[10px] font-black rounded-full border-2 border-navy-dark flex items-center justify-center shadow-lg">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-navy-card border border-border-subtle flex items-center justify-center hover:text-red-500 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>

            <main className="px-6 py-4 space-y-6">
                {/* Welcome Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-primary to-green-700 p-6 rounded-card shadow-xl min-h-[160px] flex flex-col justify-center">
                    <div className="relative z-10">
                        <p className="text-white/90 text-2xl font-bold">¡Hola!</p>
                        <h2 className="text-3xl font-black text-white mt-1 leading-tight">
                            {profile?.full_name?.split(' ')[0] || 'Cliente'}
                        </h2>
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-navy-dark/30 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl animate-in slide-in-from-left duration-700">
                            <span className="material-symbols-outlined text-primary text-sm font-black">stars</span>
                            <p className="text-white text-xs font-black uppercase tracking-[0.1em] leading-none">
                                ¡Todo listo para ganar!
                            </p>
                        </div>
                    </div>

                    {/* Animated Reward Icon */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 animate-float">
                        <div className="relative">
                            <span className="material-symbols-outlined text-white/90 !text-7xl drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">redeem</span>
                            <div className="absolute -top-1 -right-1 size-5 bg-accent rounded-full border-2 border-primary animate-pulse"></div>
                        </div>
                    </div>

                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white/5 !text-[150px] font-black pointer-events-none">
                        account_balance_wallet
                    </span>
                </div>

                {/* QR Access Section */}
                <div className="bg-navy-card border border-border-subtle p-6 rounded-card shadow-lg flex flex-col items-center gap-4">
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-black text-white tracking-tight uppercase leading-none">Mi Código QR</h3>
                        <p className="text-[13px] font-bold text-slate-300 tracking-tight leading-relaxed">
                            <span className="text-primary mr-1">¡Listo para ganar!</span>
                            Muéstralo en caja para sumar puntos
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                        {/* Reduced size QR: size-32 (128px) instead of size-64 (256px), and SVG size 120 instead of 200 */}
                        <div className="size-32 bg-white rounded-3xl flex items-center justify-center text-navy-dark shadow-2xl relative z-10 border-2 border-white/5 p-4">
                            <QRCodeSVG
                                value={user?.id || 'no-user'}
                                size={100}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setShowMainQRModal(true)}
                        className="bg-primary hover:bg-primary-dark text-navy-dark px-10 h-14 rounded-full font-black text-[12px] uppercase tracking-[0.2em] shadow-[0_8px_25px_rgba(57,224,121,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Escaneo en Caja
                        <span className="material-symbols-outlined !text-xl">qr_code_2</span>
                    </button>
                </div>

                {/* Independent Affiliation CTA Section */}
                <div
                    onClick={startScanner}
                    className="group relative overflow-hidden bg-gradient-to-br from-navy-card to-navy-dark border border-white/5 p-5 rounded-[2rem] shadow-xl active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-500">
                                <span className="material-symbols-outlined !text-4xl">add_business</span>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-black text-white uppercase tracking-tight">Afiliarme a un Comercio</h4>
                                <div className="flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Escanea el código del local ahora</p>
                                </div>
                            </div>
                        </div>
                        <div className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-navy-dark transition-all duration-300">
                            <span className="material-symbols-outlined group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                        </div>
                    </div>
                </div>

                {/* Loyalty Cards List */}
                <div className="space-y-4 text-white">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-sm font-bold text-slate-subtitle uppercase tracking-widest">Mis Comercios</h2>
                        <span className="text-[10px] font-bold text-primary">{loyaltyCards.length} ACTIVOS</span>
                    </div>

                    {loyaltyCards.length > 0 ? (
                        <div className="space-y-3">
                            {loyaltyCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => card.businesses && fetchBusinessPrizes(card.businesses)}
                                    className="bg-navy-card p-4 rounded-card border border-border-subtle shadow-md flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer group hover:border-primary/40"
                                >
                                    <div className="size-12 rounded-xl bg-white/5 border border-border-subtle p-2 flex items-center justify-center overflow-hidden shrink-0">
                                        {card.businesses?.logo_url ? (
                                            <img src={card.businesses.logo_url} alt={card.businesses.name} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="material-symbols-outlined text-primary">storefront</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-100 truncate">{card.businesses?.name}</h3>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-accent text-sm">stars</span>
                                            <span className="text-sm font-black text-accent">{card.current_points?.toLocaleString()} pts</span>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 bg-navy-card/30 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(57,224,121,0.1)]">
                                <span className="material-symbols-outlined text-primary text-5xl font-black">lock_open</span>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Aún no tienes tarjetas de lealtad</p>

                                <div className="space-y-3">
                                    <h4 className="text-2xl font-black text-white leading-tight">
                                        Tu billetera de premios está <span className="text-primary italic">esperando...</span> 🔓
                                    </h4>
                                    <p className="text-sm text-slate-400 font-semibold leading-relaxed max-w-[300px] mx-auto">
                                        Cientos de usuarios ya están canjeando productos gratis en sus Kioskos y Comercios favoritos.
                                        <span className="block mt-3 text-white font-black text-base">¿Te vas a quedar fuera?</span>
                                        Escanea el código del local para empezar.
                                    </p>

                                    <button
                                        onClick={startScanner}
                                        className="mt-6 w-full max-w-[240px] bg-primary text-navy-dark h-14 rounded-full font-black text-sm uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined font-black">qr_code_scanner</span>
                                        ESCANEAR COMERCIO
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Activity Section */}
                {recentTransactions.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h2 className="text-sm font-bold text-slate-subtitle uppercase tracking-widest">Actividad Reciente</h2>
                        </div>
                        <div className="space-y-3">
                            {recentTransactions.map((tx) => (
                                <div key={tx.id} className="bg-navy-card/50 p-4 rounded-card border border-border-subtle flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`size-10 rounded-full flex items-center justify-center ${tx.type === 'EARN' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                                            <span className="material-symbols-outlined text-xl">
                                                {tx.type === 'EARN' ? 'add_task' : 'redeem'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-100">{tx.businesses?.name || 'Comercio'}</p>
                                            <p className="text-[10px] text-slate-subtitle font-medium">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-sm ${tx.type === 'EARN' ? 'text-primary' : 'text-accent'}`}>
                                            {tx.type === 'EARN' ? '+' : ''}{tx.points_amount} pts
                                        </p>
                                        <p className="text-[9px] text-slate-subtitle uppercase font-black tracking-widest leading-none mt-0.5">
                                            {tx.type === 'EARN' ? 'ACUMULADO' : 'CANJEADO'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Immersive Prizes Window (No Card Container) */}
            {selectedBusiness && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-navy-dark/90 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pb-32">

                    {/* Top Action Bar */}
                    <div className="sticky top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-navy-dark via-navy-dark/80 to-transparent">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-3xl drop-shadow-[0_0_12px_rgba(57,224,121,0.5)]">redeem</span>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase tracking-tighter">Premios</h1>
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] leading-none">Disponibles</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedBusiness(null)}
                            className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all active:scale-90"
                        >
                            <span className="material-symbols-outlined !text-2xl">close</span>
                        </button>
                    </div>

                    {/* Store Identity & Balance Section */}
                    <div className="px-6 py-8 flex flex-col items-center gap-4 text-center animate-in slide-in-from-top-4 duration-700">
                        <div className="size-20 rounded-[2rem] bg-white shadow-[0_0_40px_rgba(255,255,255,0.05)] border border-white/20 p-4 flex items-center justify-center overflow-hidden rotate-3 hover:rotate-0 transition-transform duration-500">
                            {selectedBusiness.logo_url ? (
                                <img src={selectedBusiness.logo_url} alt={selectedBusiness.name} className="w-full h-full object-contain" />
                            ) : (
                                <span className="material-symbols-outlined text-navy-dark text-4xl font-black">storefront</span>
                            )}
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">
                                {selectedBusiness.name}
                            </h2>
                            {loyaltyCards.find(c => c.business_id === selectedBusiness.id) && (
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <div className="px-5 py-2 bg-accent/20 border border-accent/30 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                                        <span className="material-symbols-outlined text-accent !text-sm">stars</span>
                                        <span className="text-sm font-black text-accent uppercase tracking-widest leading-none">
                                            {loyaltyCards.find(c => c.business_id === selectedBusiness.id).current_points?.toLocaleString()} puntos
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prizes Grid - Distributed in the window */}
                    <div className="px-6 pb-10">
                        {loadingPrizes ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="size-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Sincronizando Catálogo...</p>
                            </div>
                        ) : businessPrizes.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {businessPrizes.map((prize) => {
                                    const userPoints = loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points || 0;
                                    const canAfford = userPoints >= prize.cost_points;
                                    const pointsNeeded = prize.cost_points - userPoints;

                                    return (
                                        <div
                                            key={prize.id}
                                            onClick={() => canAfford && setShowRedemptionQR(prize)}
                                            className={`relative group flex flex-col animate-in fade-in zoom-in-95 duration-500 ${canAfford ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                                        >
                                            <div className={`aspect-square rounded-[2rem] bg-white/5 border ${canAfford ? 'border-primary/40 shadow-[0_15px_30px_-10px_rgba(57,224,121,0.2)]' : 'border-white/5 opacity-40'} overflow-hidden flex items-center justify-center transition-all duration-300 relative`}>
                                                {prize.image_url ? (
                                                    <img src={prize.image_url} alt={prize.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-white/10 !text-6xl">redeem</span>
                                                )}

                                                {/* Cost Tag */}
                                                <div className="absolute top-3 right-3 bg-navy-dark/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-accent !text-xs font-black">stars</span>
                                                    <span className="text-xs font-black text-accent">{prize.cost_points}</span>
                                                </div>

                                                {/* Unlock Status Info */}
                                                {canAfford ? (
                                                    <div className="absolute inset-x-3 bottom-3 bg-primary/90 backdrop-blur-sm py-2 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg">
                                                        <span className="material-symbols-outlined !text-sm text-navy-dark font-black">verified_user</span>
                                                        <span className="text-[9px] font-black text-navy-dark uppercase tracking-widest">Canje Listo</span>
                                                    </div>
                                                ) : (
                                                    <div className="absolute inset-x-3 bottom-3 bg-navy-dark/60 backdrop-blur-md py-2 rounded-2xl flex items-center justify-center border border-white/5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Faltan {pointsNeeded}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-4 px-2 space-y-1">
                                                <h4 className={`text-sm font-black leading-tight truncate ${canAfford ? 'text-white' : 'text-slate-500'}`}>
                                                    {prize.name}
                                                </h4>
                                                {prize.description && (
                                                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 italic">{prize.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <span className="material-symbols-outlined text-6xl text-white/5 mb-4">featured_seasonal_and_gifts</span>
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sin premios publicados</p>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* Redemption QR Modal */}
            {showRedemptionQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy-dark/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-navy-card w-full max-w-[340px] rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-8 pb-4 text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                                <span className="material-symbols-outlined !text-4xl">qr_code_2</span>
                            </div>
                            <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight">Ticket de Canje</h3>
                            <p className="text-xs text-slate-400 font-medium">Muestra este código al comerciante</p>
                        </div>

                        {/* QR Area */}
                        <div className="px-8 py-6 flex flex-col items-center">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
                                <QRCodeSVG
                                    value={JSON.stringify({
                                        type: 'REDEEM_REQUEST',
                                        clientId: user.id,
                                        prizeId: showRedemptionQR.id,
                                        points: showRedemptionQR.cost_points
                                    })}
                                    size={200}
                                    level="H"
                                />
                            </div>

                            {/* Prize Info Card */}
                            <div className="w-full mt-8 bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {showRedemptionQR.image_url ? (
                                        <img src={showRedemptionQR.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-primary">redeem</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Premio Seleccionado</p>
                                    <h4 className="font-bold text-white text-sm truncate">{showRedemptionQR.name}</h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="material-symbols-outlined text-accent text-xs">stars</span>
                                        <span className="text-xs font-black text-accent">{showRedemptionQR.cost_points} pts</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <div className="p-8 pt-2">
                            <button
                                onClick={() => {
                                    setShowRedemptionQR(null);
                                    fetchUserData(); // Actualizar puntos al cerrar
                                }}
                                className="w-full h-14 bg-primary text-white rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(57,224,121,0.3)]"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main QR Modal for Checkout Scanning */}
            {showMainQRModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-navy-dark/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-navy-card w-full max-w-[340px] rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-8 pb-4 text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                                <span className="material-symbols-outlined !text-4xl">qr_code_scanner</span>
                            </div>
                            <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight">Escaneo para Puntos</h3>
                            <p className="text-xs text-slate-400 font-medium">Presenta este código al cajero para sumar puntos</p>
                        </div>

                        {/* QR Area */}
                        <div className="px-8 py-6 flex flex-col items-center">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
                                <QRCodeSVG
                                    value={user?.id || 'no-user'}
                                    size={180}
                                    level="H"
                                    includeMargin={false}
                                />
                            </div>
                        </div>

                        {/* Action - Back with Refresh */}
                        <div className="p-8 pt-2">
                            <button
                                onClick={async () => {
                                    await fetchUserData(); // Actualizar todos los puntos
                                    setShowMainQRModal(false);
                                    showNotification('success', 'Actualizado', 'Tu saldo de puntos ha sido verificado.');
                                }}
                                className="w-full h-14 bg-primary text-white rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(57,224,121,0.3)]"
                            >
                                Volver al panel principal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Menu */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-border-subtle flex items-center justify-around px-6 pb-2 z-[80]">
                <button
                    onClick={() => setSelectedBusiness(null)}
                    className={`flex flex-col items-center gap-1 ${!selectedBusiness ? 'text-primary' : 'text-slate-subtitle'}`}
                >
                    <span className="material-symbols-outlined font-bold">account_balance_wallet</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Inicio</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-subtitle">
                    <span className="material-symbols-outlined">explore</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Comercios</span>
                </button>
                <button
                    onClick={() => {
                        if (loyaltyCards.length > 0) {
                            fetchBusinessPrizes(loyaltyCards[0].businesses);
                        }
                    }}
                    className={`flex flex-col items-center gap-1 ${selectedBusiness ? 'text-primary' : 'text-slate-subtitle'} active:scale-90 transition-transform`}
                >
                    <span className="material-symbols-outlined">featured_seasonal_and_gifts</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Premios</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-subtitle">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
                </button>
            </nav>

            {/* Message Center Drawer */}
            <MessageCenter
                isOpen={isMessageCenterOpen}
                onClose={() => setIsMessageCenterOpen(false)}
            />

            {/* Business Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-navy-dark/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-navy-card w-full max-w-[340px] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-8 pb-4 text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                                <span className="material-symbols-outlined !text-4xl">store</span>
                            </div>
                            <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight">Afiliar Comercio</h3>
                            <p className="text-xs text-slate-400 font-medium">Escanea el código QR del local</p>
                        </div>

                        <div className="px-8 py-6">
                            <div className="bg-navy-dark rounded-3xl overflow-hidden border border-white/10 relative min-h-[250px] flex items-center justify-center">
                                {isProcessingScanner ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <span className="animate-spin material-symbols-outlined text-primary text-5xl">refresh</span>
                                        <p className="font-bold text-sm text-primary">Procesando...</p>
                                    </div>
                                ) : (
                                    <div id="affiliation-reader" className="w-full"></div>
                                )}
                            </div>
                        </div>

                        <div className="p-8 pt-2">
                            <button
                                onClick={closeScanner}
                                className="w-full h-14 bg-white/5 text-white rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all border border-white/10"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPoints;
