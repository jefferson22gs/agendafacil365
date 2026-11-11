// Serviço para Metas e Objetivos

import { supabase } from '@/integrations/supabase/client';

export interface Goal {
    id: string;
    salon_id: string;
    type: 'revenue' | 'appointments' | 'new_clients' | 'rating' | 'custom';
    name: string;
    target_value: number;
    current_value: number;
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    start_date: string;
    end_date: string;
    professional_id: string | null;
    status: 'active' | 'completed' | 'failed' | 'cancelled';
    completed_at: string | null;
    created_at: string;
    professional?: { id: string; name: string };
}

export const goalsService = {
    // Buscar metas
    async getGoals(salonId: string, options?: {
        status?: Goal['status'];
        type?: Goal['type'];
        professionalId?: string;
    }): Promise<Goal[]> {
        let query = supabase
            .from('goals')
            .select(`
        *,
        professional:professionals(id, name)
      `)
            .eq('salon_id', salonId)
            .order('created_at', { ascending: false });

        if (options?.status) {
            query = query.eq('status', options.status);
        }
        if (options?.type) {
            query = query.eq('type', options.type);
        }
        if (options?.professionalId) {
            query = query.eq('professional_id', options.professionalId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data as Goal[]) || [];
    },

    // Buscar metas ativas
    async getActiveGoals(salonId: string): Promise<Goal[]> {
        return this.getGoals(salonId, { status: 'active' });
    },

    // Criar meta
    async createGoal(goal: {
        salon_id: string;
        type: Goal['type'];
        name: string;
        target_value: number;
        period: Goal['period'];
        start_date: string;
        end_date: string;
        professional_id?: string;
    }): Promise<Goal> {
        const { data, error } = await supabase
            .from('goals')
            .insert({
                ...goal,
                current_value: 0,
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;
        return data as Goal;
    },

    // Criar meta com período automático
    async createGoalWithPeriod(goal: {
        salon_id: string;
        type: Goal['type'];
        name: string;
        target_value: number;
        period: Goal['period'];
        professional_id?: string;
    }): Promise<Goal> {
        const now = new Date();
        let start_date: Date;
        let end_date: Date;

        switch (goal.period) {
            case 'daily':
                start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end_date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'weekly':
                const dayOfWeek = now.getDay();
                start_date = new Date(now);
                start_date.setDate(now.getDate() - dayOfWeek);
                end_date = new Date(start_date);
                end_date.setDate(start_date.getDate() + 6);
                break;
            case 'monthly':
                start_date = new Date(now.getFullYear(), now.getMonth(), 1);
                end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'quarterly':
                const quarter = Math.floor(now.getMonth() / 3);
                start_date = new Date(now.getFullYear(), quarter * 3, 1);
                end_date = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
                break;
            case 'yearly':
                start_date = new Date(now.getFullYear(), 0, 1);
                end_date = new Date(now.getFullYear(), 11, 31);
                break;
            default:
                start_date = new Date(now.getFullYear(), now.getMonth(), 1);
                end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        return this.createGoal({
            ...goal,
            start_date: start_date.toISOString().split('T')[0],
            end_date: end_date.toISOString().split('T')[0]
        });
    },

    // Atualizar progresso
    async updateProgress(goalId: string, currentValue: number): Promise<void> {
        const { data: goal } = await supabase
            .from('goals')
            .select('target_value, status')
            .eq('id', goalId)
            .single();

        if (!goal) throw new Error('Meta não encontrada');

        const updates: any = {
            current_value: currentValue,
            updated_at: new Date().toISOString()
        };

        // Verificar se completou
        if (currentValue >= goal.target_value && goal.status === 'active') {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('goals')
            .update(updates)
            .eq('id', goalId);

        if (error) throw error;
    },

    // Recalcular metas baseado em dados reais
    async recalculateGoals(salonId: string): Promise<void> {
        const activeGoals = await this.getActiveGoals(salonId);
        const now = new Date();

        for (const goal of activeGoals) {
            // Verificar se a meta expirou
            if (new Date(goal.end_date) < now && goal.status === 'active') {
                await supabase
                    .from('goals')
                    .update({
                        status: goal.current_value >= goal.target_value ? 'completed' : 'failed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', goal.id);
                continue;
            }

            // Calcular valor atual baseado no tipo
            let currentValue = 0;

            switch (goal.type) {
                case 'revenue':
                    const { data: revenueData } = await supabase
                        .from('appointments')
                        .select('final_price')
                        .eq('salon_id', salonId)
                        .eq('status', 'completed')
                        .gte('date', goal.start_date)
                        .lte('date', goal.end_date);

                    currentValue = revenueData?.reduce((sum, a) => sum + (a.final_price || 0), 0) || 0;
                    break;

                case 'appointments':
                    const { count: appointmentsCount } = await supabase
                        .from('appointments')
                        .select('*', { count: 'exact', head: true })
                        .eq('salon_id', salonId)
                        .in('status', ['pending', 'confirmed', 'completed'])
                        .gte('date', goal.start_date)
                        .lte('date', goal.end_date);

                    currentValue = appointmentsCount || 0;
                    break;

                case 'new_clients':
                    const { count: clientsCount } = await supabase
                        .from('clients')
                        .select('*', { count: 'exact', head: true })
                        .eq('salon_id', salonId)
                        .gte('created_at', goal.start_date)
                        .lte('created_at', goal.end_date + 'T23:59:59');

                    currentValue = clientsCount || 0;
                    break;

                case 'rating':
                    const { data: ratingData } = await supabase
                        .from('reviews')
                        .select('rating')
                        .eq('salon_id', salonId)
                        .gte('created_at', goal.start_date);

                    if (ratingData && ratingData.length > 0) {
                        currentValue = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;
                    }
                    break;
            }

            // Atualizar se mudou
            if (currentValue !== goal.current_value) {
                await this.updateProgress(goal.id, currentValue);
            }
        }
    },

    // Cancelar meta
    async cancelGoal(goalId: string): Promise<void> {
        const { error } = await supabase
            .from('goals')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', goalId);

        if (error) throw error;
    },

    // Deletar meta
    async deleteGoal(goalId: string): Promise<void> {
        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId);

        if (error) throw error;
    },

    // Estatísticas
    async getStats(salonId: string): Promise<{
        activeGoals: number;
        completedGoals: number;
        failedGoals: number;
        averageCompletion: number;
    }> {
        const { data: goals } = await supabase
            .from('goals')
            .select('status, current_value, target_value')
            .eq('salon_id', salonId);

        if (!goals) {
            return { activeGoals: 0, completedGoals: 0, failedGoals: 0, averageCompletion: 0 };
        }

        const activeGoals = goals.filter(g => g.status === 'active').length;
        const completedGoals = goals.filter(g => g.status === 'completed').length;
        const failedGoals = goals.filter(g => g.status === 'failed').length;

        const completionRates = goals
            .filter(g => g.status !== 'cancelled')
            .map(g => Math.min((g.current_value / g.target_value) * 100, 100));

        const averageCompletion = completionRates.length > 0
            ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
            : 0;

        return {
            activeGoals,
            completedGoals,
            failedGoals,
            averageCompletion: Math.round(averageCompletion)
        };
    }
};
