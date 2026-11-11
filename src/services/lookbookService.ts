// Serviço para Lookbook (Galeria de Trabalhos)

import { supabase } from '@/integrations/supabase/client';

export interface LookbookItem {
    id: string;
    salon_id: string;
    professional_id: string | null;
    title: string;
    description: string | null;
    image_url: string;
    category: string | null;
    tags: string[];
    service_id: string | null;
    client_id: string | null;
    likes_count: number;
    is_featured: boolean;
    is_public: boolean;
    created_at: string;
    // Relacionamentos
    professional?: { id: string; name: string };
    service?: { id: string; name: string };
}

export const lookbookService = {
    // Buscar items
    async getItems(salonId: string, options?: {
        category?: string;
        professionalId?: string;
        featured?: boolean;
        limit?: number;
    }): Promise<LookbookItem[]> {
        let query = supabase
            .from('lookbook_items')
            .select(`
        *,
        professional:professionals(id, name),
        service:services(id, name)
      `)
            .eq('salon_id', salonId)
            .order('created_at', { ascending: false });

        if (options?.category) {
            query = query.eq('category', options.category);
        }
        if (options?.professionalId) {
            query = query.eq('professional_id', options.professionalId);
        }
        if (options?.featured) {
            query = query.eq('is_featured', true);
        }
        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data as LookbookItem[]) || [];
    },

    // Buscar items públicos (para página pública do salão)
    async getPublicItems(salonId: string, limit = 20): Promise<LookbookItem[]> {
        const { data, error } = await supabase
            .from('lookbook_items')
            .select(`
        *,
        professional:professionals(id, name),
        service:services(id, name)
      `)
            .eq('salon_id', salonId)
            .eq('is_public', true)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data as LookbookItem[]) || [];
    },

    // Adicionar item
    async addItem(item: {
        salon_id: string;
        professional_id?: string;
        title: string;
        description?: string;
        image_url: string;
        category?: string;
        tags?: string[];
        service_id?: string;
        client_id?: string;
        is_featured?: boolean;
        is_public?: boolean;
    }): Promise<LookbookItem> {
        const { data, error } = await supabase
            .from('lookbook_items')
            .insert({
                ...item,
                tags: item.tags || [],
                is_featured: item.is_featured || false,
                is_public: item.is_public !== false
            })
            .select()
            .single();

        if (error) throw error;
        return data as LookbookItem;
    },

    // Atualizar item
    async updateItem(id: string, updates: Partial<LookbookItem>): Promise<void> {
        const { error } = await supabase
            .from('lookbook_items')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    // Deletar item
    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('lookbook_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Curtir item
    async likeItem(itemId: string, clientId?: string, sessionId?: string): Promise<boolean> {
        if (!clientId && !sessionId) {
            sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        }

        const { error } = await supabase
            .from('lookbook_likes')
            .insert({
                lookbook_item_id: itemId,
                client_id: clientId || null,
                session_id: sessionId || null
            });

        if (error) {
            // Já curtiu - remover curtida
            if (error.code === '23505') {
                await supabase
                    .from('lookbook_likes')
                    .delete()
                    .eq('lookbook_item_id', itemId)
                    .or(`client_id.eq.${clientId},session_id.eq.${sessionId}`);

                await this.syncLikes(itemId);
                return false;
            }
            throw error;
        }

        await this.syncLikes(itemId);
        return true;
    },

    // Contador = total real de curtidas (antes passava uma Promise como valor e as RPCs não existem no banco).
    async syncLikes(itemId: string): Promise<void> {
        const { count } = await supabase.from('lookbook_likes').select('*', { count: 'exact', head: true }).eq('lookbook_item_id', itemId);
        await supabase.from('lookbook_items').update({ likes_count: count ?? 0 }).eq('id', itemId);
    },

    // Upload de imagem
    async uploadImage(salonId: string, file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${salonId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('lookbook')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('lookbook')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // Categorias disponíveis
    async getCategories(salonId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('lookbook_items')
            .select('category')
            .eq('salon_id', salonId)
            .not('category', 'is', null);

        if (error) throw error;

        const categories = new Set<string>();
        data?.forEach(item => {
            if (item.category) categories.add(item.category);
        });

        return Array.from(categories).sort();
    },

    // Estatísticas
    async getStats(salonId: string): Promise<{
        totalItems: number;
        totalLikes: number;
        topCategories: Array<{ category: string; count: number }>;
        topProfessionals: Array<{ professional_id: string; name: string; count: number }>;
    }> {
        const items = await this.getItems(salonId);

        const categoryCounts: { [key: string]: number } = {};
        const professionalCounts: { [key: string]: { name: string; count: number } } = {};

        let totalLikes = 0;

        items.forEach(item => {
            totalLikes += item.likes_count || 0;

            if (item.category) {
                categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
            }

            if (item.professional_id && item.professional) {
                if (!professionalCounts[item.professional_id]) {
                    professionalCounts[item.professional_id] = { name: item.professional.name, count: 0 };
                }
                professionalCounts[item.professional_id].count++;
            }
        });

        const topCategories = Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const topProfessionals = Object.entries(professionalCounts)
            .map(([professional_id, data]) => ({ professional_id, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            totalItems: items.length,
            totalLikes,
            topCategories,
            topProfessionals
        };
    }
};
