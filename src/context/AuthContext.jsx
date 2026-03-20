import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async (session) => {
        try {
            if (session?.user) {
                // Fetch Profile and Business Status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*, business_members(business_id, businesses(is_active, registration_status, subscription_expiry))')
                    .eq('id', session.user.id)
                    .maybeSingle();

                const isSuperAdmin = !!profile?.is_super_admin;
                const businessInfo = profile?.business_members?.[0]?.businesses;
                let businessStatus = null;

                // Enforce Business Rules for non-Super Admins
                if (businessInfo && !isSuperAdmin) {
                    const expiryPlusGrace = businessInfo.subscription_expiry
                        ? new Date(new Date(businessInfo.subscription_expiry).getTime() + (3 * 24 * 60 * 60 * 1000))
                        : null;
                    const isExpired = expiryPlusGrace && new Date() > expiryPlusGrace;

                    if (businessInfo.is_active === false) {
                        await supabase.auth.signOut();
                        setUser(null);
                        throw new Error('STATUS_BLOCKED');
                    }

                    if (businessInfo.registration_status === 'PENDING') {
                        await supabase.auth.signOut();
                        setUser(null);
                        throw new Error('STATUS_PENDING');
                    }

                    const today = new Date();
                    const expiryDate = businessInfo.subscription_expiry ? new Date(businessInfo.subscription_expiry) : null;
                    const diffTime = expiryDate ? expiryDate.getTime() - today.getTime() : null;
                    const daysLeft = diffTime ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : null;

                    // For expired users, we don't sign out, but we add a flag to the state
                    businessStatus = {
                        ...businessInfo,
                        is_expired: isExpired,
                        days_left: daysLeft
                    };
                }

                setUser({
                    ...session.user,
                    is_super_admin: isSuperAdmin,
                    role: profile?.business_members?.[0]?.role || session.user.user_metadata?.role,
                    businessStatus: businessStatus || businessInfo
                });
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error in refreshUser:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 1. Initial Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            refreshUser(session);
        });

        // 2. Auth State Subscription
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            refreshUser(session);
        });

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password, metadata) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata },
        });
        if (error) throw error;
        return data;
    };

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
