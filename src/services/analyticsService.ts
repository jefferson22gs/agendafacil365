// Serviço para BI & Analytics

import { supabase } from '@/integrations/supabase/client';

export interface DailyAnalytics {
    id: string;
    salon_id: string;
    date: string;
    total_revenue: number;
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    new_clients: number;
    returning_clients: number;
    average_ticket: number;
    top_service_id: string | null;
    top_professional_id: string | null;
}

export interface AnalyticsSummary {
    totalRevenue: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    newClients: number;
    returningClients: number;
    averageTicket: number;
    revenueGrowth: number;
    appointmentsGrowth: number;
    clientsGrowth: number;
}

export interface ServicePerformance {
    service_id: string;
    service_name: string;
    count: number;
    revenue: number;
    average_price: number;
}

export interface ProfessionalPerformance {
    professional_id: string;
    professional_name: string;
    appointments: number;
    revenue: number;
    average_rating: number;
    completion_rate: number;
}

export interface HourlyDistribution {
    hour: number;
    count: number;
}

export const analyticsService = {
    // Gerar/Atualizar analytics diário
    async generateDailyAnalytics(salonId: string, date: string): Promise<DailyAnalytics> {
        const dateStart = `${date}T00:00:00`;
        const dateEnd = `${date}T23:59:59`;

        // Buscar agendamentos do dia
        const { data: appointments } = await supabase
            .from('appointments')
            .select('*, client:clients(id, created_at)')
            .eq('salon_id', salonId)
            .eq('date', date);

        const allAppointments = appointments || [];
        const completedAppts = allAppointments.filter(a => a.status === 'completed');
        const cancelledAppts = allAppointments.filter(a => a.status === 'cancelled');

        // Calcular métricas
        const totalRevenue = completedAppts.reduce((sum, a) => sum + (a.final_price || 0), 0);
        const averageTicket = completedAppts.length > 0 ? totalRevenue / completedAppts.length : 0;

        // Contar clientes novos vs retornando
        let newClients = 0;
        let returningClients = 0;
        const clientIds = new Set<string>();

        for (const apt of allAppointments) {
            if (!apt.client_id || clientIds.has(apt.client_id)) continue;
            clientIds.add(apt.client_id);

            const clientCreatedAt = apt.client?.created_at;
            if (clientCreatedAt && clientCreatedAt.startsWith(date)) {
                newClients++;
            } else {
                returningClients++;
            }
        }

        // Top serviço
        const serviceCounts: { [key: string]: number } = {};
        completedAppts.forEach(a => {
            if (a.service_id) {
                serviceCounts[a.service_id] = (serviceCounts[a.service_id] || 0) + 1;
            }
        });
        const topServiceId = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        // Top profissional
        const professionalCounts: { [key: string]: number } = {};
        completedAppts.forEach(a => {
            if (a.professional_id) {
                professionalCounts[a.professional_id] = (professionalCounts[a.professional_id] || 0) + 1;
            }
        });
        const topProfessionalId = Object.entries(professionalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        const analyticsData = {
            salon_id: salonId,
            date,
            total_revenue: totalRevenue,
            total_appointments: allAppointments.length,
            completed_appointments: completedAppts.length,
            cancelled_appointments: cancelledAppts.length,
            new_clients: newClients,
            returning_clients: returningClients,
            average_ticket: averageTicket,
            top_service_id: topServiceId,
            top_professional_id: topProfessionalId
        };

        const { data, error } = await supabase
            .from('analytics_daily')
            .upsert(analyticsData, { onConflict: 'salon_id,date' })
            .select()
            .single();

        if (error) throw error;
        return data as DailyAnalytics;
    },

    // Buscar resumo de período
    async getSummary(salonId: string, startDate: string, endDate: string): Promise<AnalyticsSummary> {
        const { data: analytics } = await supabase
            .from('analytics_daily')
            .select('*')
            .eq('salon_id', salonId)
            .gte('date', startDate)
            .lte('date', endDate);

        const current = analytics || [];

        // Calcular totais
        const summary = current.reduce((acc, day) => ({
            totalRevenue: acc.totalRevenue + (day.total_revenue || 0),
            totalAppointments: acc.totalAppointments + (day.total_appointments || 0),
            completedAppointments: acc.completedAppointments + (day.completed_appointments || 0),
            cancelledAppointments: acc.cancelledAppointments + (day.cancelled_appointments || 0),
            newClients: acc.newClients + (day.new_clients || 0),
            returningClients: acc.returningClients + (day.returning_clients || 0),
        }), {
            totalRevenue: 0,
            totalAppointments: 0,
            completedAppointments: 0,
            cancelledAppointments: 0,
            newClients: 0,
            returningClients: 0,
        });

        const averageTicket = summary.completedAppointments > 0
            ? summary.totalRevenue / summary.completedAppointments
            : 0;

        // Calcular crescimento comparando com período anterior
        const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - daysDiff + 1);

        const { data: prevAnalytics } = await supabase
            .from('analytics_daily')
            .select('*')
            .eq('salon_id', salonId)
            .gte('date', prevStartDate.toISOString().split('T')[0])
            .lte('date', prevEndDate.toISOString().split('T')[0]);

        const prev = prevAnalytics || [];
        const prevRevenue = prev.reduce((sum, d) => sum + (d.total_revenue || 0), 0);
        const prevAppointments = prev.reduce((sum, d) => sum + (d.total_appointments || 0), 0);
        const prevClients = prev.reduce((sum, d) => sum + (d.new_clients || 0), 0);

        const calcGrowth = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        return {
            ...summary,
            averageTicket,
            revenueGrowth: calcGrowth(summary.totalRevenue, prevRevenue),
            appointmentsGrowth: calcGrowth(summary.totalAppointments, prevAppointments),
            clientsGrowth: calcGrowth(summary.newClients, prevClients),
        };
    },

    // Performance de serviços
    async getServicesPerformance(salonId: string, startDate: string, endDate: string): Promise<ServicePerformance[]> {
        const { data: appointments } = await supabase
            .from('appointments')
            .select('service_id, final_price, service:services(name)')
            .eq('salon_id', salonId)
            .eq('status', 'completed')
            .gte('date', startDate)
            .lte('date', endDate);

        if (!appointments) return [];

        const serviceStats: { [key: string]: { name: string; count: number; revenue: number } } = {};

        appointments.forEach(apt => {
            if (!apt.service_id) return;

            if (!serviceStats[apt.service_id]) {
                serviceStats[apt.service_id] = {
                    name: (apt.service as any)?.name || 'Desconhecido',
                    count: 0,
                    revenue: 0
                };
            }

            serviceStats[apt.service_id].count++;
            serviceStats[apt.service_id].revenue += apt.final_price || 0;
        });

        return Object.entries(serviceStats)
            .map(([service_id, data]) => ({
                service_id,
                service_name: data.name,
                count: data.count,
                revenue: data.revenue,
                average_price: data.count > 0 ? data.revenue / data.count : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);
    },

    // Performance de profissionais
    async getProfessionalsPerformance(salonId: string, startDate: string, endDate: string): Promise<ProfessionalPerformance[]> {
        const { data: appointments } = await supabase
            .from('appointments')
            .select('professional_id, final_price, status, professional:professionals(name)')
            .eq('salon_id', salonId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (!appointments) return [];

        const profStats: {
            [key: string]: {
                name: string;
                total: number;
                completed: number;
                revenue: number;
            }
        } = {};

        appointments.forEach(apt => {
            if (!apt.professional_id) return;

            if (!profStats[apt.professional_id]) {
                profStats[apt.professional_id] = {
                    name: (apt.professional as any)?.name || 'Desconhecido',
                    total: 0,
                    completed: 0,
                    revenue: 0
                };
            }

            profStats[apt.professional_id].total++;
            if (apt.status === 'completed') {
                profStats[apt.professional_id].completed++;
                profStats[apt.professional_id].revenue += apt.final_price || 0;
            }
        });

        // Buscar ratings
        const { data: reviews } = await supabase
            .from('reviews')
            .select('professional_id, rating')
            .eq('salon_id', salonId);

        const profRatings: { [key: string]: number[] } = {};
        reviews?.forEach(r => {
            if (!r.professional_id) return;
            if (!profRatings[r.professional_id]) profRatings[r.professional_id] = [];
            profRatings[r.professional_id].push(r.rating);
        });

        return Object.entries(profStats)
            .map(([professional_id, data]) => {
                const ratings = profRatings[professional_id] || [];
                const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

                return {
                    professional_id,
                    professional_name: data.name,
                    appointments: data.total,
                    revenue: data.revenue,
                    average_rating: avgRating,
                    completion_rate: data.total > 0 ? (data.completed / data.total) * 100 : 0
                };
            })
            .sort((a, b) => b.revenue - a.revenue);
    },

    // Distribuição horária
    async getHourlyDistribution(salonId: string, startDate: string, endDate: string): Promise<HourlyDistribution[]> {
        const { data: appointments } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('salon_id', salonId)
            .gte('date', startDate)
            .lte('date', endDate);

        const hourCounts: { [key: number]: number } = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;

        appointments?.forEach(apt => {
            if (apt.start_time) {
                const hour = parseInt(apt.start_time.split(':')[0]);
                hourCounts[hour]++;
            }
        });

        return Object.entries(hourCounts)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .filter(h => h.count > 0 || (h.hour >= 8 && h.hour <= 20)); // Mostrar horário comercial
    },

    // Previsões simples (tendência linear)
    async getRevenueForecast(salonId: string, daysAhead = 30): Promise<Array<{ date: string; predicted: number }>> {
        // Buscar últimos 90 dias
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const { data: analytics } = await supabase
            .from('analytics_daily')
            .select('date, total_revenue')
            .eq('salon_id', salonId)
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (!analytics || analytics.length < 7) {
            return []; // Dados insuficientes
        }

        // Calcular média móvel dos últimos 7 dias
        const recentDays = analytics.slice(-7);
        const avgRevenue = recentDays.reduce((sum, d) => sum + (d.total_revenue || 0), 0) / recentDays.length;

        // Calcular tendência
        const firstHalf = analytics.slice(0, Math.floor(analytics.length / 2));
        const secondHalf = analytics.slice(Math.floor(analytics.length / 2));

        const firstAvg = firstHalf.reduce((sum, d) => sum + (d.total_revenue || 0), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + (d.total_revenue || 0), 0) / secondHalf.length;

        const growthRate = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
        const dailyGrowth = growthRate / (analytics.length / 2);

        // Gerar previsões
        const predictions: Array<{ date: string; predicted: number }> = [];
        let currentValue = avgRevenue;

        for (let i = 1; i <= daysAhead; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);

            currentValue *= (1 + dailyGrowth);

            predictions.push({
                date: date.toISOString().split('T')[0],
                predicted: Math.round(currentValue * 100) / 100
            });
        }

        return predictions;
    }
};
