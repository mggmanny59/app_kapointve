import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const BusinessSettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [business, setBusiness] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchBusiness = async () => {
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('owner_id', user.id)
                    .single();

                if (error) throw error;
                setBusiness(data);
            } catch (err) {
                console.error('Error fetching business:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchBusiness();
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    name: business.name,
                    rif: business.rif,
                    address: business.address,
                    points_per_dollar: business.points_per_dollar
                })
                .eq('id', business.id);

            if (error) throw error;
            alert('Configuración guardada');
        } catch (err) {
            console.error('Error saving settings:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Cargando...</div>;

    return (
        <div className="p-8 bg-navy-dark min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-6">Configuración del Negocio</h1>
            <form onSubmit={handleSave} className="max-w-md space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Nombre del Negocio</label>
                    <input
                        type="text"
                        value={business?.name || ''}
                        onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                        className="w-full p-2 bg-navy-card border border-white/10 rounded"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">RIF</label>
                    <input
                        type="text"
                        value={business?.rif || ''}
                        onChange={(e) => setBusiness({ ...business, rif: e.target.value })}
                        className="w-full p-2 bg-navy-card border border-white/10 rounded"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Dirección</label>
                    <textarea
                        value={business?.address || ''}
                        onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                        className="w-full p-2 bg-navy-card border border-white/10 rounded"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Puntos por Dólar</label>
                    <input
                        type="number"
                        value={business?.points_per_dollar || 10}
                        onChange={(e) => setBusiness({ ...business, points_per_dollar: parseInt(e.target.value) })}
                        className="w-full p-2 bg-navy-card border border-white/10 rounded"
                    />
                </div>
                <button
                    disabled={saving}
                    className="w-full bg-primary p-3 rounded font-bold hover:opacity-90 disabled:opacity-50"
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </form>
        </div>
    );
};

export default BusinessSettings;
