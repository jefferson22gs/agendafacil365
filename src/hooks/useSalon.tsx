import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  icon: string | null;
  is_active: boolean;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  avatar_url: string | null;
  working_hours: { start: string; end: string } | null;
  working_days: number[] | null;
  is_active: boolean;
}

interface Salon {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  primary_color: string | null;
  logo_url: string | null;
  slug?: string | null;
  pix_key?: string | null;
}

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number | null;
  is_new_clients_only: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number;
  validity_days: number;
  is_active: boolean;
  items?: {
    id: string;
    service_id: string;
    quantity: number;
    service_name: string;
    service_price: number;
  }[];
}

export const useSalon = (salonId?: string) => {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salonId) {
      fetchSalonData();
    } else {
      fetchFirstSalon();
    }
  }, [salonId]);

  const fetchFirstSalon = async () => {
    try {
      // For now, get the first active salon (in production, this would be based on URL)
      const { data: salons } = await supabase
        .from('salons')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (salons && salons.length > 0) {
        const salonData = salons[0];
        setSalon({
          id: salonData.id,
          name: salonData.name,
          address: salonData.address,
          city: salonData.city,
          state: salonData.state,
          phone: salonData.phone,
          whatsapp: salonData.whatsapp,
          opening_time: salonData.opening_time || '09:00',
          closing_time: salonData.closing_time || '19:00',
          working_days: salonData.working_days || [1, 2, 3, 4, 5, 6],
          primary_color: salonData.primary_color,
          logo_url: salonData.logo_url,
          slug: salonData.slug,
        });

        await fetchServicesAndProfessionals(salonData.id);
      } else {
        setError("Nenhum salão encontrado");
      }
    } catch (err) {
      console.error("Error fetching salon:", err);
      setError("Erro ao carregar dados do salão");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalonData = async () => {
    if (!salonId) return;

    try {
      const { data: salonData, error: salonError } = await supabase
        .from('salons')
        .select('*')
        .eq('id', salonId)
        .single();

      if (salonError) throw salonError;

      setSalon({
        id: salonData.id,
        name: salonData.name,
        address: salonData.address,
        city: salonData.city,
        state: salonData.state,
        phone: salonData.phone,
        whatsapp: salonData.whatsapp,
        opening_time: salonData.opening_time || '09:00',
        closing_time: salonData.closing_time || '19:00',
        working_days: salonData.working_days || [1, 2, 3, 4, 5, 6],
        primary_color: salonData.primary_color,
        logo_url: salonData.logo_url,
          slug: salonData.slug,
      });

      await fetchServicesAndProfessionals(salonData.id);
    } catch (err) {
      console.error("Error fetching salon:", err);
      setError("Erro ao carregar dados do salão");
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesAndProfessionals = async (id: string) => {
    // Fetch services
    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('salon_id', id)
      .eq('is_active', true)
      .order('name');

    if (servicesData) {
      setServices(servicesData);
    }

    // Fetch professionals
    const { data: professionalsData } = await supabase
      .from('professionals')
      .select('*')
      .eq('salon_id', id)
      .eq('is_active', true)
      .order('name');

    if (professionalsData) {
      setProfessionals(professionalsData.map(p => ({
        ...p,
        working_hours: p.working_hours as { start: string; end: string } | null,
      })));
    }

    // Fetch products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('salon_id', id)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name');

    if (productsData) {
      setProducts(productsData);
    }

    // Fetch packages
    console.log('Fetching packages for salon:', id);

    // Try to fetch from view first
    let { data: packagesData, error: packagesError } = await supabase
      .from('service_packages_with_items')
      .select('*')
      .eq('salon_id', id)
      .eq('is_active', true)
      .order('name');

    // If view doesn't exist (404), fallback to direct table query
    if (packagesError) {
      console.warn('View service_packages_with_items not found, using fallback:', packagesError);

      const { data: pkgData, error: pkgError } = await supabase
        .from('service_packages')
        .select('*')
        .eq('salon_id', id)
        .eq('is_active', true)
        .order('name');

      if (pkgError) {
        console.error('Error fetching packages:', pkgError);
      } else if (pkgData) {
        console.log('Packages found (fallback):', pkgData.length);

        // Fetch items for each package
        const packagesWithItems = await Promise.all(
          pkgData.map(async (pkg) => {
            const { data: items } = await supabase
              .from('service_package_items')
              .select(`
                id,
                service_id,
                quantity,
                services:service_id (
                  name,
                  price
                )
              `)
              .eq('package_id', pkg.id);

            return {
              ...pkg,
              items: items?.map(item => ({
                id: item.id,
                service_id: item.service_id,
                quantity: item.quantity,
                service_name: (item.services as any)?.name || '',
                service_price: (item.services as any)?.price || 0
              })) || []
            };
          })
        );

        console.log('Setting packages (fallback):', packagesWithItems);
        setPackages(packagesWithItems);
      }
    } else if (packagesData) {
      console.log('Packages found (view):', packagesData.length);
      setPackages(packagesData as unknown as ServicePackage[]);
    } else {
      console.log('No packages found');
    }
  };

  const validateCoupon = async (code: string, totalValue: number): Promise<{ valid: boolean; coupon?: Coupon; discount?: number; message?: string }> => {
    if (!salon) return { valid: false, message: "Salão não encontrado" };

    try {
      const { data: couponData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('salon_id', salon.id)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !couponData) {
        return { valid: false, message: "Cupom não encontrado" };
      }

      // Check validity dates
      const now = new Date();
      if (couponData.valid_from && new Date(couponData.valid_from) > now) {
        return { valid: false, message: "Cupom ainda não está válido" };
      }
      if (couponData.valid_until && new Date(couponData.valid_until) < now) {
        return { valid: false, message: "Cupom expirado" };
      }

      // Check usage limit
      if (couponData.max_uses && couponData.uses_count && couponData.uses_count >= couponData.max_uses) {
        return { valid: false, message: "Cupom esgotado" };
      }

      // Check minimum purchase
      if (couponData.min_purchase && totalValue < couponData.min_purchase) {
        return { 
          valid: false, 
          message: `Valor mínimo de R$ ${couponData.min_purchase.toFixed(2)} necessário` 
        };
      }

      // Calculate discount
      let discount = 0;
      if (couponData.type === 'percentage') {
        discount = totalValue * (couponData.value / 100);
      } else {
        discount = Math.min(couponData.value, totalValue);
      }

      return { 
        valid: true, 
        coupon: couponData as Coupon,
        discount,
        message: couponData.type === 'percentage' 
          ? `${couponData.value}% de desconto aplicado!`
          : `R$ ${couponData.value.toFixed(2)} de desconto aplicado!`
      };
    } catch (err) {
      console.error("Error validating coupon:", err);
      return { valid: false, message: "Erro ao validar cupom" };
    }
  };

  const getAvailableTimeSlots = async (date: Date, serviceId: string, professionalId?: string): Promise<string[]> => {
    if (!salon) return [];

    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Check if salon is open on this day
    if (!salon.working_days.includes(dayOfWeek)) {
      return [];
    }

    // Get service duration
    const service = services.find(s => s.id === serviceId);
    if (!service) return [];

    const duration = service.duration_minutes;
    console.log('🔍 Service:', service.name, '| Duration:', duration, 'minutes');

    // Generate all possible time slots
    const slots: string[] = [];
    const [openHour, openMin] = salon.opening_time.split(':').map(Number);
    const [closeHour, closeMin] = salon.closing_time.split(':').map(Number);

    let currentTime = openHour * 60 + openMin;
    const endTime = closeHour * 60 + closeMin - duration;

    while (currentTime <= endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      currentTime += duration; // Use service duration for intervals
    }

    // Get existing appointments for the date
    let query = supabase
      .from('appointments')
      .select('start_time, end_time, professional_id')
      .eq('salon_id', salon.id)
      .eq('date', dateStr)
      .in('status', ['pending', 'confirmed']);

    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    }

    const { data: existingAppointments } = await query;

    // Filter out busy slots
    const availableSlots = slots.filter(slot => {
      const slotStart = slot;
      const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
      const slotEnd = `${Math.floor((slotMinutes + duration) / 60).toString().padStart(2, '0')}:${((slotMinutes + duration) % 60).toString().padStart(2, '0')}`;

      // Check if this slot conflicts with any existing appointment
      const hasConflict = existingAppointments?.some(apt => {
        const aptStart = apt.start_time;
        const aptEnd = apt.end_time;

        // If we're looking for a specific professional, only check their appointments
        if (professionalId && apt.professional_id !== professionalId) {
          return false;
        }

        // Check for time overlap
        return (slotStart < aptEnd && slotEnd > aptStart);
      });

      return !hasConflict;
    });

    return availableSlots;
  };

  const createAppointment = async (data: {
    serviceId: string;
    professionalId: string;
    date: string;
    startTime: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    clientBirthDate?: string;
    couponId?: string;
    price: number;
    discount: number;
    finalPrice: number;
  }) => {
    if (!salon) throw new Error("Salão não encontrado");

    const service = services.find(s => s.id === data.serviceId);
    if (!service) throw new Error("Serviço não encontrado");

    // Calculate end time
    const [hours, minutes] = data.startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + service.duration_minutes;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // First, try to find or create client for salon management
    let clientId: string | null = null;
    try {
      // Check if client exists by phone
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('salon_id', salon.id)
        .eq('phone', data.clientPhone)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
        // Update client info if new data is provided
        const updateData: Record<string, any> = {
          name: data.clientName,
        };
        if (data.clientEmail) updateData.email = data.clientEmail;
        if (data.clientBirthDate) {
          updateData.preferences = { birth_date: data.clientBirthDate };
        }
        await supabase
          .from('clients')
          .update(updateData)
          .eq('id', clientId);
      } else {
        // Create new client
        const preferences: Record<string, any> = {};
        if (data.clientBirthDate) preferences.birth_date = data.clientBirthDate;
        
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            salon_id: salon.id,
            name: data.clientName,
            phone: data.clientPhone,
            email: data.clientEmail || null,
            preferences,
          })
          .select('id')
          .single();
        
        if (newClient) clientId = newClient.id;
      }
    } catch (clientError) {
      console.log("Could not create/update client record:", clientError);
      // Continue with appointment creation even if client creation fails
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        salon_id: salon.id,
        service_id: data.serviceId,
        professional_id: data.professionalId,
        client_id: clientId,
        date: data.date,
        start_time: data.startTime,
        end_time: endTime,
        client_name: data.clientName,
        client_phone: data.clientPhone,
        coupon_id: data.couponId || null,
        price: data.price,
        discount: data.discount,
        final_price: data.finalPrice,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Update coupon usage if used
    if (data.couponId) {
      const { data: couponData } = await supabase
        .from('coupons')
        .select('uses_count')
        .eq('id', data.couponId)
        .single();
      
      await supabase
        .from('coupons')
        .update({ uses_count: (couponData?.uses_count || 0) + 1 })
        .eq('id', data.couponId);
    }

    return appointment;
  };

  return {
    salon,
    services,
    professionals,
    products,
    packages,
    loading,
    error,
    validateCoupon,
    getAvailableTimeSlots,
    createAppointment,
  };
};
