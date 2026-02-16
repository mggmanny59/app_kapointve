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
                    .select('*, business_members(business_id, businesses(is_active, registration_status))')
                    .eq('id', session.user.id)
                    .maybeSingle();

                const isSuperAdmin = !!profile?.is_super_admin;
                const businessInfo = profile?.business_members?.[0]?.businesses;

                // Enforce Business Rules for non-Super Admins
                if (businessInfo && !isSuperAdmin) {
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
                }

                setUser({
                    ...session.user,
                    is_super_admin: isSuperAdmin,
                    businessStatus: businessInfo
                });
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error in refreshUser:', error);
            setUser(null);
            // We can emit a custom event or use notification context if available
            // But for now, just ensure they are logged out
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
