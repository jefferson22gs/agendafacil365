import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Image, Plus, Eye, EyeOff, Link, Copy, Trash2, Camera, CheckCircle2, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/page-header";

interface GalleryItem {
  id: string;
  before_image_url: string | null;
  after_image_url: string | null;
  description: string | null;
  visibility: string;
  share_token: string | null;
  created_at: string;
  client?: { name: string };
  professional?: { name: string };
  service?: { name: string };
}

interface Client {
  id: string;
  name: string;
}

const GalleryPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("link");

  // Camera refs
  const videoRef = useState<HTMLVideoElement | null>(null);
  const canvasRef = useState<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<"before" | "after">("after");

  const [formData, setFormData] = useState({
    client_id: '',
    before_image_url: '',
    after_image_url: '',
    description: '',
    visibility: 'private'
  });

  useEffect(() => {
    fetchSalonId();
  }, [user]);

  useEffect(() => {
    if (salonId) {
      fetchGallery();
      fetchClients();
    }
  }, [salonId]);

  // Clean up camera stream on unmount or dialog close
  useEffect(() => {
    if (!isDialogOpen && stream) {
      stopCamera();
    }
  }, [isDialogOpen]);

  const fetchSalonId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) setSalonId(data.id);
    setLoading(false);
  };

  const fetchGallery = async () => {
    if (!salonId) return;

    const { data, error } = await supabase
      .from('client_gallery')
      .select(`
        *,
        client:clients(name),
        professional:professionals(name),
        service:services(name)
      `)
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching gallery:", error);
      return;
    }
    setGallery(data || []);
  };

  const fetchClients = async () => {
    if (!salonId) return;

    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('salon_id', salonId);

    setClients(data || []);
  };

  const generateShareToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    if (!event.target.files || event.target.files.length === 0 || !salonId) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${salonId}/${Date.now()}-${type}.${fileExt}`;

    setUploading(true);
    try {
      const { error: uploadError, data } = await supabase.storage
        .from('gallery')
        .upload(fileName, file);

      if (uploadError) {
        // Se bucket não existir, tenta criar ou avisa (geralmente deve ser criado no painel)
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('gallery')
        .getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        [type === 'before' ? 'before_image_url' : 'after_image_url']: publicUrl
      }));

      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar imagem. Verifique se o bucket 'gallery' existe no Storage.");
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async (type: "before" | "after") => {
    setCameraType(type);
    setCameraActive(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      // Logic to attach stream to video element is handled in ref callback or useEffect
      // But since we are using simple state for now, we will assume the video element picks it up
      // In a real implementation with Refs:
      const videoElement = document.getElementById('camera-video') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Erro ao acessar a câmera");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const videoElement = document.getElementById('camera-video') as HTMLVideoElement;
    const canvasElement = document.createElement('canvas'); // Create temp canvas
    if (videoElement && stream) {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0);

        canvasElement.toBlob(async (blob) => {
          if (!blob || !salonId) return;

          const fileName = `${salonId}/${Date.now()}-${cameraType}.jpg`;
          setUploading(true);

          try {
            const { error: uploadError } = await supabase.storage
              .from('gallery')
              .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('gallery')
              .getPublicUrl(fileName);

            setFormData(prev => ({
              ...prev,
              [cameraType === 'before' ? 'before_image_url' : 'after_image_url']: publicUrl
            }));

            toast.success("Foto capturada e salva!");
            stopCamera();
          } catch (error) {
            console.error("Error uploading capture:", error);
            toast.error("Erro ao salvar foto capturada.");
          } finally {
            setUploading(false);
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !formData.client_id) return;

    // Validar se tem pelo menos uma imagem
    if (!formData.before_image_url && !formData.after_image_url) {
      toast.error("Adicione pelo menos uma imagem (Antes ou Depois)");
      return;
    }

    try {
      const { error } = await supabase
        .from('client_gallery')
        .insert({
          salon_id: salonId,
          client_id: formData.client_id,
          before_image_url: formData.before_image_url || null,
          after_image_url: formData.after_image_url || null,
          description: formData.description || null,
          visibility: formData.visibility,
          share_token: formData.visibility === 'link' ? generateShareToken() : null
        });

      if (error) throw error;

      toast.success("Imagem adicionada!");
      setIsDialogOpen(false);
      resetForm();
      fetchGallery();
    } catch (error) {
      console.error("Error saving gallery item:", error);
      toast.error("Erro ao salvar imagem");
    }
  };

  const toggleVisibility = async (id: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    try {
      const { error } = await supabase
        .from('client_gallery')
        .update({ visibility: newVisibility })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Visibilidade alterada para ${newVisibility === 'public' ? 'pública' : 'privada'}`);
      fetchGallery();
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Erro ao alterar visibilidade");
    }
  };

  // ponytail: não existe rota pública /gallery/:token em App.tsx — o link copiado abria a página 404.
  // Até a página pública existir, não copiar URL quebrada. O token continua gravado para uso futuro.
  const copyShareLink = (_token: string) => {
    toast.info("Página pública de transformações ainda não disponível. O link será liberado quando a página existir.");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta imagem?")) return;

    try {
      const { error } = await supabase
        .from('client_gallery')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Imagem excluída!");
      fetchGallery();
    } catch (error) {
      console.error("Error deleting gallery item:", error);
      toast.error("Erro ao excluir imagem");
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      before_image_url: '',
      after_image_url: '',
      description: '',
      visibility: 'private'
    });
    setActiveTab("link");
    setCapturedImage(null);
    stopCamera();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando galeria…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="gallery-header">
          <PageHeader
            className="mb-0"
            title="Galeria Antes & Depois"
            description="Documente transformações e compartilhe resultados."
            actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="gallery-new-button">
                <Plus size={18} className="mr-2" />
                Nova Transformação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-tour="gallery-dialog">
              <DialogHeader>
                <DialogTitle>Adicionar Transformação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gallery-client">Cliente</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger id="gallery-client" data-tour="gallery-client">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 border p-4 rounded-lg bg-secondary/10">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4" data-tour="gallery-source-tabs">
                      <TabsTrigger value="link" data-tour="gallery-link-tab">Link</TabsTrigger>
                      <TabsTrigger value="upload" data-tour="gallery-upload-tab">Upload</TabsTrigger>
                      <TabsTrigger value="camera" data-tour="gallery-camera-tab">Câmera</TabsTrigger>
                    </TabsList>

                    <TabsContent value="link" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="gallery-before-url">Link Imagem Antes</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gallery-before-url"
                            value={formData.before_image_url}
                            onChange={(e) => setFormData({ ...formData, before_image_url: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gallery-after-url">Link Imagem Depois</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gallery-after-url"
                            value={formData.after_image_url}
                            onChange={(e) => setFormData({ ...formData, after_image_url: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="space-y-4" data-tour="gallery-upload-fields">
                      <div className="space-y-2">
                        <Label htmlFor="gallery-before-file">Upload "Antes"</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="gallery-before-file"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'before')}
                            disabled={uploading}
                          />
                        </div>
                        {formData.before_image_url && <p className="text-xs text-success" role="status">Imagem carregada!</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gallery-after-file">Upload "Depois"</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="gallery-after-file"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'after')}
                            disabled={uploading}
                          />
                        </div>
                        {formData.after_image_url && <p className="text-xs text-success" role="status">Imagem carregada!</p>}
                      </div>
                    </TabsContent>

                    <TabsContent value="camera" className="space-y-4" data-tour="gallery-camera-panel">
                      {!cameraActive ? (
                        <div className="grid grid-cols-2 gap-4">
                          <Button data-tour="gallery-capture-before" type="button" variant="outline" onClick={() => startCamera('before')} className="h-24 flex flex-col gap-2">
                            <Camera size={24} />
                            Capturar "Antes"
                          </Button>
                          <Button data-tour="gallery-capture-after" type="button" variant="outline" onClick={() => startCamera('after')} className="h-24 flex flex-col gap-2">
                            <Camera size={24} />
                            Capturar "Depois"
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                            <video id="camera-video" autoPlay playsInline className="w-full h-full object-cover"></video>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="destructive" onClick={stopCamera} className="flex-1">
                              Cancelar
                            </Button>
                            <Button data-tour="gallery-capture-photo" type="button" variant="default" onClick={capturePhoto} className="flex-1">
                              Capturar Foto
                            </Button>
                          </div>
                          <p className="text-center text-sm font-medium">Capturando: {cameraType === 'before' ? 'Antes' : 'Depois'}</p>
                        </div>
                      )}

                      {/* Situação de cada foto com texto + ícone (sem depender de emoji/cor) */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Badge variant={formData.before_image_url ? 'success' : 'warning'} className="gap-1">
                          {formData.before_image_url ? <CheckCircle2 size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
                          Antes: {formData.before_image_url ? 'definida' : 'pendente'}
                        </Badge>
                        <Badge variant={formData.after_image_url ? 'success' : 'warning'} className="gap-1">
                          {formData.after_image_url ? <CheckCircle2 size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
                          Depois: {formData.after_image_url ? 'definida' : 'pendente'}
                        </Badge>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Previews */}
                  {(formData.before_image_url || formData.after_image_url) && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {formData.before_image_url && (
                        <div className="relative aspect-square rounded overflow-hidden border">
                          <img src={formData.before_image_url} alt="Antes" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 bg-black/50 text-white text-xs px-1 w-full">Antes</div>
                        </div>
                      )}
                      {formData.after_image_url && (
                        <div className="relative aspect-square rounded overflow-hidden border">
                          <img src={formData.after_image_url} alt="Depois" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 bg-black/50 text-white text-xs px-1 w-full">Depois</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gallery-description">Descrição</Label>
                  <Input
                    id="gallery-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição da transformação"
                  />
                </div>

                <div className="space-y-2" data-tour="gallery-visibility">
                  <Label htmlFor="gallery-visibility">Visibilidade</Label>
                  <Select
                    value={formData.visibility}
                    onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                  >
                    <SelectTrigger id="gallery-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Privada</SelectItem>
                      <SelectItem value="public">Pública</SelectItem>
                      <SelectItem value="link">Compartilhável por link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button data-tour="gallery-save" type="submit" variant="brand" className="flex-1" disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            }
          />
        </div>

        {/* Gallery Grid */}
        {gallery.length === 0 ? (
          <div data-tour="gallery-empty">
            <EmptyState icon={Image} title="Nenhuma transformação registrada" description="Adicione fotos antes e depois dos seus trabalhos." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="gallery-list">
            {gallery.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-1">
                  <div className="aspect-square bg-secondary/50 flex items-center justify-center relative group">
                    {item.before_image_url ? (
                      <img
                        src={item.before_image_url}
                        alt="Antes"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Image size={24} className="text-muted-foreground mx-auto" />
                        <span className="text-xs text-muted-foreground">Antes</span>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Antes</span>
                  </div>
                  <div className="aspect-square bg-secondary/50 flex items-center justify-center relative group">
                    {item.after_image_url ? (
                      <img
                        src={item.after_image_url}
                        alt="Depois"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Image size={24} className="text-muted-foreground mx-auto" />
                        <span className="text-xs text-muted-foreground">Depois</span>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Depois</span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{item.client?.name || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        data-tour="gallery-toggle-visibility"
                        aria-label="Alterar visibilidade da transformação"
                        onClick={() => toggleVisibility(item.id, item.visibility)}
                      >
                        {item.visibility === 'public' ? (
                          <Eye size={14} className="text-success" />
                        ) : (
                          <EyeOff size={14} className="text-muted-foreground" />
                        )}
                      </Button>
                      {item.share_token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          data-tour="gallery-share"
                          aria-label="Copiar link da transformação"
                          onClick={() => copyShareLink(item.share_token!)}
                        >
                          <Copy size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        data-tour="gallery-delete"
                        aria-label="Excluir transformação"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={item.visibility === 'public' ? 'success' : item.visibility === 'link' ? 'info' : 'secondary'}>
                      {item.visibility === 'public' && 'Pública'}
                      {item.visibility === 'private' && 'Privada'}
                      {item.visibility === 'link' && 'Link'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default GalleryPage;
