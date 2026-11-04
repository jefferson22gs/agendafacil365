import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Download,
    FileText,
    Users,
    Loader2,
    CheckCircle2,
    FileSpreadsheet
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/admin/StatCard";

interface Client {
    id: string;
    name: string;
    phone: string | null;
    email?: string;
    birth_date?: string;
    preferences?: any;
    created_at: string;
}

export default function ExportContacts() {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState<'vcf' | 'csv'>('vcf');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        loadClients();
    }, [user]);

    const loadClients = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Buscar salão do usuário
            const { data: salons } = await supabase
                .from('salons')
                .select('id')
                .eq('owner_id', user.id)
                .limit(1);

            if (!salons || salons.length === 0) {
                toast.error("Salão não encontrado");
                return;
            }

            const salonId = salons[0].id;

            // Buscar clientes do salão
            const { data: clientsData, error } = await supabase
                .from('clients')
                .select('*')
                .eq('salon_id', salonId)
                .order('name');

            if (error) throw error;

            setClients(clientsData || []);

            // Selecionar todos por padrão
            const allIds = new Set(clientsData?.map(c => c.id) || []);
            setSelectedClients(allIds);

            toast.success(`${clientsData?.length || 0} clientes carregados`);
        } catch (error: any) {
            console.error('Erro ao carregar clientes:', error);
            toast.error("Erro ao carregar clientes");
        } finally {
            setLoading(false);
        }
    };

    const toggleClient = (clientId: string) => {
        const newSelected = new Set(selectedClients);
        if (newSelected.has(clientId)) {
            newSelected.delete(clientId);
        } else {
            newSelected.add(clientId);
        }
        setSelectedClients(newSelected);
    };

    const toggleAll = () => {
        if (selectedClients.size === clients.length) {
            setSelectedClients(new Set());
        } else {
            setSelectedClients(new Set(clients.map(c => c.id)));
        }
    };

    const normalizePhone = (phone: string): string => {
        // Remove caracteres não numéricos
        let cleaned = phone.replace(/[^\d]/g, '');

        // Adicionar código do país se necessário
        if (cleaned.length === 11) {
            cleaned = '55' + cleaned;
        } else if (cleaned.length === 10) {
            cleaned = '55' + cleaned;
        }

        return cleaned;
    };

    const generateVCF = (selectedClientsData: Client[]): string => {
        let vcfContent = '';

        for (const client of selectedClientsData) {
            const phone = normalizePhone(client.phone ?? '');
            const birthDate = client.preferences?.birth_date || client.birth_date;

            vcfContent += 'BEGIN:VCARD\n';
            vcfContent += 'VERSION:3.0\n';
            vcfContent += `FN:${client.name}\n`;
            vcfContent += `N:${client.name};;;;\n`;
            if (phone) vcfContent += `TEL;TYPE=CELL:+${phone}\n`;

            if (client.email) {
                vcfContent += `EMAIL:${client.email}\n`;
            }

            if (birthDate) {
                // Formato: BDAY:YYYY-MM-DD
                vcfContent += `BDAY:${birthDate}\n`;
            }

            vcfContent += `NOTE:Cliente exportado do Agenda Fácil 365 em ${new Date().toLocaleDateString('pt-BR')}\n`;
            vcfContent += 'END:VCARD\n';
        }

        return vcfContent;
    };

    const generateCSV = (selectedClientsData: Client[]): string => {
        // Cabeçalho
        let csvContent = 'Nome,Telefone,Email,Data de Nascimento,Data de Cadastro\n';

        for (const client of selectedClientsData) {
            const phone = client.phone ?? '';
            const email = client.email || '';
            const birthDate = client.preferences?.birth_date || client.birth_date || '';
            const createdAt = new Date(client.created_at).toLocaleDateString('pt-BR');

            // Escapar vírgulas e aspas
            const escapeCsv = (str: string) => {
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            csvContent += `${escapeCsv(client.name)},${escapeCsv(phone)},${escapeCsv(email)},${escapeCsv(birthDate)},${escapeCsv(createdAt)}\n`;
        }

        return csvContent;
    };

    const handleExport = async () => {
        if (selectedClients.size === 0) {
            toast.error("Selecione pelo menos um cliente");
            return;
        }

        try {
            setExporting(true);
            setProgress(0);

            // Filtrar clientes selecionados
            const selectedClientsData = clients.filter(c => selectedClients.has(c.id));

            setProgress(30);

            let content: string;
            let filename: string;
            let mimeType: string;

            if (exportFormat === 'vcf') {
                content = generateVCF(selectedClientsData);
                filename = `clientes_${new Date().toISOString().split('T')[0]}.vcf`;
                mimeType = 'text/vcard';
            } else {
                content = generateCSV(selectedClientsData);
                filename = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
            }

            setProgress(70);

            // Criar blob e fazer download
            const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setProgress(100);

            toast.success(`${selectedClientsData.length} clientes exportados com sucesso!`);

            // Reset progress após 2 segundos
            setTimeout(() => {
                setProgress(0);
            }, 2000);

        } catch (error: any) {
            console.error('Erro ao exportar:', error);
            toast.error("Erro ao exportar clientes");
        } finally {
            setExporting(false);
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto">
                <div className="space-y-6">
                    {/* Header — a ação principal (Exportar) fica no fim, pois depende da seleção abaixo */}
                    <div data-tour="export-contacts-header">
                        <PageHeader
                            className="mb-0"
                            title="Exportar Clientes"
                            description="Exporte seus clientes em formato VCF (vCard) ou CSV."
                        />
                    </div>

                    {/* Estatísticas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard icon={Users} tone="neutral" label="Total de Clientes" value={clients.length} />
                        <StatCard icon={CheckCircle2} label="Selecionados" value={selectedClients.size} />
                        <StatCard icon={exportFormat === 'vcf' ? FileText : FileSpreadsheet} label="Formato" value={<span className="uppercase">{exportFormat}</span>} />
                    </div>

                    {/* Formato de Exportação */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Formato de Exportação</CardTitle>
                            <CardDescription>
                                Escolha o formato para exportar seus clientes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup data-tour="export-contacts-format" value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                                <div className="flex items-center space-x-2 p-4 border border-border rounded-xl hover:bg-accent cursor-pointer has-[:checked]:border-primary">
                                    <RadioGroupItem value="vcf" id="vcf" />
                                    <Label htmlFor="vcf" className="flex-1 cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-5 w-5 text-primary shrink-0" aria-hidden />
                                            <div>
                                                <p className="font-medium">VCF (vCard)</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Formato padrão de contatos. Pode ser importado no WhatsApp, iPhone, Android, etc.
                                                </p>
                                            </div>
                                        </div>
                                    </Label>
                                </div>

                                <div className="flex items-center space-x-2 p-4 border border-border rounded-xl hover:bg-accent cursor-pointer has-[:checked]:border-primary">
                                    <RadioGroupItem value="csv" id="csv" />
                                    <Label htmlFor="csv" className="flex-1 cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" aria-hidden />
                                            <div>
                                                <p className="font-medium">CSV (Excel)</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Planilha com dados dos clientes. Pode ser aberto no Excel, Google Sheets, etc.
                                                </p>
                                            </div>
                                        </div>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </CardContent>
                    </Card>

                    {/* Lista de Clientes */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle>Selecionar Clientes</CardTitle>
                                    <CardDescription>
                                        Escolha quais clientes deseja exportar
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={toggleAll}
                                    data-tour="export-contacts-select-all"
                                >
                                    {selectedClients.size === clients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                                    <p className="text-sm text-muted-foreground">Carregando clientes…</p>
                                </div>
                            ) : clients.length === 0 ? (
                                <div data-tour="export-contacts-empty">
                                    <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Cadastre ou importe clientes para poder exportá-los." className="border-0 bg-transparent" />
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px] pr-4" data-tour="export-contacts-list">
                                    <div className="space-y-2">
                                        {clients.map((client) => (
                                            <div
                                                key={client.id}
                                                className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 border border-border rounded-xl hover:bg-accent cursor-pointer"
                                                onClick={() => toggleClient(client.id)}
                                            >
                                                <Checkbox
                                                    aria-label={`Selecionar ${client.name}`}
                                                    checked={selectedClients.has(client.id)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onCheckedChange={() => toggleClient(client.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{client.name}</p>
                                                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                                                </div>
                                                {client.email && (
                                                    <p className="text-sm text-muted-foreground break-all">{client.email}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>

                    {/* Botão de Exportação */}
                    <Card>
                        <CardContent className="pt-6">
                            {exporting && progress > 0 && (
                                <div className="mb-4">
                                    <Progress value={progress} className="h-2" />
                                    <p className="text-sm text-muted-foreground text-center mt-2">
                                        Exportando... {progress}%
                                    </p>
                                </div>
                            )}

                            <Button
                                variant="brand"
                                onClick={handleExport}
                                data-tour="export-contacts-download"
                                disabled={exporting || selectedClients.size === 0}
                                className="w-full"
                                size="lg"
                            >
                                {exporting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                                        Exportando...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-5 w-5" aria-hidden />
                                        Exportar {selectedClients.size} Cliente{selectedClients.size !== 1 ? 's' : ''}
                                    </>
                                )}
                            </Button>

                            <p className="text-xs text-muted-foreground text-center mt-4">
                                O arquivo será baixado automaticamente no seu computador
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
