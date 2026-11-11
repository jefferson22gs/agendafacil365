import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { NotificationPrompt } from "@/components/pwa/NotificationPrompt";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { TrialWarningBanner } from "@/components/subscription/Paywall";
import { TrainingProvider } from "@/features/training/TrainingProvider";
import { IS_DEMO } from "@/config/demo";
import { DemoBanner } from "@/components/demo/DemoBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BookingFlow from "./pages/BookingFlow";
import PublicSalon from "./pages/PublicSalon";
import PublicProfessional from "./pages/PublicProfessional";
import ManageAppointment from "./pages/ManageAppointment";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import Checkout from "./pages/Checkout";
import PublicBookingAdvanced from "./pages/PublicBookingAdvanced";

// Lazy loaded Public Pages
const PublicWaitlist = lazy(() => import("./pages/PublicWaitlist"));
const RatingPage = lazy(() => import("./pages/RatingPage"));

// Lazy loaded Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SalonSettings = lazy(() => import("./pages/admin/SalonSettings"));
const Professionals = lazy(() => import("./pages/admin/Professionals"));
const Services = lazy(() => import("./pages/admin/Services"));
const Coupons = lazy(() => import("./pages/admin/Coupons"));
const Appointments = lazy(() => import("./pages/admin/Appointments"));
const Clients = lazy(() => import("./pages/admin/Clients"));
const Returns = lazy(() => import("./pages/admin/Returns"));
const Contract = lazy(() => import("./pages/admin/Contract"));
const Financial = lazy(() => import("./pages/admin/Financial"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Packages = lazy(() => import("./pages/admin/Packages"));
const Products = lazy(() => import("./pages/admin/Products"));
const Reviews = lazy(() => import("./pages/admin/Reviews"));
const MultiUnits = lazy(() => import("./pages/admin/MultiUnits"));
const Gallery = lazy(() => import("./pages/admin/Gallery"));
const AdvancedFeatures = lazy(() => import("./pages/admin/AdvancedFeatures"));
const SubscriptionManagement = lazy(() => import("./pages/admin/SubscriptionManagement"));
const Marketing = lazy(() => import("./pages/admin/Marketing"));
const WhatsAppCentral = lazy(() => import("./pages/admin/whatsapp/WhatsAppCentral"));
const LegacyWhatsAppRedirect = lazy(() => import("./pages/admin/whatsapp/WhatsAppCentral").then(m => ({ default: m.LegacyWhatsAppRedirect })));
const TrainingCenter = lazy(() => import("./features/training/pages/TrainingCenter"));
const TrainingArticle = lazy(() => import("./features/training/pages/TrainingArticle"));

// Lazy loaded Professional Pages
const ProfessionalDashboard = lazy(() => import("./pages/professional/ProfessionalDashboard"));

// Lazy loaded Client Pages
const ClientProfile = lazy(() => import("./pages/client/ClientProfile"));

// Super Admin
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {IS_DEMO && <DemoBanner />}
      <Toaster />
      <Sonner />
      {/* Demo: sem PWA/push (nenhum service worker é registrado). */}
      {!IS_DEMO && <InstallPrompt />}
      <OfflineIndicator />
      {!IS_DEMO && <NotificationPrompt />}
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <TrialWarningBanner />
            <TrainingProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={IS_DEMO ? <Navigate to="/admin" replace /> : <Login />} />
              <Route path="/register" element={IS_DEMO ? <Navigate to="/admin" replace /> : <Register />} />
              <Route path="/install" element={<Install />} />
              <Route path="/booking" element={<BookingFlow />} />
              <Route path="/booking/:salonId" element={<BookingFlow />} />

              {/* Public Salon Booking by Slug */}
              <Route path="/s/:slug" element={<PublicSalon />} />
              {/* Public Professional Booking Page */}
              <Route path="/s/:salonSlug/:professionalSlug" element={<PublicProfessional />} />
              {/* Manage Appointment by Token */}
              <Route path="/appointment/:token" element={<ManageAppointment />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/agendar" element={<PublicBookingAdvanced />} />
              <Route path="/agendar/:salonSlug" element={<PublicBookingAdvanced />} />
              <Route path="/avaliar/:appointmentId" element={<Suspense fallback={<LoadingScreen />}><RatingPage /></Suspense>} />

              {/* Super Admin */}
              <Route path="/super-admin" element={
                <Suspense fallback={<LoadingScreen />}>
                  <SuperAdmin />
                </Suspense>
              } />

              {/* Public Waitlist */}
              <Route path="/waitlist/:salonId" element={
                <Suspense fallback={<LoadingScreen />}>
                  <PublicWaitlist />
                </Suspense>
              } />

              {/* Legacy dashboard redirect */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Navigate to="/admin" replace />
                </ProtectedRoute>
              } />

              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <AdminDashboard />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <SalonSettings />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/professionals" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Professionals />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/services" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Services />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/coupons" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Coupons />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/appointments" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Appointments />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/clients" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Clients />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/contract" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Contract />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/returns" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Returns />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/financial" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Financial />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Analytics />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/packages" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Packages />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/products" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Products />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/reviews" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Reviews />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/multi-units" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <MultiUnits />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/gallery" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Gallery />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/advanced" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <AdvancedFeatures />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/subscription" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <SubscriptionManagement />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/marketing" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Marketing />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/chatbot" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LegacyWhatsAppRedirect />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/status-scheduler" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LegacyWhatsAppRedirect />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/whatsapp" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <WhatsAppCentral />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/broadcast" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LegacyWhatsAppRedirect />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/import-contacts" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LegacyWhatsAppRedirect />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/export-contacts" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <LegacyWhatsAppRedirect />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/training" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <TrainingCenter />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/training/:articleId" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <TrainingArticle />
                  </Suspense>
                </ProtectedRoute>
              } />

              {/* Professional Routes */}
              <Route path="/professional" element={
                <ProtectedRoute requiredRole="professional">
                  <Suspense fallback={<LoadingScreen />}>
                    <ProfessionalDashboard />
                  </Suspense>
                </ProtectedRoute>
              } />

              {/* Client Routes */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <ClientProfile />
                  </Suspense>
                </ProtectedRoute>
              } />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </TrainingProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
