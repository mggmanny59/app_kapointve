import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Navigation from '../components/Navigation';
import { useNavigate } from 'react-router-dom';

const Subscription = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [reporting, setReporting] = useState(false);
    const [business, setBusiness] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [bcvRate, setBcvRate] = useState(0);
    const [activeTab, setActiveTab] = useState('PAGO_MOVIL');
    
    // Form State
    const [formData, setFormData] = useState({
        reference: '',
        amountVes: ''
    });

    // KPoint Payment Data
    const paymentData = {
        PAGO_MOVIL: {
            rif: 'J-31234567-8',
            phone: '+58 412-5551234',
            bank: 'Banco de Venezuela',
            title: 'Enviar Pago Móvil'
        },
        TRANSFERENCIA: {
            rif: 'J-31234567-8',
            account: '0102-0000-00-0000000000',
            bank: 'Banco de Venezuela',
            title: 'Transferencia Bancaria'
        }
    };

    const fetchSubscriptionData = async () => {
        try {
            setLoading(true);
            
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, business_members(business_id, role, businesses(*))')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            const memberInfo = profileData.business_members?.[0];
            const biz = memberInfo?.businesses;
            setBusiness(biz);

            if (memberInfo?.role !== 'owner' && memberInfo?.role !== 'manager') {
                navigate('/dashboard');
                return;
            }

            if (biz?.id) {
                const { data: payments, error: paymentsError } = await supabase
                    .from('subscription_payments')
                    .select('*')
                    .eq('business_id', biz.id)
                    .order('created_at', { ascending: false });

                if (paymentsError) throw paymentsError;
                setPaymentHistory(payments || []);
            }

            const { data: rateData } = await supabase.functions.invoke('get-bcv-rate');
            if (rateData?.rate) {
                setBcvRate(rateData.rate);
            } else {
                const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                if (response.ok) {
                    const data = await response.json();
                    if (data?.promedio) setBcvRate(data.promedio);
                }
            }

        } catch (error) {
            console.error('Error fetching subscription data:', error);
            showNotification('error', 'Error', 'No se pudo cargar la información de suscripción.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchSubscriptionData();
    }, [user]);

    const handleReportPayment = async (e) => {
        e.preventDefault();
        if (!formData.reference || !formData.amountVes) {
            showNotification('warning', 'Campos incompletos', 'Por favor llena todos los campos.');
            return;
        }

        try {
            setReporting(true);
            const amountUsd = bcvRate > 0 ? (parseFloat(formData.amountVes) / bcvRate).toFixed(2) : 0;

            const { error } = await supabase
                .from('subscription_payments')
                .insert({
                    business_id: business.id,
                    payment_method: activeTab,
                    reference_number: formData.reference,
                    amount_ves: parseFloat(formData.amountVes),
                    amount_usd: parseFloat(amountUsd),
                    bcv_rate: bcvRate,
                    status: 'PENDING'
                });

            if (error) throw error;

            showNotification('success', '¡Reportado!', 'Tu pago ha sido enviado para verificación.');
            setFormData({ reference: '', amountVes: '' });
            fetchSubscriptionData();
        } catch (error) {
            console.error('Error reporting payment:', error);
            showNotification('error', 'Error', 'No se pudo reportar el pago.');
        } finally {
            setReporting(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showNotification('success', 'Copiado', 'Información copiada al portapapeles.');
    };

    const calculateDaysRemaining = (expiryDate) => {
        if (!expiryDate) return 0;
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diff = expiry - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const daysLeft = calculateDaysRemaining(business?.subscription_expiry);
    const isPastDue = daysLeft === 0 && business?.subscription_status === 'PAST_DUE';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FA] pb-32 animate-fade-in font-sans antialiased">
            {/* Header: Estilo Diseñador (Fondo claro, icono en recuadro, título y subtítulo) */}
            <header className="px-6 pt-10 pb-6 sticky top-0 bg-[#f8fafc]/80 backdrop-blur-xl z-50 border-b border-[#595A5B]">
                <div className="flex items-center gap-4">
                    <div className="size-16 rounded-[1.5rem] bg-[#FEF6F0] border-2 border-primary flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-primary !text-4xl font-black">card_membership</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Suscripción</h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Gestión de Plan y Pagos</p>
                    </div>
                </div>
            </header>

            <main className="px-6 mt-8 space-y-6">
                {/* Tarjeta de Estado: Más contraste y tamaño reducido (80%) */}
                <section className="relative p-6 rounded-[32px] border-2 border-primary bg-gradient-to-br from-slate-500 to-slate-700 shadow-xl overflow-hidden max-w-[320px] mx-auto">
                    <div className="relative z-10 text-center space-y-4">
                        <h3 className="text-xs font-black text-white/70 uppercase tracking-[0.2em]">Plan Actual: KPoint Plus</h3>
                        
                        <div className="relative mx-auto size-40 flex flex-col items-center justify-center">
                            {/* Arco de Progreso (SVG Ajustado) */}
                            <svg className="size-full overflow-visible">
                                <path 
                                    d="M 15 100 A 60 60 0 0 1 145 100" 
                                    fill="none" 
                                    stroke="rgba(255,255,255,0.1)" 
                                    strokeWidth="10" 
                                    strokeLinecap="round"
                                />
                                <path 
                                    d="M 15 100 A 60 60 0 0 1 145 100" 
                                    fill="none" 
                                    stroke="#FF650E" 
                                    strokeWidth="10" 
                                    strokeLinecap="round"
                                    strokeDasharray={200}
                                    strokeDashoffset={200 - (Math.min(daysLeft, 30) / 30) * 200}
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            
                            <div className="absolute top-[55px] w-full text-center px-4">
                                <p className="text-xl font-black text-white">{daysLeft} días restantes</p>
                                <p className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-wider">
                                    Activo hasta<br/>
                                    {business?.subscription_expiry ? new Date(business.subscription_expiry).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No disponible'}
                                </p>
                            </div>

                            <div className="absolute bottom-1 flex gap-1.5">
                                <div className="w-6 h-1 bg-primary rounded-full"></div>
                                <div className="size-1 bg-white/20 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Payment Methods Section */}
                <section className="space-y-4">
                    <div className="space-y-1 ml-1">
                        <h2 className="text-xl font-black text-slate-900">Métodos de Pago</h2>
                        <p className="text-xs font-bold text-slate-400">Para Venezuela</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setActiveTab('PAGO_MOVIL')}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 ${activeTab === 'PAGO_MOVIL' ? 'bg-white shadow-md border-primary text-slate-900' : 'bg-slate-100 border-transparent text-slate-400'}`}
                        >
                            <div className={`p-1.5 rounded-lg ${activeTab === 'PAGO_MOVIL' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <span className="material-symbols-outlined !text-sm">bolt</span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">Pago Móvil</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('TRANSFERENCIA')}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 ${activeTab === 'TRANSFERENCIA' ? 'bg-white shadow-md border-primary text-slate-900' : 'bg-slate-100 border-transparent text-slate-400'}`}
                        >
                            <div className={`p-1.5 rounded-lg ${activeTab === 'TRANSFERENCIA' ? 'bg-slate-400 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <span className="material-symbols-outlined !text-sm">account_balance</span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">Transferencia</span>
                        </button>
                    </div>

                    {/* Speech Bubble Container */}
                    <div className="relative mt-2">
                        <div className={`absolute -top-1.5 w-3 h-3 bg-white border-t border-l border-primary/20 rotate-45 transition-all duration-300 ${activeTab === 'PAGO_MOVIL' ? 'left-16' : 'left-48'}`}></div>
                        
                        <div className="bg-slate-100 rounded-[32px] border-2 border-primary p-6 shadow-md space-y-5">
                            <h3 className="text-primary font-black text-base uppercase tracking-widest">{paymentData[activeTab].title}</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400 !text-xl">description</span>
                                        <span className="text-xs font-bold text-slate-500">RIF (Copiar)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-800">{paymentData[activeTab].rif}</span>
                                        <button onClick={() => copyToClipboard(paymentData[activeTab].rif)} className="text-primary active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined !text-xl">content_copy</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400 !text-xl">call</span>
                                        <span className="text-xs font-bold text-slate-500">{activeTab === 'PAGO_MOVIL' ? 'Teléfono' : 'Cuenta'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-800">{activeTab === 'PAGO_MOVIL' ? paymentData[activeTab].phone : paymentData[activeTab].account}</span>
                                        <button onClick={() => copyToClipboard(activeTab === 'PAGO_MOVIL' ? paymentData[activeTab].phone : paymentData[activeTab].account)} className="text-primary active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined !text-xl">content_copy</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400 !text-xl">account_balance</span>
                                        <span className="text-xs font-bold text-slate-500">Banco</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-800">{paymentData[activeTab].bank}</span>
                                        <button onClick={() => copyToClipboard(paymentData[activeTab].bank)} className="text-primary active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined !text-xl">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Form Card: Darker gray background, orange border */}
                <section className="bg-slate-100 rounded-[32px] p-6 shadow-md border-2 border-primary space-y-6">
                    <form onSubmit={handleReportPayment} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-700 ml-1 uppercase tracking-wider">Número de Referencia</label>
                            <input 
                                type="text"
                                placeholder="12345678"
                                className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
                                value={formData.reference}
                                onChange={(e) => setFormData({...formData, reference: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-700 ml-1 uppercase tracking-wider">Monto en Bs. (VES)</label>
                            <input 
                                type="text"
                                placeholder="0.00"
                                className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
                                value={formData.amountVes}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^\d.]/g, '');
                                    setFormData({...formData, amountVes: val});
                                }}
                            />
                             {bcvRate > 0 && formData.amountVes && (
                                <p className="text-[10px] text-slate-400 font-bold mt-1 ml-1 uppercase tracking-widest">
                                    Aprox. ${(parseFloat(formData.amountVes) / bcvRate).toFixed(2)} USD (BCV: {bcvRate})
                                </p>
                            )}
                        </div>

                        <button 
                            type="submit"
                            disabled={reporting}
                            className={`w-full h-14 rounded-2xl font-black text-sm text-white uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-primary/20 ${reporting ? 'bg-slate-300' : 'bg-primary hover:brightness-110'}`}
                        >
                            {reporting ? 'Procesando...' : 'Reportar Pago'}
                        </button>
                    </form>
                </section>

                {/* Simplified History for Review */}
                {paymentHistory.length > 0 && (
                    <section className="space-y-4">
                       <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Reportes Recientes</h3>
                       <div className="space-y-2">
                           {paymentHistory.slice(0, 3).map(pay => (
                               <div key={pay.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                                   <div>
                                       <p className="text-xs font-black text-slate-800">Bs. {pay.amount_ves}</p>
                                       <p className="text-[9px] font-bold text-slate-400 uppercase">Ref: {pay.reference_number}</p>
                                   </div>
                                   <div className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${pay.status === 'APPROVED' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                                       {pay.status === 'APPROVED' ? 'APROBADO' : pay.status === 'PENDING' ? 'PENDIENTE' : 'RECHAZADO'}
                                   </div>
                               </div>
                           ))}
                       </div>
                    </section>
                )}
            </main>

            <Navigation />
        </div>
    );
};

export default Subscription;
