import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const MyPoints = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loyaltyCards, setLoyaltyCards] = useState([]);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
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
                const { data: cardsData, error } = await supabase
                    .from('loyalty_cards')
                    .select('*, businesses(name, logo_url)')
                    .eq('profile_id', user.id)
                    .order('last_activity', { ascending: false });

                if (error) throw error;
                setLoyaltyCards(cardsData || []);
            } catch (err) {
                console.error('Error fetching client data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchUserData();
    }, [user]);

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
                        <p className="text-white/70 text-sm font-medium mt-3 max-w-[240px]">
                            Sigue acumulando puntos en tus comercios favoritos para canjear premios.
                        </p>
                    </div>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white/10 !text-[150px] font-black pointer-events-none">
                        account_balance_wallet
                    </span>
                </div>

                {/* QR Access Section */}
                <div className="bg-navy-card border border-border-subtle p-8 rounded-card shadow-lg flex flex-col items-center gap-6">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-white tracking-tight">Mi Código QR</h3>
                        <p className="text-sm text-slate-subtitle mt-2">Muéstralo en caja para sumar puntos</p>
                    </div>

                    <div className="relative">
                        {/* Subtle glow effect behind the QR */}
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>

                        <div className="size-64 bg-white rounded-[2.5rem] flex items-center justify-center text-navy-dark shadow-2xl relative z-10 border-4 border-white/5 p-8">
                            <QRCodeSVG
                                value={user?.id || 'no-user'}
                                size={200}
                                level="H"
                                includeMargin={false}
                                aria-label={`QR Code para ${profile?.full_name}`}
                            />
                        </div>
                    </div>

                    <div className="bg-primary/10 px-6 py-2 rounded-full border border-primary/20">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Escaneo en Caja</p>
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
                                    className="bg-navy-card p-4 rounded-card border border-border-subtle shadow-md flex items-center gap-4 active:bg-white/5 transition-colors cursor-pointer"
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
                        <div className="text-center py-12 bg-navy-card/30 rounded-card border border-dashed border-border-subtle">
                            <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">volunteer_activism</span>
                            <p className="text-sm font-bold text-slate-subtitle">Aún no tienes puntos</p>
                            <p className="text-[10px] text-slate-600 mt-1">Visita un comercio aliado para empezar</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Menu */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-card/90 backdrop-blur-xl border-t border-border-subtle flex items-center justify-around px-6 pb-2 z-50">
                <button className="flex flex-col items-center gap-1 text-primary">
                    <span className="material-symbols-outlined font-bold">account_balance_wallet</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Inicio</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-subtitle">
                    <span className="material-symbols-outlined">explore</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Comercios</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-subtitle">
                    <span className="material-symbols-outlined">featured_seasonal_and_gifts</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Premios</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-subtitle">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
                </button>
            </nav>
        </div>
    );
};

export default MyPoints;
