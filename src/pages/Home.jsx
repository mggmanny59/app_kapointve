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
        try {
            // 1. Buscar todos los clientes del negocio que tienen suscripción push activa
            const currentBusinessId = profile?.business_members?.[0]?.business_id;
            if (!currentBusinessId) {
                showNotification('error', 'Error', 'No se encontró el negocio asociado.');
                return;
            }

            const { data: clients, error: fetchError } = await supabase
                .from('loyalty_cards')
                .select('profile_id')
                .eq('business_id', currentBusinessId);

            if (fetchError) throw fetchError;

            if (!clients || clients.length === 0) {
                showNotification('warning', 'Sin clientes', 'No hay clientes registrados para enviarles pruebas.');
                return;
            }

            let successCount = 0;
            for (const client of clients) {
                await sendPushToProfile({
                    profileId: client.profile_id,
                    title: business?.name || 'KPoint',
                    message: `📢 ¡Mensaje de prueba para todos! Gracias por ser parte de ${business?.name || 'KPoint'}. 🎉`,
                    url: '/my-points'
                });
                successCount++;
            }
            showNotification('success', 'Prueba Enviada', `Se enviaron ${successCount} avisos.`);

        } catch (error) {
            console.error('Error en prueba push:', error);
            showNotification('error', 'Error', 'No se pudo enviar la prueba: ' + error.message);
        }
    };

    /**
     * Envía una notificación Push inteligente "Meta Alcanzada" o personalizada al cliente
     */
    const notifyConversion = async (profileId, pointsEarned) => {
        try {
            // 1. Obtener nombre del cliente
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', profileId)
                .single();

            const clientFirstName = profileData?.full_name?.split(' ')[0] || 'Cliente';

            // 2. Obtener saldo actualizado (esperamos un momento para que el trigger procese)
            await new Promise(resolve => setTimeout(resolve, 800));

            const { data: cardData } = await supabase
                .from('loyalty_cards')
                .select('current_points')
                .eq('profile_id', profileId)
                .eq('business_id', businessId)
                .single();

            const currentPoints = cardData?.current_points || 0;

            // 3. Obtener premios activos del comercio
            const { data: rewards } = await supabase
                .from('rewards')
                .select('name, cost_points')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('cost_points', { ascending: false });

            // 4. Buscar si alcanzó una meta (el premio más caro que puede pagar)
            const reachableRewards = rewards?.filter(r => currentPoints >= r.cost_points) || [];

            let pushMessage = '';
            if (reachableRewards.length > 0) {
                const topReward = reachableRewards[0];
                pushMessage = `¡Felicidades ${clientFirstName}! 🎉 Ya tienes suficientes puntos para: ${topReward.name} 🎁✨`;
            } else {
                pushMessage = `¡Hola ${clientFirstName}! Sumaste ${pointsEarned} puntos en ${business?.name || 'KPoint'} 🎉 ✨`;
            }

            // 5. Enviar Push
            await sendPushToProfile({
                profileId,
                title: business?.name || 'KPoint',
                message: pushMessage,
                url: '/my-points'
            });

        } catch (error) {
            console.error('Error en notifyConversion:', error);
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
            console.log('Intentando obtener tasa vía Supabase...');
            const { data, error } = await supabase.functions.invoke('get-bcv-rate');

            if (error) throw error;

            if (data?.rate) {
                const newRate = parseFloat(data.rate).toFixed(2);
                setExchangeRate(newRate);
                setIsRateSuccessful(true);
                if (amount) setAmountBs((parseFloat(amount) * data.rate).toFixed(2));
                return;
            }
            throw new Error('Respuesta de Supabase sin tasa');

        } catch (err) {
            console.warn('Supabase BCV falló, iniciando Plan B (API Pública de respaldo)...');
            try {
                // Plan B: API Pública de respaldo (DolarAPI - Oficial)
                const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.promedio) {
                        const newRate = parseFloat(data.promedio).toFixed(2);
                        console.log('Tasa obtenida vía Plan B:', newRate);
                        setExchangeRate(newRate);
                        setIsRateSuccessful(true);
                        if (amount) setAmountBs((parseFloat(amount) * data.promedio).toFixed(2));
                    }
                }
            } catch (fallbackErr) {
                console.error('Error en ambos métodos de obtención de tasa:', fallbackErr);
            }
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

            // 2. NOTIFICACIÓN PUSH PERSONALIZADA (Opción C: Meta Alcanzada)
            notifyConversion(clientId, pointsToGain);
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

            // 4. Notificación Push Personalizada para Canje
            const { data: clientProfile } = await supabase.from('profiles').select('full_name').eq('id', client.profile_id).single();
            const clientName = clientProfile?.full_name?.split(' ')[0] || 'Cliente';

            sendPushToProfile({
                profileId: client.profile_id,
                title: business?.name || 'KPoint',
                message: `¡Genial ${clientName}! 🎁 Disfruta tu premio: ${reward.name}. ✨ ¡Gracias por preferirnos! 🎉`,
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

            // 6. Notificación Push Personalizada (Meta Alcanzada)
            notifyConversion(profileData.id, (parseFloat(amount) * (business?.points_per_dollar || 10)).toFixed(0));
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

                {/* Botón de prueba Administrador */}
                <button
                    onClick={handleTestPush}
                    className="w-full bg-navy-card border border-white/5 p-4 rounded-3xl flex items-center justify-center gap-3 text-slate-400 hover:text-white transition-colors group"
                >
                    <span className="material-symbols-outlined text-primary group-hover:animate-bounce">send_and_archive</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Enviar Notificación a Clientes</span>
                </button>

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

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsBusinessQRModalOpen(true)}
                        className="w-full h-16 bg-white border-2 border-[#595A5B] rounded-[2rem] flex items-center justify-start px-6 gap-4 group active:scale-95 transition-all shadow-sm relative overflow-hidden"
                    >
                        <div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-primary shrink-0 border border-primary/10 group-hover:scale-110 transition-transform relative z-10">
                            <span className="material-symbols-outlined font-black !text-2xl">qr_code_2</span>
                        </div>
                        <div className="flex flex-col items-start leading-none text-left relative z-10">
                            <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest mb-0.5">Invitar Clientes</span>
                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Mi QR de Local</span>
                        </div>
                        {/* QR decorativo de fondo */}
                        <div className="absolute right-[-10%] top-[-20%] opacity-[0.05] rotate-12 pointer-events-none transition-transform group-hover:rotate-0 duration-700">
                             <span className="material-symbols-outlined !text-[100px] text-slate-900">qr_code_2</span>
                        </div>
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
                                setAmount('0.00');
                                setAmountBs('0.00');
                                setIsModalOpen(true);
                            }}
                            className="w-full bg-primary hover:opacity-95 hover:scale-[1.02] text-white h-16 rounded-2xl flex items-center justify-start px-6 gap-4 border-2 border-[#1E293B] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined font-black !text-2xl shrink-0">add_shopping_cart</span>
                            <div className="flex flex-col items-start leading-none text-left">
                                <span className="text-[9px] font-black opacity-70 uppercase tracking-widest mb-0.5">Ventas</span>
                                <span className="text-xs font-black uppercase tracking-tight">Registrar Venta</span>
                            </div>
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
                            className="w-full bg-[#22C55E] hover:opacity-95 hover:scale-[1.02] text-white h-16 rounded-2xl flex items-center justify-start px-6 gap-4 border-2 border-[#1E293B] shadow-lg shadow-[#22C55E]/20 active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined font-black !text-2xl shrink-0">redeem</span>
                            <div className="flex flex-col items-start leading-none text-left">
                                <span className="text-[9px] font-black opacity-70 uppercase tracking-widest mb-0.5">Lealtad</span>
                                <span className="text-xs font-black uppercase tracking-tight">Canjear Premio</span>
                            </div>
                        </button>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-primary/5 size-12 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
                        <span className="material-symbols-outlined text-primary mb-1 block !text-[20px]">payments</span>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Ventas Hoy</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-lg font-black text-slate-900">${stats.sales}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{stats.transactions} tx</p>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 bg-yellow-500/5 size-12 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-all"></div>
                        <span className="material-symbols-outlined text-warning mb-1 block !text-[20px]">stars</span>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Puntos Dados</p>
                        <p className="text-lg font-black text-slate-900">
                            {stats.points >= 1000 ? (stats.points / 1000).toFixed(1) + 'k' : stats.points}
                        </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-3xl border-2 border-[#595A5B] shadow-sm relative overflow-hidden group col-span-2">
                        <div className="absolute -right-4 -top-4 bg-primary/5 size-20 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="material-symbols-outlined text-primary/80 mb-0.5 block !text-[20px]">group</span>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Clientes Activos Hoy</p>
                                <p className="text-lg font-black text-slate-900">{stats.newClients}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] text-primary font-black bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                    + {stats.newClients} hoy
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                {/* Chart Section - Rediseño Premium */}
                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-[#595A5B] shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Análisis Semanal</h2>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Rendimiento de Ventas</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="size-2 rounded-full bg-primary animate-pulse"></div>
                             <span className="text-[10px] bg-primary/5 text-primary border border-primary/10 px-3 py-1 rounded-full font-black uppercase tracking-widest">En Vivo</span>
                        </div>
                    </div>

                    <div className="relative h-44 w-full flex items-end justify-between px-2">
                        {/* Líneas de referencia (Grid) */}
                        <div className="absolute inset-x-0 bottom-0 h-full flex flex-col justify-between opacity-5 pointer-events-none">
                            <div className="w-full border-t border-slate-900"></div>
                            <div className="w-full border-t border-slate-900"></div>
                            <div className="w-full border-t border-slate-900"></div>
                            <div className="w-full border-t border-slate-900"></div>
                        </div>

                        {weeklyActivity.map((value, index) => {
                            const maxVal = Math.max(...weeklyActivity, 1);
                            const height = (value / (maxVal * 1.1)) * 100;
                            const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                            const isToday = (new Date().getDay() === (index === 6 ? 0 : index + 1));

                            return (
                                <div key={index} className="flex flex-col items-center justify-end h-full flex-1 group relative z-10">
                                    {/* Tooltip on Hover */}
                                    <div className="absolute -top-8 px-2 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 pointer-events-none shadow-xl border border-white/10">
                                        ${value}
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>

                                    {/* Bar with gradient */}
                                    <div
                                        className={`w-[14px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative active:scale-95 shadow-lg ${
                                            isToday 
                                            ? 'bg-gradient-to-t from-orange-600 to-orange-400 shadow-orange-500/30' 
                                            : 'bg-gradient-to-t from-slate-200 to-slate-100 group-hover:from-primary/40 group-hover:to-primary/20 shadow-slate-200/50'
                                        }`}
                                        style={{ height: `${Math.max(height, 8)}%` }}
                                    >
                                        {isToday && (
                                            <div className="absolute -inset-1.5 bg-primary/20 rounded-full blur-md animate-pulse"></div>
                                        )}
                                    </div>

                                    {/* Day label */}
                                    <span className={`mt-4 text-[10px] font-black transition-colors ${isToday ? 'text-primary' : 'text-slate-400'}`}>
                                        {days[index]}
                                    </span>
                                </div>
                            );
                        })}
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
                        className="w-full bg-[#1E293B] hover:bg-slate-800 hover:scale-[1.01] border-2 border-[#334155] text-white h-16 rounded-2xl flex items-center justify-start px-6 gap-4 shadow-lg active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined font-black !text-2xl shrink-0">notifications_active</span>
                        <div className="flex flex-col items-start leading-none text-left">
                            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-0.5">Marketing</span>
                            <span className="text-sm font-black uppercase tracking-tight">Enviar Comunicado</span>
                        </div>
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

            {/* REGISTER SALE MODAL - FULL SCREEN LIGHT DESIGN */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-[#F0F2F5] flex flex-col animate-in fade-in duration-300">
                    <div className="relative w-full h-full flex flex-col">
                        {/* Header */}
                        <div className="px-8 pt-8 pb-4 flex items-center gap-4 shrink-0 bg-[#F0F2F5]">
                            <div className="w-14 h-16 rounded-[1.25rem] bg-white border-2 border-[#595A5B] flex items-center justify-center shadow-sm shrink-0">
                                <span className="material-symbols-outlined text-primary !text-3xl">point_of_sale</span>
                            </div>
                            <div className="flex flex-col flex-1 justify-center">
                                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight leading-none mb-1.5">Ventas</h2>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Registrar Venta</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pt-5 pb-28 space-y-2 bg-white">
                            {saleStep === 1 || saleStep === 3 ? (
                                <div className="space-y-2">
                                    {/* Three Independent Cards */}
                                    <div className="space-y-2">
                                        {/* Card 1: BCV Rate Information */}
                                        <div className="bg-white border-2 border-[#595A5B] rounded-[1.5rem] p-4 shadow-sm flex items-center justify-between overflow-hidden relative">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Conversión de Moneda</span>
                                                <h3 className="text-base font-black text-slate-800 leading-none">Tasa Oficial BCV</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={fetchBCVRate}
                                                    className={`size-8 rounded-xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary active:scale-90 transition-all ${isFetchingRate ? 'animate-spin' : ''}`}
                                                    title="Actualizar tasa"
                                                >
                                                    <span className="material-symbols-outlined !text-lg">refresh</span>
                                                </button>
                                                <div className="bg-orange-50 border-2 border-primary/20 px-3 py-1.5 rounded-xl flex flex-col items-center justify-center min-w-[80px] shadow-sm relative group">
                                                    <input
                                                        type="number"
                                                        value={exchangeRate}
                                                        onChange={(e) => {
                                                            const rate = e.target.value;
                                                            setExchangeRate(rate);
                                                            setIsRateSuccessful(false);
                                                            if (amountBs && parseFloat(rate) > 0) {
                                                                setAmount((parseFloat(amountBs) / parseFloat(rate)).toFixed(2));
                                                            }
                                                        }}
                                                        className="bg-transparent border-none text-lg font-black text-primary w-16 text-center p-0 focus:ring-0 leading-none"
                                                    />
                                                    <span className="text-[7px] font-black text-primary/60 uppercase tracking-widest mt-0.5">Bs/USD</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 2: Bolívares Input */}
                                        <div className="bg-slate-50 border-2 border-[#595A5B] rounded-[1.5rem] p-4 flex flex-col justify-center min-h-[85px] shadow-sm hover:border-primary/30 transition-colors">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Monto en Bolívares (BS.)</label>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-black text-slate-300 italic">Bs.</span>
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
                                                    className="bg-transparent border-none text-3xl font-black text-slate-900 w-full focus:ring-0 p-0 placeholder:text-slate-200"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </div>

                                        {/* Card 3: USD Input */}
                                        <div className="bg-orange-50/20 border-2 border-[#595A5B] rounded-[1.5rem] p-4 flex flex-col justify-center min-h-[85px] shadow-sm hover:border-primary/30 transition-colors">
                                            <p className="text-center text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Recibir en USD</p>
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-3xl font-black text-primary drop-shadow-sm">$</span>
                                                <input
                                                    type="number"
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
                                                    className="bg-transparent border-none text-4xl font-black text-slate-900 w-full text-center focus:ring-0 p-0 placeholder:text-slate-100 selection:bg-primary/10"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Client Identification */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Identificación del Cliente</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">mail</span>
                                                <input
                                                    type="email"
                                                    value={searchEmail}
                                                    onChange={(e) => setSearchEmail(e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl h-12 pl-10 pr-3 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all outline-none text-sm"
                                                    placeholder="Buscar por correo..."
                                                />
                                            </div>
                                            <button
                                                onClick={startScanner}
                                                className="size-12 rounded-xl bg-[#1E293B] border-2 border-slate-800 flex items-center justify-center text-white hover:bg-slate-900 transition-all active:scale-95 shadow-xl"
                                            >
                                                <span className="material-symbols-outlined !text-xl font-black">qr_code_scanner</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-1">
                                        <button
                                            disabled={!amount || parseFloat(amount) <= 0 || isProcessing || isFetchingRate}
                                            onClick={handleManualSearch}
                                            className="w-full bg-[#22C55E] hover:bg-[#1da850] text-white h-12 rounded-xl font-black text-base uppercase shadow-[0_5px_15px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale transition-all active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined !text-xl font-black">check_circle</span>
                                            {isProcessing ? 'Validando...' : 'Confirmar Registro'}
                                        </button>
                                        <button
                                            onClick={closeModal}
                                            className="w-full text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] py-2 hover:text-slate-900 transition-colors"
                                        >
                                            Cancelar Operación
                                        </button>
                                    </div>

                                    </div>
                            ) : saleStep === 2 ? (
                                <div className="space-y-10 text-center py-8">
                                    <div className="bg-slate-50 rounded-[2.5rem] overflow-hidden border-2 border-slate-200 relative min-h-[350px] flex items-center justify-center shadow-inner">
                                        {isProcessing ? (
                                            <div className="flex flex-col items-center gap-6">
                                                <div className="size-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                                                <p className="font-black text-sm text-primary uppercase tracking-[0.2em]">Sincronizando puntos...</p>
                                            </div>
                                        ) : (
                                            <div id="reader" className="w-full"></div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Monto a registrar</p>
                                            <p className="text-primary text-6xl font-black tracking-tighter">${amount}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (window.scannerInstance) window.scannerInstance.stop().catch(() => { });
                                                setSaleStep(1);
                                            }}
                                            className="px-8 h-12 rounded-full border-2 border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:text-slate-900 hover:border-slate-900 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                            MODIFICAR MONTO
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Banner de agradecimiento - Fijo al final del dispositivo (Zona Segura) */}
                        {(saleStep === 1 || saleStep === 3) && (
                            <div className="bg-primary pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] px-8 shrink-0 shadow-[0_-10px_30px_rgba(255,101,14,0.2)] animate-in slide-in-from-bottom duration-500 rounded-t-[2.5rem]">
                                <div className="flex items-center gap-4 max-w-lg mx-auto">
                                    <div className="size-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 backdrop-blur-md border border-white/20 shadow-inner">
                                        <span className="material-symbols-outlined !text-2xl">celebration</span>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-[0.15em] leading-tight">¡Gracias por la compra!</p>
                                        <p className="text-[10px] font-bold text-white/90 mt-1 leading-relaxed">Cada registro suma puntos para el cliente. ¡Sigamos creciendo!</p>
                                    </div>
                                </div>
                            </div>
                        )}
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
            )
            }

            {/* Business QR Modal (For customer affiliation) */}
            {
                isBusinessQRModalOpen && (
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
                )
            }
        </div >
    );
};

export default Home;
