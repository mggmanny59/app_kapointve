import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchMessages = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*, businesses(name, logo_url)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMessages(data || []);
            setUnreadCount(data?.filter(m => !m.read_at).length || 0);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchMessages();

            // Real-time subscription
            const channel = supabase
                .channel('notifications_changes')
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications' },
                    () => fetchMessages()
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user, fetchMessages]);

    const markAsRead = async (messageId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', messageId);

            if (error) throw error;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read_at: new Date().toISOString() } : m));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!messages.length) return;
        try {
            const unreadIds = messages.filter(m => !m.read_at).map(m => m.id);
            if (!unreadIds.length) return;

            const { error } = await supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .in('id', unreadIds);

            if (error) throw error;
            setMessages(prev => prev.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const sendMessage = async (businessId, profileId, title, message, type = 'GENERAL') => {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    business_id: businessId,
                    profile_id: profileId, // NULL means mass notification
                    title,
                    message,
                    type
                });

            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('Error sending message:', err);
            return { success: false, error: err.message };
        }
    };

    return (
        <MessageContext.Provider value={{
            messages,
            unreadCount,
            loading,
            fetchMessages,
            markAsRead,
            markAllAsRead,
            sendMessage
        }}>
            {children}
        </MessageContext.Provider>
    );
};

export const useMessages = () => {
    const context = useContext(MessageContext);
    if (!context) throw new Error('useMessages must be used within a MessageProvider');
    return context;
};
