import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNotification } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import MessageCenter from '../components/MessageCenter';
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

        console.log('🔄 Iniciando canal Realtime para usuario:', user.id);

        const channel = supabase
            .channel(`client-updates-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('💳 Nueva transacción detectada:', payload.new.type);
                fetchUserData();

                if (payload.new.type === 'REDEEM') {
                    showNotification('success', '¡Canje Realizado!', 'Tu premio ha sido procesado con éxito.');
                    setShowRedemptionQR(null);
                } else if (payload.new.type === 'EARN') {
                    showNotification('success', '¡Puntos Acumulados!', 'Has ganado nuevos puntos.');
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'loyalty_cards',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('✨ Actualización de puntos detectada.');
                fetchUserData();
            })
            .subscribe((status) => {
                console.log('📡 Estado Realtime:', status);
            });

        return () => {
            console.log('🚫 Cerrando canal Realtime');
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
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#F0F2F5] font-display text-slate-900 antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden border-2 border-[#595A5B] shadow-sm">
                        <img
                            src="/Logo KPoint Solo K (sin Fondo).png"
                            alt="Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Mis <span className="text-[rgb(255,101,14)]">Puntos</span></h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">MONEDERO DIGITAL</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsMessageCenterOpen(true)}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center relative group active:scale-90 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-primary text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Se actualizará la aplicación para buscar nuevas mejoras. ¿Continuar?')) {
                                forceAppUpdate();
                            }
                        }}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center hover:text-primary transition-colors shadow-sm"
                        title="Actualizar"
                    >
                        <span className="material-symbols-outlined !text-[20px]">sync</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>

            <main className="px-6 py-4 space-y-6">
                {/* Welcome Card - NEW ORANGE THEME */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(255,101,14)] to-[#e65a0c] p-8 rounded-[2.5rem] shadow-xl shadow-[rgb(255,101,14)]/20 min-h-[180px] flex flex-col justify-center">
                    <div className="relative z-10 text-white">
                        <p className="text-2xl font-bold opacity-90">¡Hola!</p>
                        <h2 className="text-4xl font-black mt-1 leading-tight tracking-tight">
                            {profile?.full_name?.split(' ')[0] || 'Cliente'}
                        </h2>
                        <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg group active:scale-95 transition-transform">
                            <span className="material-symbols-outlined text-white text-base font-black animate-spin-slow">stars</span>
                            <p className="text-white text-[10px] font-black uppercase tracking-[0.15em] leading-none">
                                ¡TODO LISTO PARA GANAR!
                            </p>
                        </div>
                    </div>

                    {/* Styled Reward Icon Container */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 animate-float opacity-90">
                        <div className="relative size-24 bg-white/10 rounded-3xl backdrop-blur-sm border-2 border-[#595A5B] flex items-center justify-center shadow-2xl">
                            <span className="material-symbols-outlined text-white !text-5xl drop-shadow-lg">redeem</span>
                            <div className="absolute -top-1 -right-1 size-4 bg-white rounded-full border-2 border-[rgb(255,101,14)] shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                        </div>
                    </div>

                    <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-white/[0.07] !text-[180px] font-black pointer-events-none rotate-12">
                        account_balance_wallet
                    </span>
                </div>

                {/* QR Access Section */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-[#595A5B] flex flex-col items-center gap-6">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">MI CÓDIGO QR</h3>
                        <p className="text-[13px] font-bold text-slate-500 tracking-tight leading-relaxed max-w-[240px]">
                            <span className="text-[rgb(255,101,14)] italic">¡Listo para ganar!</span> Muéstralo en caja para sumar puntos
                        </p>
                    </div>

                    <div className="relative p-2 bg-gradient-to-tr from-slate-50 to-white rounded-[2rem] shadow-inner border-2 border-[#595A5B]">
                        <div className="size-40 bg-white rounded-[1.5rem] flex items-center justify-center text-slate-900 shadow-xl border-2 border-[#595A5B] p-5">
                            <QRCodeSVG
                                value={user?.id || 'no-user'}
                                size={120}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setShowMainQRModal(true)}
                        className="w-full bg-[rgb(255,101,14)] hover:opacity-90 text-white h-16 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        ESCANEO EN CAJA
                        <span className="material-symbols-outlined !text-2xl">qr_code_2</span>
                    </button>
                </div>

                {/* Independent Affiliation CTA Section */}
                <div
                    onClick={startScanner}
                    className="group relative overflow-hidden bg-white border-2 border-[#595A5B] p-6 rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-green-500/30"
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="size-16 rounded-[1.25rem] bg-[rgb(255,101,14)]/10 flex items-center justify-center text-[rgb(255,101,14)] group-hover:rotate-6 transition-transform duration-500 border border-[rgb(255,101,14)]/20">
                                <span className="material-symbols-outlined !text-4xl font-black">add_business</span>
                            </div>
                            <div className="space-y-1.5">
                                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">AFILIARME A UN COMERCIO</h4>
                                <div className="flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-[rgb(255,101,14)] animate-pulse"></span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Escanea el código del local ahora</p>
                                </div>
                            </div>
                        </div>
                        <div className="size-11 rounded-full bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-300 group-hover:bg-[rgb(255,101,14)] group-hover:text-white group-hover:border-[rgb(255,101,14)] transition-all duration-300 shadow-sm">
                            <span className="material-symbols-outlined group-hover:translate-x-0.5 transition-transform !text-2xl">chevron_right</span>
                        </div>
                    </div>
                </div>

                {/* Loyalty Cards List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mis Comercios</h2>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{loyaltyCards.length} ACTIVOS</span>
                    </div>

                    {loyaltyCards.length > 0 ? (
                        <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x snap-mandatory custom-scrollbar-hide">
                            {loyaltyCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => card.businesses && fetchBusinessPrizes(card.businesses)}
                                    className="min-w-[280px] bg-[rgb(202,250,137)] p-5 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm flex flex-col gap-4 active:scale-[0.98] transition-all cursor-pointer group hover:border-primary/40 hover:shadow-md snap-center"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-14 rounded-2xl bg-slate-50 border-2 border-[#595A5B] p-2 flex items-center justify-center overflow-hidden shrink-0">
                                            {card.businesses?.logo_url ? (
                                                <img src={card.businesses.logo_url} alt={card.businesses.name} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="material-symbols-outlined text-primary text-2xl">storefront</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-slate-900 truncate tracking-tight text-lg">{card.businesses?.name}</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Socio Activo</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-slate-50 border-2 border-[#595A5B] rounded-2xl p-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Saldo Actual</span>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="material-symbols-outlined text-warning text-xl font-black">stars</span>
                                                <span className="text-2xl font-black text-warning tracking-tighter leading-none">{card.current_points?.toLocaleString()}</span>
                                                <span className="text-[10px] font-black text-warning uppercase ml-1">pts</span>
                                            </div>
                                        </div>
                                        <div className="size-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:border-primary transition-all">
                                            <span className="material-symbols-outlined font-black">chevron_right</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 bg-white rounded-[2.5rem] border border-dashed border-[#595A5B] flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 shadow-sm">
                            <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-2 shadow-sm border border-primary/20">
                                <span className="material-symbols-outlined text-primary text-5xl font-black">lock_open</span>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Aún no tienes tarjetas de lealtad</p>

                                <div className="space-y-3">
                                    <h4 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                                        Tu billetera de premios está <span className="text-primary italic">esperando...</span> 🔓
                                    </h4>
                                    <p className="text-sm text-slate-500 font-semibold leading-relaxed max-w-[300px] mx-auto">
                                        Cientos de usuarios ya están canjeando productos gratis en sus comercios favoritos.
                                        <span className="block mt-3 text-slate-900 font-black text-base">¿Te vas a quedar fuera?</span>
                                        Escanea el código del local para empezar.
                                    </p>

                                    <button
                                        onClick={startScanner}
                                        className="mt-6 w-full max-w-[240px] bg-primary text-white h-14 rounded-full font-black text-sm uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto"
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
                            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Actividad Reciente</h2>
                        </div>
                        <div className="space-y-3">
                            {recentTransactions.map((tx) => (
                                <div key={tx.id} className="bg-white p-4 rounded-[1.5rem] border-2 border-[#595A5B] shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`size-10 rounded-xl flex items-center justify-center border ${tx.type === 'EARN' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                                            <span className="material-symbols-outlined text-xl">
                                                {tx.type === 'EARN' ? 'add_task' : 'redeem'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 tracking-tight">{tx.businesses?.name || 'Comercio'}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-sm ${tx.type === 'EARN' ? 'text-primary' : 'text-warning'}`}>
                                            {tx.type === 'EARN' ? '+' : ''}{tx.points_amount} pts
                                        </p>
                                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mt-0.5">
                                            {tx.type === 'EARN' ? 'ACUMULADO' : 'CANJEADO'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Immersive Prizes Window */}
            {selectedBusiness && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-[#f8fafc]/95 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pb-32">
                    {/* Top Action Bar */}
                    <div className="sticky top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-[#f8fafc]/80 backdrop-blur-md border-b border-[#595A5B]">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-3xl">redeem</span>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Premios</h1>
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] leading-none">Catálogo Abierto</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedBusiness(null)}
                            className="size-12 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm"
                        >
                            <span className="material-symbols-outlined !text-2xl">close</span>
                        </button>
                    </div>

                    {/* Store Identity & Balance Section */}
                    <div className="px-6 py-8 flex flex-col items-center gap-4 text-center animate-in slide-in-from-top-4 duration-700">
                        <div className="size-20 rounded-[2rem] bg-white shadow-xl border-2 border-[#595A5B] p-4 flex items-center justify-center overflow-hidden rotate-3 hover:rotate-0 transition-transform duration-500">
                            {selectedBusiness.logo_url ? (
                                <img src={selectedBusiness.logo_url} alt={selectedBusiness.name} className="w-full h-full object-contain" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-900 text-4xl font-black">storefront</span>
                            )}
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                {selectedBusiness.name}
                            </h2>
                            {loyaltyCards.find(c => c.business_id === selectedBusiness.id) && (
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <div className="px-5 py-2 bg-warning/10 border border-warning/20 rounded-full flex items-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-warning !text-sm">stars</span>
                                        <span className="text-sm font-black text-warning uppercase tracking-widest leading-none">
                                            {loyaltyCards.find(c => c.business_id === selectedBusiness.id).current_points?.toLocaleString()} puntos
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prizes Grid */}
                    <div className="px-6 pb-10">
                        {loadingPrizes ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="size-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Catálogo...</p>
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
                                            <div className={`aspect-square rounded-[2rem] bg-white border ${canAfford ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-[#595A5B] opacity-60'} overflow-hidden flex items-center justify-center transition-all duration-300 relative`}>
                                                {prize.image_url ? (
                                                    <img src={prize.image_url} alt={prize.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-slate-200 !text-6xl">redeem</span>
                                                )}

                                                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border-2 border-[#595A5B] flex items-center gap-1.5 shadow-sm">
                                                    <span className="material-symbols-outlined text-warning !text-xs font-black">stars</span>
                                                    <span className="text-xs font-black text-warning">{prize.cost_points}</span>
                                                </div>

                                                {canAfford ? (
                                                    <div className="absolute inset-x-3 bottom-3 bg-primary py-2 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg">
                                                        <span className="material-symbols-outlined !text-sm text-white font-black">verified_user</span>
                                                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Canje Listo</span>
                                                    </div>
                                                ) : (
                                                    <div className="absolute inset-x-3 bottom-3 bg-white/60 backdrop-blur-md py-2 rounded-2xl flex items-center justify-center border-2 border-[#595A5B] shadow-sm">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Faltan {pointsNeeded}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-4 px-2 space-y-1">
                                                <h4 className={`text-sm font-black leading-tight truncate ${canAfford ? 'text-slate-900' : 'text-slate-400'}`}>
                                                    {prize.name}
                                                </h4>
                                                {prize.description && (
                                                    <p className="text-[10px] text-slate-400 font-medium line-clamp-1 italic">{prize.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 font-black">redeem</span>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sin premios publicados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Redemption QR Modal */}
            {showRedemptionQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRedemptionQR(null)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 shadow-2xl border-2 border-[#595A5B]">
                        <div className="text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                                <span className="material-symbols-outlined !text-4xl font-black">qr_code_2</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Código de Canje</h3>
                            <p className="text-sm font-bold text-slate-500">{showRedemptionQR.name}</p>
                        </div>

                        <div className="p-6 bg-white rounded-3xl border-2 border-[#595A5B] shadow-xl overflow-hidden">
                            <QRCodeSVG
                                value={`REDEEM:${user?.id}:${showRedemptionQR.id}`}
                                size={200}
                                level="H"
                            />
                        </div>

                        <div className="text-center space-y-3 w-full">
                            <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Muestra esto en caja</p>
                            <button
                                onClick={() => setShowRedemptionQR(null)}
                                className="w-full h-14 bg-slate-100 text-slate-600 rounded-full font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main QR Modal (Checkout) */}
            {showMainQRModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMainQRModal(false)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 shadow-2xl border-2 border-[#595A5B]">
                        <div className="text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                                <span className="material-symbols-outlined !text-4xl font-black">qr_code_scanner</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Mi Código QR</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Muéstralo al cajero para sumar puntos</p>
                        </div>

                        <div className="p-6 bg-white rounded-3xl border-2 border-[#595A5B] shadow-xl">
                            <QRCodeSVG
                                value={user?.id || 'no-user'}
                                size={220}
                                level="H"
                            />
                        </div>

                        <button
                            onClick={() => setShowMainQRModal(false)}
                            className="w-full h-14 bg-primary text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            ENTENDIDO
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation Menu */}
            <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/90 backdrop-blur-xl border-t border-[#595A5B] px-8 flex items-center justify-between z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.02)]">
                <button
                    onClick={() => navigate('/my-points')}
                    className="flex flex-col items-center gap-1.5 transition-all group active:scale-90"
                >
                    <div className="size-11 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined !text-2xl font-black">token</span>
                    </div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Puntos</span>
                </button>

                <button
                    onClick={startScanner}
                    className="flex flex-col items-center gap-1.5 transition-all group active:scale-90 opacity-40 hover:opacity-100"
                >
                    <div className="size-11 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                        <span className="material-symbols-outlined !text-2xl">qr_code_scanner</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Afiliar</span>
                </button>

                <button
                    onClick={() => setIsMessageCenterOpen(true)}
                    className="flex flex-col items-center gap-1.5 transition-all group active:scale-90 opacity-40 hover:opacity-100"
                >
                    <div className="size-11 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all relative">
                        <span className="material-symbols-outlined !text-2xl">mail</span>
                        {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-4 bg-primary text-[8px] text-white flex items-center justify-center rounded-full font-black border-2 border-white"></span>}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Mensajes</span>
                </button>

                <button
                    onClick={signOut}
                    className="flex flex-col items-center gap-1.5 transition-all group active:scale-90 opacity-40 hover:opacity-100"
                >
                    <div className="size-11 rounded-2xl bg-slate-50 border-2 border-[#595A5B] flex items-center justify-center text-slate-400 group-hover:text-red-500 group-hover:bg-red-50 group-hover:border-red-100 transition-all">
                        <span className="material-symbols-outlined !text-2xl">person_off</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">Salir</span>
                </button>
            </nav>

            {/* Message Center */}
            <MessageCenter
                isOpen={isMessageCenterOpen}
                onClose={() => setIsMessageCenterOpen(false)}
            />

            {/* Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 shadow-2xl border-2 border-[#595A5B]">
                        <div className="text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                                <span className="material-symbols-outlined !text-4xl font-black">store</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Afiliar Comercio</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Escanea el código QR del local</p>
                        </div>

                        <div className="w-full bg-slate-50 rounded-3xl overflow-hidden border-2 border-[#595A5B] relative min-h-[250px] flex items-center justify-center shadow-inner">
                            {isProcessingScanner ? (
                                <div className="flex flex-col items-center gap-4">
                                    <span className="animate-spin material-symbols-outlined text-primary text-5xl">refresh</span>
                                    <p className="font-black text-xs text-primary uppercase tracking-widest">Procesando...</p>
                                </div>
                            ) : (
                                <div id="affiliation-reader" className="w-full"></div>
                            )}
                        </div>

                        <button
                            onClick={closeScanner}
                            className="w-full h-14 bg-slate-100 text-slate-600 rounded-full font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors active:scale-95"
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPoints;
