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
        if (!user) return;

        // Listener para actualizaciones en tiempo real
        const channel = supabase
            .channel(`client-points-realtime-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `profile_id=eq.${user.id}`
            }, async (payload) => {
                console.log('Nueva transacción detectada:', payload.new);

                // Refrescar datos con un pequeño retraso para permitir que los triggers de DB completen
                setTimeout(() => fetchUserData(), 500);

                if (payload.new.type === 'EARN') {
                    showNotification('success', '¡Puntos Recibidos!', `Has ganado ${payload.new.points_amount} nuevos puntos.`);
                } else if (payload.new.type === 'REDEEM') {
                    showNotification('success', '¡Canje Exitoso!', 'Tu premio ha sido procesado correctamente.');
                    setShowRedemptionQR(null);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'loyalty_cards',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                console.log('Actualización de tarjeta detectada:', payload.new);
                // Si la tarjeta se actualiza (ya sea por puntos o actividad), refrescamos el balance
                fetchUserData();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Suscrito a cambios en tiempo real para el cliente');
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

            <main className="px-6 py-4 space-y-6">
                {/* Welcome Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(255,101,14)] to-[#e65a0c] p-8 rounded-[2.5rem] shadow-xl text-white">
                    <p className="text-2xl font-bold opacity-90">¡Hola!</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tight">{profile?.full_name?.split(' ')[0] || 'Cliente'}</h2>
                    <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-2xl border border-white/30">
                        <span className="material-symbols-outlined text-white text-base font-black">stars</span>
                        <p className="text-white text-[10px] font-black uppercase tracking-[0.15em]">¡TODO LISTO PARA GANAR!</p>
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
                            <div key={card.id} onClick={() => fetchBusinessPrizes(card.businesses)} className="min-w-[280px] bg-[rgb(202,250,137)] p-5 rounded-[2.5rem] border-2 border-[#595A5B] snap-center cursor-pointer">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="size-14 rounded-2xl bg-white border-2 border-[#595A5B] p-2 flex items-center justify-center overflow-hidden">
                                        {card.businesses?.logo_url ? <img src={card.businesses.logo_url} className="w-full h-full object-contain" /> : <span className="material-symbols-outlined text-primary text-2xl">store</span>}
                                    </div>
                                    <h3 className="font-black text-slate-900 text-lg truncate">{card.businesses?.name}</h3>
                                </div>
                                <div className="bg-white border-2 border-[#595A5B] rounded-2xl p-4 flex justify-between items-center">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Saldo Actual</span>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="material-symbols-outlined text-warning text-xl font-black">stars</span>
                                            <span className="text-2xl font-black text-warning leading-none">{card.current_points}</span>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
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
            {selectedBusiness && (
                <div className="fixed inset-0 z-[60] bg-[#f8fafc] overflow-y-auto pb-32">
                    <div className="sticky top-0 p-6 flex justify-between items-center bg-white/80 backdrop-blur-md border-b border-[#595A5B] z-50">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-3xl">redeem</span>
                            <h1 className="text-xl font-black uppercase">Premios</h1>
                        </div>
                        <button onClick={() => setSelectedBusiness(null)} className="size-12 rounded-full border-2 border-[#595A5B] flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    {/* Prizes list... simplified for brevity, following pattern */}
                    <div className="p-6 grid grid-cols-2 gap-4">
                        {businessPrizes.map(p => (
                            <div key={p.id} onClick={() => (loyaltyCards.find(c => c.business_id === selectedBusiness.id)?.current_points >= p.cost_points) && setShowRedemptionQR(p)} className="bg-white border-2 border-[#595A5B] rounded-[2rem] p-4 text-center">
                                <h4 className="text-sm font-black">{p.name}</h4>
                                <div className="mt-2 text-warning font-black text-xs">{p.cost_points} pts</div>
                            </div>
                        ))}
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
