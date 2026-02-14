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
                .select('*, businesses(name, logo_url), notification_reads!left(read_at, is_deleted)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map data to merge the read state and filter out deleted messages
            const processedData = (data || [])
                .map(msg => ({
                    ...msg,
                    read_at: msg.notification_reads?.[0]?.read_at || msg.read_at,
                    is_deleted: msg.notification_reads?.[0]?.is_deleted || false
                }))
                .filter(msg => !msg.is_deleted);

            setMessages(processedData);
            setUnreadCount(processedData.filter(m => !m.read_at).length);
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
            // First, check if it's an individual notification
            const message = messages.find(m => m.id === messageId);
            if (!message) return;

            const now = new Date().toISOString();

            // Insert into the new tracking table
            const { error } = await supabase
                .from('notification_reads')
                .insert({
                    notification_id: messageId,
                    profile_id: user.id,
                    read_at: now
                });

            // If it's an individual message, we also try to update the main row for backward compatibility
            if (message.profile_id === user.id) {
                await supabase
                    .from('notifications')
                    .update({ read_at: now })
                    .eq('id', messageId);
            }

            if (error && error.code !== '23505') throw error; // 23505 is unique violation, meaning it was already marked as read

            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read_at: now } : m));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const markAllAsRead = async () => {
        const unreadMessages = messages.filter(m => !m.read_at);
        if (!unreadMessages.length) return;

        try {
            const now = new Date().toISOString();
            const unreadIds = unreadMessages.map(m => m.id);

            // Insert records for all unread messages
            const insertData = unreadIds.map(id => ({
                notification_id: id,
                profile_id: user.id,
                read_at: now
            }));

            const { error } = await supabase
                .from('notification_reads')
                .upsert(insertData, { onConflict: 'notification_id, profile_id' });

            if (error) throw error;

            // Also update individual notifications in main table (optional but good for consistency)
            const individualIds = unreadMessages
                .filter(m => m.profile_id === user.id)
                .map(m => m.id);

            if (individualIds.length > 0) {
                await supabase
                    .from('notifications')
                    .update({ read_at: now })
                    .in('id', individualIds);
            }

            setMessages(prev => prev.map(m => ({ ...m, read_at: m.read_at || now })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const deleteMessage = async (messageId) => {
        try {
            const now = new Date().toISOString();

            // Check if record exists in notification_reads
            const { data: existing } = await supabase
                .from('notification_reads')
                .select('id')
                .eq('notification_id', messageId)
                .eq('profile_id', user.id)
                .single();

            if (existing) {
                // Update existing record
                await supabase
                    .from('notification_reads')
                    .update({ is_deleted: true })
                    .eq('id', existing.id);
            } else {
                // Create new record as deleted
                await supabase
                    .from('notification_reads')
                    .insert({
                        notification_id: messageId,
                        profile_id: user.id,
                        is_deleted: true
                    });
            }

            setMessages(prev => prev.filter(m => m.id !== messageId));
            setUnreadCount(prev => {
                const msg = messages.find(m => m.id === messageId);
                return msg && !msg.read_at ? Math.max(0, prev - 1) : prev;
            });
        } catch (err) {
            console.error('Error deleting message:', err);
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
            deleteMessage,
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
