import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useNotification } from '../context/NotificationContext';

const Home = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ sales: 0, points: 0, newClients: 0 });
    const [weeklyActivity, setWeeklyActivity] = useState([0, 0, 0, 0, 0, 0, 0]); // Lun to Dom
    const [activities, setActivities] = useState([]);
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sale Registration State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saleStep, setSaleStep] = useState(1); // 1: Amount, 2: Scanner
    const [amount, setAmount] = useState('');
    const [amountBs, setAmountBs] = useState('');
    const [exchangeRate, setExchangeRate] = useState(60.00); // Default or fetch later
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchEmail, setSearchEmail] = useState('');

    // Redeem State
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redeemStep, setRedeemStep] = useState(1); // 1: Scanner, 2: Reward Selection
    const [redeemClient, setRedeemClient] = useState(null);
    const [availableRewards, setAvailableRewards] = useState([]);
    const [selectedReward, setSelectedReward] = useState(null);

    const businessId = profile?.business_members?.[0]?.business_id || '00000000-0000-0000-0000-000000000001';

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Fetch Profile and Business ID
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*, business_members(business_id, businesses(name))')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;
                setProfile(profileData);
                setBusiness(profileData.business_members?.[0]?.businesses || null);

                const currentBizId = profileData.business_members?.[0]?.business_id || '00000000-0000-0000-0000-000000000001';

                // 2. Fetch Stats (Today)
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

                // Transactions Today
                const { data: transactionsToday } = await supabase
                    .from('transactions')
                    .select('amount_fiat, points_amount, type')
                    .eq('business_id', currentBizId)
                    .gte('created_at', startOfToday);

                const totalSales = transactionsToday
                    ?.filter(tx => tx.type === 'EARN')
                    ?.reduce((acc, curr) => acc + (Number(curr.amount_fiat) || 0), 0) || 0;

                const totalPoints = transactionsToday
                    ?.reduce((acc, curr) => acc + (Number(curr.points_amount) || 0), 0) || 0;

                const totalTx = transactionsToday?.length || 0;

                // New Clients Today
                const { count: newClientsCount } = await supabase
                    .from('loyalty_cards')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', currentBizId)
                    .gte('last_activity', startOfToday);

                setStats({
                    sales: totalSales,
                    points: totalPoints,
                    newClients: newClientsCount || 0,
                    transactions: totalTx
                });

                // 3. Recent Activity
                const { data: activityData } = await supabase
                    .from('transactions')
                    .select('*, profiles(full_name)')
                    .eq('business_id', currentBizId)
                    .order('created_at', { ascending: false })
                    .limit(5);

                setActivities(activityData || []);

                // 4. Weekly Activity
                const startOfWeek = new Date(now);
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(startOfWeek.setDate(diff));
                monday.setHours(0, 0, 0, 0);

                const { data: weekData } = await supabase
                    .from('transactions')
                    .select('amount_fiat, created_at')
                    .eq('business_id', currentBizId)
                    .eq('type', 'EARN')
                    .gte('created_at', monday.toISOString());

                const dailyTotals = [0, 0, 0, 0, 0, 0, 0];
                weekData?.forEach(tx => {
                    const txDate = new Date(tx.created_at);
                    let txDay = txDate.getDay();
                    const index = txDay === 0 ? 6 : txDay - 1;
                    dailyTotals[index] += (Number(tx.amount_fiat) || 0);
                });
                setWeeklyActivity(dailyTotals);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchDashboardData();
    }, [user]); // Removed profile?.id to prevent loop

    const startScanner = () => {
        setSaleStep(2);
        setIsProcessing(false);
        setTimeout(async () => {
            try {
                const container = document.getElementById("reader");
                if (!container) return;

                if (window.scannerInstance) {
                    await window.scannerInstance.stop().catch(() => { });
                }

                const html5QrCode = new Html5Qrcode("reader");
                window.scannerInstance = html5QrCode;

                // Try starting with facingMode
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        { fps: 15, qrbox: { width: 250, height: 250 } },
                        onScanSuccess,
                        onScanFailure
                    );
                } catch (err) {
                    console.warn("Direct facingMode failed, listing cameras...", err);
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        const backCam = cameras.find(c =>
                            c.label.toLowerCase().includes('back') ||
                            c.label.toLowerCase().includes('rear') ||
                            c.label.toLowerCase().includes('trasera')
                        ) || cameras[0];

                        await html5QrCode.start(
                            backCam.id,
                            { fps: 15, qrbox: { width: 250, height: 250 } },
                            onScanSuccess,
                            onScanFailure
                        );
                    }
                }
            } catch (err) {
                console.error('Final scanner error:', err);
                showNotification('error', 'Error de Cámara', 'No se pudo activar la cámara automáticamente.');
            }
        }, 400);
    };

    const onScanSuccess = async (decodedText) => {
        try {
            if (window.scannerInstance) {
                await window.scannerInstance.stop().catch(() => { });
                window.scannerInstance = null;
            }
            if (window.scannerUI) {
                window.scannerUI.clear().catch(() => { });
                window.scannerUI = null;
            }
            setIsProcessing(true);

            const clientId = decodedText; // UUID of the client

            // Create Transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    business_id: businessId,
                    profile_id: clientId,
                    amount_fiat: parseFloat(amount),
                    type: 'EARN',
                    description: `Compra por $${amount}`
                });

            if (txError) throw txError;

            // Success! Close everything and refresh
            setIsModalOpen(false);
            setAmount('');
            setSaleStep(1);
            showNotification('success', '¡Puntos Asignados!', 'La venta se ha procesado y los puntos han sido cargados al cliente.');
            setTimeout(() => window.location.reload(), 1500); // Wait for user to see the message
        } catch (err) {
            console.error('Error processing sale:', err);
            showNotification('error', 'Error de Escaneo', 'No se pudo procesar la venta. Verifique el código QR.');
            setSaleStep(1);
        } finally {
            setIsProcessing(false);
        }
    };

    const onScanFailure = (error) => {
        // Just ignore failures
    };

    // REDEEM LOGIC
    const startRedeemScanner = () => {
        setRedeemStep(1);
        setIsRedeemModalOpen(true);
        setIsProcessing(false);
        setTimeout(async () => {
            try {
                const container = document.getElementById("redeem-reader");
                if (!container) return;

                if (window.redeemScannerInstance) {
                    await window.redeemScannerInstance.stop().catch(() => { });
                }

                const html5QrCode = new Html5Qrcode("redeem-reader");
                window.redeemScannerInstance = html5QrCode;

                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        { fps: 15, qrbox: { width: 250, height: 250 } },
                        onRedeemScanSuccess,
                        onScanFailure
                    );
                } catch (err) {
                    console.warn("Redeem facingMode failed, listing cameras...", err);
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        const backCam = cameras.find(c =>
                            c.label.toLowerCase().includes('back') ||
                            c.label.toLowerCase().includes('rear') ||
                            c.label.toLowerCase().includes('trasera')
                        ) || cameras[0];

                        await html5QrCode.start(
                            backCam.id,
                            { fps: 15, qrbox: { width: 250, height: 250 } },
                            onRedeemScanSuccess,
                            onScanFailure
                        );
                    }
                }
            } catch (err) {
                console.error('Final redeem scanner error:', err);
                showNotification('error', 'Error de Cámara', 'No se pudo activar la cámara automáticamente.');
            }
        }, 400);
    };

    const onRedeemScanSuccess = async (decodedText) => {
        try {
            if (window.redeemScannerInstance) {
                await window.redeemScannerInstance.stop().catch(() => { });
                window.redeemScannerInstance = null;
            }
            if (window.redeemScannerUI) {
                await window.redeemScannerUI.clear().catch(() => { });
                window.redeemScannerUI = null;
            }
            setIsProcessing(true);

            let clientId = decodedText;
            let preSelectedPrizeId = null;

            // Try to parse JSON for the new redemption ticket format
            try {
                const qrData = JSON.parse(decodedText);
                if (qrData.type === 'REDEEM_REQUEST') {
                    clientId = qrData.clientId;
                    preSelectedPrizeId = qrData.prizeId;
                }
            } catch (e) {
                // Not a JSON, assume it's a legacy UUID string (client ID only)
            }

            // 1. Get Client Info & Points for this business
            const { data: cardData, error: cardError } = await supabase
                .from('loyalty_cards')
                .select('*, profiles(full_name, email)')
                .eq('profile_id', clientId)
                .eq('business_id', businessId)
                .single();

            if (cardError || !cardData) {
                throw new Error('El cliente no está afiliado o no existe.');
            }

            setRedeemClient(cardData);

            // 2. Fetch Active Rewards
            const { data: rewardsData } = await supabase
                .from('rewards')
                .select('*')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('cost_points', { ascending: true });

            setAvailableRewards(rewardsData || []);

            // AUTO REDEEM: If a prize was pre-selected in the QR, and it's available, process it immediately
            if (preSelectedPrizeId && rewardsData) {
                const selectedPrize = rewardsData.find(r => r.id === preSelectedPrizeId);
                if (selectedPrize) {
                    console.log('Automating redemption for:', selectedPrize.name);
                    setTimeout(() => {
                        handleProcessRedeem(selectedPrize, cardData, true);
                    }, 500);
                    return;
                }
            }

            setRedeemStep(2);
        } catch (err) {
            console.error('Redeem scan error:', err);
            showNotification('error', 'Error de Canje', err.message || 'No se pudo identificar al cliente.');
            setIsRedeemModalOpen(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProcessRedeem = async (reward, clientOverride = null, isAuto = false) => {
        const client = clientOverride || redeemClient;
        if (!client || !reward) return;

        if (client.current_points < reward.cost_points) {
            showNotification('error', 'Puntos Insuficientes', 'El cliente no tiene suficientes puntos para este premio.');
            return;
        }

        if (!isAuto && !window.confirm(`¿Confirmas el canje de "${reward.name}" por ${reward.cost_points} pts?`)) return;

        try {
            setIsProcessing(true);

            // 1. Create REDEEM Transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    business_id: businessId,
                    profile_id: client.profile_id,
                    reward_id: reward.id,
                    points_amount: -reward.cost_points,
                    type: 'REDEEM',
                    description: `Canje de premio: ${reward.name}`
                });

            if (txError) throw txError;

            // 2. Manually update points in loyalty_cards for immediate balance reflection
            const { error: updateError } = await supabase
                .from('loyalty_cards')
                .update({
                    current_points: client.current_points - reward.cost_points,
                    last_activity: new Date().toISOString()
                })
                .eq('id', client.id);

            if (updateError) console.error('Error updating loyalty card directly:', updateError);

            // 3. Success Feedback
            showNotification('success', '¡Canje Procesado!', `Se ha canjeado "${reward.name}" por ${reward.cost_points} pts.`);

            // Close everything
            setIsRedeemModalOpen(false);
            setRedeemClient(null);
            setAvailableRewards([]);
            setRedeemStep(1);

            // Sync with DB
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            console.error('Redeem process error:', err);
            showNotification('error', 'Error en Canje', 'No se pudo completar el canje. Verifique la conexión.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleManualSearch = async () => {
        try {
            setIsProcessing(true);

            // 1. Validate if user exists in profiles
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('email', searchEmail.toLowerCase().trim())
                .maybeSingle();

            if (!profileData || profileError) {
                throw new Error('El correo ingresado no pertenece a ningún cliente registrado.');
            }

            // 3. Validate Amount
            if (!amount || parseFloat(amount) <= 0) {
                throw new Error('Por favor, ingresa un monto válido para la compra antes de validar.');
            }

            // 4. Validate if associated with this business
            const { data: cardData, error: cardError } = await supabase
                .from('loyalty_cards')
                .select('id')
                .eq('profile_id', profileData.id)
                .eq('business_id', businessId)
                .maybeSingle();

            if (!cardData || cardError) {
                throw new Error(`El cliente ${profileData.full_name} no está afiliado a este comercio.`);
            }

            // 5. Process Transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    business_id: businessId,
                    profile_id: profileData.id,
                    amount_fiat: parseFloat(amount),
                    type: 'EARN',
                    description: `Compra manual por $${amount}`
                });

            if (txError) throw txError;

            // Success!
            setIsModalOpen(false);
            setAmount('');
            setSearchEmail('');
            setSaleStep(1);
            showNotification('success', '¡Venta Registrada!', 'Los puntos han sido asignados correctamente al cliente.');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            showNotification('error', 'Error en Registro', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const closeModal = async () => {
        if (window.scannerInstance) {
            await window.scannerInstance.stop().catch(() => { });
            window.scannerInstance = null;
        }
        if (window.scannerUI) {
            await window.scannerUI.clear().catch(() => { });
            window.scannerUI = null;
        }
        if (window.scanner) {
            window.scanner.clear().catch(e => console.log(e));
            window.scanner = null;
        }
        setIsModalOpen(false);
        setSearchEmail('');
        setAmount('');
        setAmountBs('');
        setSaleStep(1);
    };

    const closeRedeemModal = async () => {
        if (window.redeemScannerInstance) {
            await window.redeemScannerInstance.stop().catch(() => { });
            window.redeemScannerInstance = null;
        }
        if (window.redeemScannerUI) {
            await window.redeemScannerUI.clear().catch(() => { });
            window.redeemScannerUI = null;
        }
        if (window.redeemScanner) {
            window.redeemScanner.clear().catch(e => console.log(e));
            window.redeemScanner = null;
        }
        setIsRedeemModalOpen(false);
        setRedeemClient(null);
        setAvailableRewards([]);
        setRedeemStep(1);
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-navy-dark flex items-center justify-center">
                <span className="animate-spin material-symbols-outlined text-primary text-4xl">refresh</span>
            </div>
        );
    }

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
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-navy-dark font-display text-white antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-xl border border-white/10">
                        <span className="material-symbols-outlined text-primary">storefront</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight"><span className="text-accent">K</span>Point</h1>
                        <p className="text-xs text-slate-400 font-bold leading-tight">Tu monedero digital de recompensas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="w-10 h-10 rounded-full bg-navy-card border border-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-300">notifications</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-navy-card border border-white/10 flex items-center justify-center hover:text-red-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            <main className="px-6 space-y-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary !text-3xl">store</span>
                        {business?.name || 'Mi Negocio'}
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 ml-1">Panel de Control</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-navy-card to-navy-dark p-5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-primary/10 size-16 rounded-full blur-2xl group-hover:bg-primary/20 transition-all"></div>
                        <span className="material-symbols-outlined text-primary mb-2 block">payments</span>
                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Ventas Hoy</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-white">${stats.sales}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{stats.transactions} tx</p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-navy-card to-navy-dark p-5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-accent/10 size-16 rounded-full blur-2xl group-hover:bg-accent/20 transition-all"></div>
                        <span className="material-symbols-outlined text-accent mb-2 block">stars</span>
                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Puntos Dados</p>
                        <p className="text-2xl font-black text-white">
                            {stats.points >= 1000 ? (stats.points / 1000).toFixed(1) + 'k' : stats.points}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-navy-card to-navy-dark p-5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group col-span-2">
                        <div className="absolute -right-4 -top-4 bg-primary/5 size-24 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="material-symbols-outlined text-primary/80 mb-1 block">group</span>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Clientes Activos Hoy</p>
                                <p className="text-2xl font-black text-white">{stats.newClients}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-primary font-black bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                    + {stats.newClients} hoy
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-navy-card p-5 rounded-3xl border border-white/5 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Actividad de la Semana</h2>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">Ventas ($)</span>
                    </div>
                    <div className="relative h-40 w-full flex items-end justify-between px-2">
                        <div className="absolute inset-0 chart-gradient rounded-xl overflow-hidden opacity-50"></div>
                        {weeklyActivity.map((value, index) => {
                            const maxVal = Math.max(...weeklyActivity, 1);
                            const height = (value / (maxVal * 1.1)) * 100;
                            const isToday = (new Date().getDay() === (index === 6 ? 0 : index + 1));

                            return (
                                <div key={index} className="flex flex-col items-center justify-end h-full flex-1 group relative z-10 px-1">
                                    <div
                                        className={`w-full max-w-[12px] rounded-t-lg transition-all duration-1000 ease-out ${isToday ? 'bg-accent shadow-[0_0_20px_rgba(255,160,0,0.6)]' : 'bg-primary/40 group-hover:bg-primary/80'}`}
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-500 uppercase px-1">
                        <span>Lun</span>
                        <span>Mar</span>
                        <span>Mié</span>
                        <span>Jue</span>
                        <span>Vie</span>
                        <span>Sáb</span>
                        <span>Dom</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full bg-primary hover:bg-primary/90 text-navy-dark h-16 rounded-full flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(57,224,121,0.2)] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined font-black !text-3xl">add_shopping_cart</span>
                        <span className="text-lg font-extrabold uppercase tracking-tight">Registrar Venta</span>
                    </button>

                    <button
                        onClick={startRedeemScanner}
                        className="w-full bg-accent hover:bg-yellow-500 text-navy-dark h-16 rounded-full flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(255,160,0,0.2)] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined font-black !text-3xl">redeem</span>
                        <span className="text-lg font-extrabold uppercase tracking-tight">Canjear Premio</span>
                    </button>
                </div>

                {/* Activity Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Actividad Reciente</h2>
                        <a className="text-xs font-bold text-accent" href="#">Ver todo</a>
                    </div>

                    <div className="space-y-3">
                        {activities.length > 0 ? activities.map((activity) => (
                            <div key={activity.id} className="flex items-center justify-between p-4 bg-navy-card rounded-full border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full ${activity.type === 'EARN' ? 'bg-primary/10' : 'bg-accent/10'} flex items-center justify-center`}>
                                        <span className={`material-symbols-outlined ${activity.type === 'EARN' ? 'text-primary' : 'text-accent'} !text-xl`}>
                                            {activity.type === 'EARN' ? 'add_task' : 'stars'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold truncate">{activity.profiles?.full_name || 'Cliente'}</p>
                                        <p className="text-[11px] text-slate-400">{formatTime(activity.created_at)}</p>
                                    </div>
                                </div>
                                <p className={`text-sm font-extrabold ${activity.type === 'EARN' ? 'text-primary' : 'text-accent'}`}>
                                    {activity.points_amount > 0 ? '+' : ''}{activity.points_amount} pts
                                </p>
                            </div>
                        )) : (
                            <p className="text-center text-slate-500 py-4 text-sm font-medium italic">Sin actividad reciente</p>
                        )}
                    </div>
                </div>
            </main>

            {/* Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-50">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-1 text-primary"
                >
                    <span className="material-symbols-outlined font-bold">dashboard</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Panel</span>
                </button>
                <button
                    onClick={() => navigate('/clients')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">group</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Clientes</span>
                </button>
                <button
                    onClick={() => navigate('/prizes')}
                    className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-symbols-outlined">featured_seasonal_and_gifts</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Premios</span>
                </button>
                <button
                    onClick={() => navigate('/settings')}
                    className="flex flex-col items-center gap-1 text-slate-500"
                >
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes</span>
                </button>
            </nav>

            {/* REGISTER SALE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-navy-dark/95 backdrop-blur-md" onClick={closeModal}></div>

                    <div className="relative w-full max-w-md bg-navy-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8">
                            <div className="relative flex items-center gap-4 mb-10 pt-2">
                                <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_20px_rgba(57,224,121,0.2)]">
                                    <span className="material-symbols-outlined !text-3xl font-bold">point_of_sale</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-black text-white leading-tight tracking-tight">Asignación de Puntos</h2>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">REGISTRAR NUEVA VENTA</p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="absolute -top-4 -right-4 size-12 rounded-full bg-navy-card border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 shadow-2xl transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">close</span>
                                </button>
                            </div>

                            {saleStep === 1 ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-5">
                                        {/* exchange Rate (Prominent) */}
                                        <div className="bg-navy-dark/80 border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-inner">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                                                    <span className="material-symbols-outlined text-xl">currency_exchange</span>
                                                </div>
                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tasa de Cambio</span>
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    value={exchangeRate}
                                                    onChange={(e) => {
                                                        const rate = e.target.value;
                                                        setExchangeRate(rate);
                                                        const numRate = parseFloat(rate);
                                                        if (amountBs && numRate > 0) {
                                                            setAmount((parseFloat(amountBs) / numRate).toFixed(2));
                                                        }
                                                    }}
                                                    className="w-24 bg-navy-card border border-primary/30 h-10 rounded-xl px-3 text-right text-lg font-black text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all group-hover:border-primary"
                                                />
                                                <span className="absolute -left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[10px] text-primary/40">edit</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Amount Bolivares */}
                                            <div className="relative group">
                                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500 group-focus-within:text-white transition-colors">Bs.</span>
                                                <input
                                                    type="number"
                                                    value={amountBs}
                                                    onChange={(e) => {
                                                        const bs = e.target.value;
                                                        setAmountBs(bs);
                                                        if (bs && exchangeRate) {
                                                            setAmount((parseFloat(bs) / exchangeRate).toFixed(2));
                                                        } else {
                                                            setAmount('');
                                                        }
                                                    }}
                                                    className="w-full bg-navy-dark/50 border border-white/10 h-16 rounded-full text-2xl font-black text-white pl-14 pr-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    placeholder="Monto en Bolívares"
                                                />
                                            </div>

                                            {/* Amount Dollars (Main) */}
                                            <div className="relative group">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-primary"> $ </span>
                                                <input
                                                    type="number"
                                                    autoFocus
                                                    value={amount}
                                                    onChange={(e) => {
                                                        const usd = e.target.value;
                                                        setAmount(usd);
                                                        if (usd && exchangeRate) {
                                                            setAmountBs((parseFloat(usd) * exchangeRate).toFixed(2));
                                                        } else {
                                                            setAmountBs('');
                                                        }
                                                    }}
                                                    className="w-full bg-navy-dark border-2 border-primary/20 h-24 rounded-3xl text-5xl font-black text-white pl-16 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 outline-none transition-all shadow-2xl"
                                                    placeholder="0.00"
                                                />
                                                <label className="absolute -top-3 left-6 bg-navy-card px-3 text-[10px] font-black text-primary uppercase tracking-widest border border-primary/20 rounded-full">Recibir en USD</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            disabled={!amount || parseFloat(amount) <= 0}
                                            onClick={startScanner}
                                            className="w-full bg-primary hover:bg-primary/90 text-navy-dark h-16 rounded-full font-black text-lg uppercase shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all"
                                        >
                                            Escanear QR
                                            <span className="material-symbols-outlined">qr_code_scanner</span>
                                        </button>

                                        <button
                                            onClick={() => setSaleStep(3)}
                                            className="w-full bg-white/5 hover:bg-white/10 text-white h-14 rounded-full font-bold text-sm uppercase transition-all flex items-center justify-center gap-2 border border-white/10"
                                        >
                                            O buscar por correo
                                            <span className="material-symbols-outlined text-base">mail</span>
                                        </button>
                                    </div>
                                </div>
                            ) : saleStep === 2 ? (
                                <div className="space-y-6 text-center">
                                    <div className="bg-navy-dark rounded-3xl overflow-hidden border border-white/10 relative min-h-[300px] flex items-center justify-center">
                                        {isProcessing ? (
                                            <div className="flex flex-col items-center gap-4">
                                                <span className="animate-spin material-symbols-outlined text-primary text-5xl">refresh</span>
                                                <p className="font-bold text-sm text-primary">Procesando puntos...</p>
                                            </div>
                                        ) : (
                                            <div id="reader" className="w-full"></div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-slate-200 font-bold">Monto: <span className="text-primary text-xl">${amount}</span></p>
                                        <button
                                            onClick={() => {
                                                if (window.scanner) window.scanner.clear().catch(e => console.log(e));
                                                setSaleStep(1);
                                            }}
                                            className="text-slate-400 text-sm font-bold flex items-center gap-1 hover:text-white"
                                        >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                            Cambiar Monto
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Step 3: Manual Search
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <p className="text-primary text-xl font-black mb-1">${amount}</p>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Monto a registrar</p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-slate-400 mb-2 block ml-1">Correo del Cliente</label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                autoFocus
                                                value={searchEmail}
                                                onChange={(e) => setSearchEmail(e.target.value)}
                                                className="w-full bg-navy-dark border border-white/10 h-14 rounded-full text-white px-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                                                placeholder="ejemplo@correo.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            disabled={!searchEmail || isProcessing}
                                            onClick={handleManualSearch}
                                            className="w-full bg-primary hover:bg-primary/90 text-navy-dark h-16 rounded-full font-black text-lg uppercase shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                        >
                                            {isProcessing ? 'Validando...' : 'Validar y Registrar'}
                                            <span className="material-symbols-outlined">how_to_reg</span>
                                        </button>

                                        <button
                                            onClick={() => setSaleStep(1)}
                                            className="w-full text-slate-400 text-sm font-bold hover:text-white py-2"
                                        >
                                            Volver
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* REDEEM REWARD MODAL */}
            {isRedeemModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-navy-dark/95 backdrop-blur-md" onClick={closeRedeemModal}></div>

                    <div className="relative w-full max-w-md bg-navy-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-8 pb-4 shrink-0">
                            <div className="relative flex items-center gap-4 mb-2 pt-2">
                                <div className="size-12 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/30 shadow-[0_0_20px_rgba(255,160,0,0.2)]">
                                    <span className="material-symbols-outlined !text-3xl font-bold">redeem</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-black text-white leading-tight tracking-tight">Canje de Premio</h2>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">RECOMPENSAS DEL CLUB</p>
                                </div>
                                <button
                                    onClick={closeRedeemModal}
                                    className="absolute -top-4 -right-4 size-12 rounded-full bg-navy-card border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 shadow-2xl transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-0">
                            {redeemStep === 1 ? (
                                <div className="space-y-6 text-center">
                                    <div className="bg-navy-dark rounded-3xl overflow-hidden border border-white/10 relative min-h-[300px] flex items-center justify-center">
                                        {isProcessing ? (
                                            <div className="flex flex-col items-center gap-4">
                                                <span className="animate-spin material-symbols-outlined text-accent text-5xl">refresh</span>
                                                <p className="font-bold text-sm text-accent">Buscando cliente...</p>
                                            </div>
                                        ) : (
                                            <div id="redeem-reader" className="w-full"></div>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">Escanea el código QR del cliente para ver sus puntos disponibles.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Client Summary */}
                                    <div className="bg-navy-dark/50 border border-white/10 rounded-3xl p-5 flex items-center gap-4 shadow-inner">
                                        <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <span className="material-symbols-outlined text-primary text-2xl">person</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white">{redeemClient?.profiles?.full_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="material-symbols-outlined text-accent text-lg">stars</span>
                                                <span className="text-xl font-black text-accent">{redeemClient?.current_points?.toLocaleString()} pts</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rewards List */}
                                    <div className="space-y-3">
                                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Premios Disponibles</h4>
                                        {availableRewards.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-3">
                                                {availableRewards.map((reward) => {
                                                    const canAfford = redeemClient?.current_points >= reward.cost_points;
                                                    return (
                                                        <button
                                                            key={reward.id}
                                                            disabled={!canAfford || isProcessing}
                                                            onClick={() => handleProcessRedeem(reward)}
                                                            className={`bg-navy-dark/40 border ${canAfford ? 'border-white/10 hover:border-accent/40' : 'border-red-500/20 opacity-60'} p-3 rounded-2xl flex items-center gap-4 transition-all group text-left relative overflow-hidden`}
                                                        >
                                                            <div className="size-16 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/10">
                                                                {reward.image_url ? (
                                                                    <img src={reward.image_url} alt={reward.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-slate-600 text-2xl">redeem</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h5 className="font-bold text-sm text-slate-100 truncate">{reward.name}</h5>
                                                                <p className="text-[10px] text-accent font-black tracking-widest mt-1">{reward.cost_points} PTS</p>
                                                            </div>
                                                            {canAfford ? (
                                                                <span className="material-symbols-outlined text-accent opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                                                            ) : (
                                                                <span className="text-[9px] font-black text-red-500 uppercase">Faltan puntos</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center text-slate-500 italic text-sm">No hay premios configurados hoy.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default Home;
