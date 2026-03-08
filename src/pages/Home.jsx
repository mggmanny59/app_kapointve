import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useNotification } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import Navigation from '../components/Navigation';
import MessageCenter from '../components/MessageCenter';
import SendNotificationModal from '../components/SendNotificationModal';
import { subscribeUserToPush, sendPushToProfile } from '../lib/pushNotifications';
import { forceAppUpdate } from '../utils/appUpdate';

const Home = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ sales: 0, points: 0, newClients: 0, totalClients: 0 });
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
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    const [isRateSuccessful, setIsRateSuccessful] = useState(false);

    // Redeem State
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redeemStep, setRedeemStep] = useState(1); // 1: Scanner, 2: Reward Selection
    const [redeemClient, setRedeemClient] = useState(null);
    const [availableRewards, setAvailableRewards] = useState([]);
    const [selectedReward, setSelectedReward] = useState(null);

    const [userPermissions, setUserPermissions] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
    const { unreadCount } = useMessages();
    const [isBusinessQRModalOpen, setIsBusinessQRModalOpen] = useState(false);
    const [showPushBanner, setShowPushBanner] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

    useEffect(() => {
        const checkPushStatus = async () => {
            if ('Notification' in window) {
                if (Notification.permission === 'default') {
                    setShowPushBanner(true);
                } else if (Notification.permission === 'granted') {
                    // Solo marcar como suscrito si realmente existe una suscripción activa
                    const registration = await navigator.serviceWorker.ready;
                    const sub = await registration.pushManager.getSubscription();
                    if (sub) {
                        setIsSubscribed(true);
                        // Proactivamente asegurar que la suscripción esté en la DB
                        const { data: { user: currentUser } } = await supabase.auth.getUser();
                        if (currentUser) {
                            await subscribeUserToPush();
                            console.log('Push subscription synced on load (Client)');
                        }
                    } else {
                        // Tenemos permiso pero NO hay suscripción activa
                        setIsSubscribed(false);
                        setShowPushBanner(true);
                    }
                } else if (Notification.permission === 'denied') {
                    // Si está denegado, no mostramos banner (política de navegador)
                    setIsSubscribed(false);
                }
            } else {
                console.log('Notificaciones no soportadas en este navegador/dispositivo.');
            }
        };
        // Ejecutar inmediatamente
        checkPushStatus();

        // Ejecutar cuando el usuario esté listo
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
            showNotification('warning', 'Aviso', `No se pudieron activar las notificaciones: ${error.message}`);
        }
    };

    const handleTestPush = async () => {
        const result = await sendPushToProfile({
            profileId: user.id,
            title: 'Prueba de KPoint',
            message: '¡Funciona! Esta es una notificación push de prueba.',
            url: '/dashboard'
        });

        if (result.success) {
            showNotification('success', 'Enviado', 'Se ha enviado la señal de prueba. Debería llegar en unos segundos.');
        } else {
            showNotification('error', 'Error', 'No se pudo enviar la prueba: ' + result.error);
        }
    };

    const businessId = profile?.business_members?.[0]?.business_id || '00000000-0000-0000-0000-000000000001';

    const fetchDashboardData = async () => {
        try {
            // 1. Fetch Profile and Business ID with Permissions
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, business_members(business_id, role, permissions, businesses(name, registration_data, business_code))')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            setProfile(profileData);
            const memberInfo = profileData.business_members?.[0];
            setBusiness(memberInfo?.businesses || null);
            setUserRole(memberInfo?.role || 'client');
            setUserPermissions(memberInfo?.permissions || {
                can_earn: true,
                can_redeem: true,
                can_view_clients: true
            });

            const currentBizId = memberInfo?.business_id || '00000000-0000-0000-0000-000000000001';

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

            // Total Clients (Afiliados)
            const { count: totalClientsCount } = await supabase
                .from('loyalty_cards')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', currentBizId);

            setStats({
                sales: totalSales,
                points: totalPoints,
                newClients: newClientsCount || 0,
                totalClients: totalClientsCount || 0,
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

    const fetchBCVRate = async () => {
        setIsFetchingRate(true);
        setIsRateSuccessful(false);
        try {
            const { data, error } = await supabase.functions.invoke('get-bcv-rate', { method: 'GET' });

            if (error) throw error;

            if (data?.rate) {
                console.log('Exchange Rate fetched:', data.rate);
                setExchangeRate(parseFloat(data.rate).toFixed(2));
                setIsRateSuccessful(true);
                if (amount) {
                    setAmountBs((parseFloat(amount) * data.rate).toFixed(2));
                }
            } else {
                console.error('BCV Function Error:', data?.error);
                setIsRateSuccessful(false);
            }
        } catch (err) {
            console.error('Error fetching rate:', err);
            setIsRateSuccessful(false);
        } finally {
            setIsFetchingRate(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchDashboardData();
            fetchBCVRate();
        }
    }, [user]);

    // Refresh rate specifically when opening the modal to ensure it's up to date
    useEffect(() => {
        if (isModalOpen && saleStep === 1) {
            fetchBCVRate();
        }
    }, [isModalOpen, saleStep]);

    // Real-time listener for business activity
    useEffect(() => {
        if (!user || !profile?.business_members?.[0]?.business_id) return;

        const currentBizId = profile.business_members[0].business_id;
        console.log(`Configurando Realtime para negocio: ${currentBizId}`);

        const channel = supabase
            .channel(`business-activity-${currentBizId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: `business_id=eq.${currentBizId}`
                },
                (payload) => {
                    console.log('Operación de negocio detectada:', payload.new);

                    // Notificar visualmente en el dashboard
                    if (payload.new.type === 'EARN') {
                        showNotification('success', '¡Nueva Venta!', `Se han asignado ${payload.new.points_amount} puntos.`);
                    } else if (payload.new.type === 'REDEEM') {
                        showNotification('success', '¡Canje Realizado!', 'Un cliente ha canjeado sus puntos.');
                    }

                    // Actualizar estadísticas del dashboard
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, profile]);

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
            fetchDashboardData();

            // 1. BROADCAST REALTIME: Envío directo al cliente para actualización INSTANTÁNEA
            const pointsToGain = (parseFloat(amount) * (business?.points_per_dollar || 10)).toFixed(0);
            const broadcastChannel = supabase.channel(`client-points-realtime-${clientId}`);
            broadcastChannel.send({
                type: 'broadcast',
                event: 'points_earned',
                payload: {
                    businessName: business?.name || 'Comercio',
                    points: pointsToGain,
                    amountUSD: amount
                }
            });

            // 2. NOTIFICACIÓN PUSH: Para cuando el app está cerrada
            sendPushToProfile({
                profileId: clientId,
                title: business?.name || 'KPoint',
                message: `¡Has ganado ${pointsToGain} puntos!`,
                url: '/my-points'
            });
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
                    }, 800);
                    return;
                } else {
                    showNotification('warning', 'Premio no disponible', 'El premio solicitado no está activo en este comercio.');
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

        if (Number(client.current_points) < Number(reward.cost_points)) {
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
                    points_amount: -Math.abs(reward.cost_points),
                    type: 'REDEEM',
                    description: `Canje de premio: ${reward.name}`
                });

            if (txError) throw txError;

            // 2. Manually update points in loyalty_cards for immediate balance reflection
            const { error: updateError } = await supabase
                .from('loyalty_cards')
                .update({
                    current_points: Number(client.current_points) - Number(reward.cost_points),
                    last_activity: new Date().toISOString()
                })
                .eq('id', client.id);

            if (updateError) console.error('Error updating loyalty card directly:', updateError);

            // 3. Success Feedback & Cleanup
            await closeModal();
            await closeRedeemModal();

            showNotification('success', '¡Canje Procesado!', `Se ha canjeado "${reward.name}" por ${reward.cost_points} pts.`);

            // Refresh UI
            fetchDashboardData();

            // Enviar notificación Push al cliente
            sendPushToProfile({
                profileId: client.profile_id,
                title: business?.name || 'KPoint',
                message: `Has canjeado tus puntos por: ${reward.name}. ¡Disfrútalo!`,
                url: '/my-points'
            });
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
            fetchDashboardData();

            // Enviar notificación Push al cliente
            sendPushToProfile({
                profileId: profileData.id,
                title: business?.name || 'KPoint',
                message: `¡Has ganado ${(parseFloat(amount) * (business?.points_per_dollar || 10)).toFixed(0)} puntos!`,
                url: '/my-points'
            });
        } catch (err) {
            showNotification('error', 'Error en Registro', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const closeModal = async () => {
        setIsModalOpen(false);
        setSearchEmail('');
        setAmount('');
        setAmountBs('');
        setSaleStep(1);

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
    };

    const closeRedeemModal = async () => {
        setIsRedeemModalOpen(false);
        setRedeemClient(null);
        setAvailableRewards([]);
        setRedeemStep(1);

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
        <div className="relative flex min-h-screen w-full flex-col pb-24 bg-[#F0F2F5] font-display text-slate-900 antialiased">
            {/* Header */}
            <header className="pt-8 pb-4 px-6 flex items-center justify-between sticky top-0 bg-[#F0F2F5]/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border-2 border-[#595A5B]">
                        <span className="material-symbols-outlined text-primary">storefront</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight"><span className="text-primary">K</span>Point</h1>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Panel de Control</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsMessageCenterOpen(true)}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center relative group active:scale-90 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-primary text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Se reiniciará la aplicación para buscar actualizaciones. ¿Continuar?')) {
                                forceAppUpdate();
                            }
                        }}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center hover:text-primary transition-colors shadow-sm"
                        title="Forzar actualización"
                    >
                        <span className="material-symbols-outlined !text-[20px]">sync</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center hover:text-red-500 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            <main className="px-6 space-y-6">
                {/* Banner de Notificaciones Push */}
                {showPushBanner && (
                    <div className="bg-white border-2 border-[#595A5B] rounded-3xl p-6 flex flex-col gap-4 shadow-sm animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4">
                            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/10">
                                <span className="material-symbols-outlined !text-3xl">notifications_active</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">¡Activa las Notificaciones!</h3>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">Entérate al instante cuando ganes puntos o canjees premios.</p>
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
                                className="px-5 h-11 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 active:scale-95 transition-all"
                            >
                                Después
                            </button>
                        </div>
                    </div>
                )}

                {/* Botón de prueba (Solo si ya está suscrito) */}
                {isSubscribed && (
                    <button
                        onClick={handleTestPush}
                        className="w-full bg-navy-card border border-white/5 p-4 rounded-3xl flex items-center justify-center gap-3 text-slate-400 hover:text-white transition-colors group"
                    >
                        <span className="material-symbols-outlined text-primary group-hover:animate-bounce">send_and_archive</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Enviar Notificación de Prueba</span>
                    </button>
                )}

                {/* Business Info Section */}
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 leading-tight">
                        <span className="material-symbols-outlined text-primary !text-3xl">store</span>
                        {business?.name || 'Mi Negocio'}
                    </h2>

                    <div className="mt-4 space-y-1 ml-1">
                        <div className="flex items-center gap-2">
                            <p className="text-lg font-black text-primary uppercase tracking-wider">
                                {profile?.full_name || 'Cargando...'}
                            </p>
                            <div className={`size-3 rounded-full border-2 border-white shadow-sm ${isSubscribed ? 'bg-green-500' : 'bg-red-400'}`}
                                title={isSubscribed ? 'Suscrito a notificaciones' : 'Sin suscripción activa'}></div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest opacity-80">
                                {isSubscribed ? 'Alertas: Activas' : 'Alertas: Desconectadas'}
                            </p>
                            {!isSubscribed && (
                                <button
                                    onClick={handleEnablePush}
                                    className="text-[10px] font-black text-primary underline underline-offset-4 decoration-2 decoration-primary/30 hover:decoration-primary transition-all uppercase tracking-widest"
                                >
                                    ¡ACTIVAR AHORA!
                                </button>
                            )}
                            {(!('Notification' in window)) && (
                                <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase">
                                    Navegador no soporta Push
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Show My QR Button (Business Context) */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsBusinessQRModalOpen(true)}
                        className="flex flex-col items-center justify-center p-4 bg-white border-2 border-[#595A5B] rounded-3xl group active:scale-95 transition-all w-full shadow-sm"
                    >
                        <span className="material-symbols-outlined text-primary !text-2xl group-hover:scale-110 transition-transform">qr_code_2</span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Mi QR de Local</span>
                    </button>
                </div>

                {/* Action Buttons (Repositioned) */}
                <div className="grid grid-cols-2 gap-3">
                    {userPermissions?.can_earn && (
                        <button
                            onClick={() => {
                                if (profile?.business_members?.[0]?.businesses?.registration_data === false) {
                                    showNotification('warning', 'Datos Incompletos', 'Debe completar los datos del formulario "Ajustes del Negocio" para realizar esta acción.');
                                    return;
                                }
                                setIsModalOpen(true);
                            }}
                            className="w-full bg-primary hover:opacity-95 hover:scale-[1.02] text-white h-14 rounded-2xl flex items-center justify-center gap-2 border-2 border-[#1E293B] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined font-black !text-2xl">add_shopping_cart</span>
                            <span className="text-sm font-black uppercase tracking-tight">Registrar Venta</span>
                        </button>
                    )}

                    {userPermissions?.can_redeem && (
                        <button
                            onClick={() => {
                                if (stats.totalClients === 0) {
                                    showNotification('warning', 'Sin Clientes', 'Debe tener clientes afiliados a su comercio para canjear premios.');
                                    return;
                                }
                                startRedeemScanner();
                            }}
                            className="w-full bg-[#22C55E] hover:opacity-95 hover:scale-[1.02] text-white h-14 rounded-2xl flex items-center justify-center gap-2 border-2 border-[#1E293B] shadow-lg shadow-[#22C55E]/20 active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined font-black !text-2xl">redeem</span>
                            <span className="text-sm font-black uppercase tracking-tight">Canjear Premio</span>
                        </button>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-primary/5 size-16 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
                        <span className="material-symbols-outlined text-primary mb-2 block">payments</span>
                        <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mb-1">Ventas Hoy</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-slate-900">${stats.sales}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{stats.transactions} tx</p>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-yellow-500/5 size-16 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-all"></div>
                        <span className="material-symbols-outlined text-warning mb-2 block">stars</span>
                        <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mb-1">Puntos Dados</p>
                        <p className="text-2xl font-black text-slate-900">
                            {stats.points >= 1000 ? (stats.points / 1000).toFixed(1) + 'k' : stats.points}
                        </p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group col-span-2">
                        <div className="absolute -right-4 -top-4 bg-primary/5 size-24 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="material-symbols-outlined text-primary/80 mb-1 block">group</span>
                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mb-1">Clientes Activos Hoy</p>
                                <p className="text-2xl font-black text-slate-900">{stats.newClients}</p>
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
                <div className="bg-white p-5 rounded-3xl border-2 border-[#595A5B] shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Actividad de la Semana</h2>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">Ventas ($)</span>
                    </div>
                    <div className="relative h-40 w-full flex items-end justify-between px-2">
                        <div className="absolute inset-0 bg-slate-50/50 rounded-xl overflow-hidden"></div>
                        {weeklyActivity.map((value, index) => {
                            const maxVal = Math.max(...weeklyActivity, 1);
                            const height = (value / (maxVal * 1.1)) * 100;
                            const isToday = (new Date().getDay() === (index === 6 ? 0 : index + 1));

                            return (
                                <div key={index} className="flex flex-col items-center justify-end h-full flex-1 group relative z-10 px-1">
                                    <div
                                        className={`w-full max-w-[12px] rounded-t-lg transition-all duration-1000 ease-out ${isToday ? 'bg-warning shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-primary/30 group-hover:bg-primary/60'}`}
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] font-black text-slate-400 uppercase px-1 tracking-widest">
                        <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                    </div>
                </div>


                {/* Indicadores de Gestión KPI */}
                <div className="space-y-4 py-2">
                    <button
                        onClick={() => navigate('/kpi')}
                        className="w-full flex items-center justify-between p-4 bg-white border-2 border-[#595A5B] rounded-[2rem] shadow-sm hover:bg-slate-50 transition-colors active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-[#1E293B] flex items-center justify-center text-white border border-[#334155] shadow-inner">
                                <span className="material-symbols-outlined !text-xl">insights</span>
                            </div>
                            <span className="font-black text-slate-800 tracking-tight text-lg">Indicadores de Gestión (KPI)</span>
                        </div>
                        <span className="material-symbols-outlined text-slate-400">
                            chevron_right
                        </span>
                    </button>
                </div>

                {/* Activity Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Actividad Reciente</h2>
                        <a className="text-xs font-black text-primary" href="#">Ver todo</a>
                    </div>

                    <div className="space-y-3">
                        {activities.length > 0 ? activities.map((activity) => (
                            <div key={activity.id} className="flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-[#595A5B] shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full ${activity.type === 'EARN' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'} flex items-center justify-center`}>
                                        <span className={`material-symbols-outlined !text-xl`}>
                                            {activity.type === 'EARN' ? 'add_task' : 'stars'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate">{activity.profiles?.full_name || 'Cliente'}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{formatTime(activity.created_at)}</p>
                                    </div>
                                </div>
                                <p className={`text-sm font-black ${activity.type === 'EARN' ? 'text-primary' : 'text-warning'}`}>
                                    {activity.points_amount > 0 ? '+' : ''}{activity.points_amount} pts
                                </p>
                            </div>
                        )) : (
                            <p className="text-center text-slate-500 py-4 text-sm font-medium italic">Sin actividad reciente</p>
                        )}
                    </div>
                </div>

                {/* Secondary Action - Moved to end */}
                <div className="pt-2">
                    <button
                        onClick={() => setIsNotificationModalOpen(true)}
                        className="w-full bg-[#1E293B] hover:bg-slate-800 hover:scale-[1.01] border-2 border-[#334155] text-white h-14 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined font-black !text-2xl">notifications_active</span>
                        <span className="text-base font-black uppercase tracking-tight">Enviar Comunicado</span>
                    </button>
                </div>
            </main>

            <Navigation />

            {/* Message Center Drawer */}
            <MessageCenter
                isOpen={isMessageCenterOpen}
                onClose={() => setIsMessageCenterOpen(false)}
            />

            {/* MASS NOTIFICATION MODAL */}
            <SendNotificationModal
                isOpen={isNotificationModalOpen}
                onClose={() => setIsNotificationModalOpen(false)}
                businessId={profile?.business_members?.[0]?.business_id}
            />

            {/* REGISTER SALE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal}></div>

                    <div className="relative w-full max-w-[340px] bg-white border-2 border-[#595A5B] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6">
                            <div className="relative flex items-center gap-4 mb-6 pt-1">
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                                    <span className="material-symbols-outlined !text-2xl font-bold">point_of_sale</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">Asignación</h2>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">REGISTRAR VENTA</p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="absolute -top-2 -right-2 size-10 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined !text-xl group-hover:rotate-90 transition-transform">close</span>
                                </button>
                            </div>

                            {saleStep === 1 ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-slate-50 border-2 border-[#595A5B] rounded-3xl p-6 shadow-inner space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 shadow-sm">
                                                        <span className="material-symbols-outlined text-xl">currency_exchange</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Tasa de Cambio</span>
                                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2 ${isRateSuccessful ? 'text-primary' : 'text-orange-400'}`}>
                                                            <span className={`size-2 rounded-full ${isFetchingRate ? 'bg-orange-500 animate-spin border-t-transparent border-2' : isRateSuccessful ? 'bg-primary animate-pulse' : 'bg-orange-400'}`}></span>
                                                            {isFetchingRate ? 'Buscando...' : isRateSuccessful ? 'Oficial BCV OK' : 'Usando Manual'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    value={exchangeRate}
                                                    onChange={(e) => {
                                                        const rate = e.target.value;
                                                        setExchangeRate(rate);
                                                        setIsRateSuccessful(false); // If they edit it, it's manual
                                                        const numRate = parseFloat(rate);
                                                        if (amountBs && numRate > 0) {
                                                            setAmount((parseFloat(amountBs) / numRate).toFixed(2));
                                                        }
                                                    }}
                                                    className="w-full bg-white border-2 border-[#595A5B]  -2xl px-4 text-center text-4xl font-black text-slate-900 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 outline-none transition-all shadow-sm"
                                                />
                                                <label className="absolute -top-2.5 left-6 bg-slate-50 px-3 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] border-2 border-[#595A5B] rounded-full shadow-sm">Valor USD en Bolívares</label>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 group-focus-within:text-primary transition-colors">Bs.</span>
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
                                                    className="w-full bg-slate-50 border-2 border-[#595A5B]  -2xl text-2xl font-black text-slate-900 pl-14 pr-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                                    placeholder="Monto Bs."
                                                />
                                            </div>

                                            <div className="relative group">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-black text-primary"> $ </span>
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
                                                    className="w-full bg-white border-2 border-primary/20 h-24 rounded-3xl text-5xl font-black text-slate-900 pl-16 pr-6 focus:ring-8 focus:ring-primary/10 focus:border-primary/40 outline-none transition-all shadow-2xl"
                                                    placeholder="0.00"
                                                />
                                                <label className="absolute -top-3 left-8 bg-white px-3 py-0.5 text-[9px] font-black text-primary uppercase tracking-widest border border-primary/20 rounded-full shadow-lg">Recibir en USD</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            disabled={!amount || parseFloat(amount) <= 0 || isFetchingRate}
                                            onClick={startScanner}
                                            className="w-full bg-primary hover:bg-primary/90 text-white h-16 rounded-2xl font-black text-lg uppercase shadow-[0_10px_25px_rgba(34,197,94,0.2)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
                                        >
                                            Escanear QR
                                            <span className="material-symbols-outlined !text-2xl">qr_code_scanner</span>
                                        </button>

                                        <button
                                            onClick={() => setSaleStep(3)}
                                            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 h-14 rounded-full font-bold text-sm uppercase transition-all flex items-center justify-center gap-2 border-2 border-[#595A5B]"
                                        >
                                            O buscar por correo
                                            <span className="material-symbols-outlined text-base">mail</span>
                                        </button>
                                    </div>
                                </div>
                            ) : saleStep === 2 ? (
                                <div className="space-y-6 text-center">
                                    <div className="bg-navy-dark rounded-3xl overflow-hidden border-2 border-[#595A5B] relative min-h-[300px] flex items-center justify-center">
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
                                                if (window.scannerInstance) window.scannerInstance.stop().catch(() => { });
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
                                                className="w-full bg-slate-50 border-2 border-[#595A5B]  -full text-slate-900 px-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                                                placeholder="ejemplo@correo.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            disabled={!searchEmail || isProcessing}
                                            onClick={handleManualSearch}
                                            className="w-full bg-primary hover:bg-primary/90 text-white h-16 rounded-full font-black text-lg uppercase shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all font-display"
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
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeRedeemModal}></div>

                    <div className="relative w-full max-w-md bg-white border-2 border-[#595A5B] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-8 pb-4 shrink-0">
                            <div className="relative flex items-center gap-4 mb-2 pt-2">
                                <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shadow-sm">
                                    <span className="material-symbols-outlined !text-3xl font-bold">redeem</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Canje de Premio</h2>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">RECOMPENSAS DEL CLUB</p>
                                </div>
                                <button
                                    onClick={closeRedeemModal}
                                    className="absolute -top-4 -right-4 size-12 rounded-full bg-white border-2 border-[#595A5B] flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-xl transition-all active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-0">
                            {redeemStep === 1 ? (
                                <div className="space-y-6 text-center">
                                    <div className="bg-slate-50 rounded-3xl overflow-hidden border-2 border-[#595A5B] relative min-h-[300px] flex items-center justify-center">
                                        {isProcessing ? (
                                            <div className="flex flex-col items-center gap-4">
                                                <span className="animate-spin material-symbols-outlined text-warning text-5xl">refresh</span>
                                                <p className="font-bold text-sm text-warning">Buscando cliente...</p>
                                            </div>
                                        ) : (
                                            <div id="redeem-reader" className="w-full"></div>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium">Escanea el código QR del cliente para ver sus puntos disponibles.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 border-2 border-[#595A5B] rounded-3xl p-5 flex items-center gap-4 shadow-inner">
                                        <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <span className="material-symbols-outlined text-primary text-2xl">person</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{redeemClient?.profiles?.full_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="material-symbols-outlined text-warning text-lg">stars</span>
                                                <span className="text-xl font-black text-warning">{redeemClient?.current_points?.toLocaleString()} pts</span>
                                            </div>
                                        </div>
                                    </div>

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
                                                            className={`bg-white border ${canAfford ? 'border-[#595A5B] hover:border-primary shadow-sm active:scale-95' : 'border-[#595A5B] opacity-50 cursor-not-allowed'} p-3 rounded-2xl flex items-center gap-4 transition-all group text-left relative overflow-hidden`}
                                                        >
                                                            <div className="size-16 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border-2 border-[#595A5B]">
                                                                {reward.image_url ? (
                                                                    <img src={reward.image_url} alt={reward.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-slate-400">redeem</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h5 className="font-bold text-sm text-slate-900 truncate">{reward.name}</h5>
                                                                <p className="text-[10px] text-warning font-black tracking-widest mt-1">{reward.cost_points} PTS</p>
                                                            </div>
                                                            {canAfford ? (
                                                                <span className="material-symbols-outlined text-warning opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
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
                                    <button
                                        onClick={() => setRedeemStep(1)}
                                        className="w-full text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 py-2 transition-colors"
                                    >
                                        ← Escanear otro cliente
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Business QR Modal (For customer affiliation) */}
            {isBusinessQRModalOpen && (
                <div className="fixed inset-0 z-[115] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-[340px] rounded-[3rem] border-2 border-[#595A5B] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-8 pb-4 text-center space-y-2">
                            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4 border border-primary/20">
                                <span className="material-symbols-outlined !text-4xl">storefront</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">QR de Afiliación</h3>
                            <p className="text-xs text-slate-500 font-medium px-2">Invita a tus clientes a escanear este código para unirse a tu club.</p>
                        </div>

                        {/* QR Area */}
                        <div className="px-8 py-6 flex flex-col items-center">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-[#595A5B] relative">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full border-2 border-[#595A5B] text-[10px] font-black text-primary uppercase tracking-widest shadow-sm">
                                    {profile?.business_members?.[0]?.businesses?.business_code || '------'}
                                </div>
                                <QRCodeSVG
                                    value={profile?.business_members?.[0]?.businesses?.business_code || 'no-code'}
                                    size={180}
                                    level="H"
                                    includeMargin={false}
                                />
                            </div>
                            <p className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center px-4">
                                "Tus clientes se afilian al instante con solo escanear"
                            </p>
                        </div>

                        {/* Action */}
                        <div className="p-8 pt-2">
                            <button
                                onClick={() => setIsBusinessQRModalOpen(false)}
                                className="w-full h-14 bg-primary text-white rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                LISTO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
