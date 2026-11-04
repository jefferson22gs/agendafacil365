import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Camera, Download, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QRCheckInProps {
    appointmentId: string;
    appointmentData?: {
        clientName: string;
        service: string;
        time: string;
    };
    onCheckIn: (appointmentId: string) => Promise<void>;
    className?: string;
}

// Generate a simple QR code URL using a free API
function generateQRCodeUrl(data: string, size: number = 200): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

// QR Code Generator Component
export function QRCodeGenerator({
    appointmentId,
    appointmentData,
    className
}: Omit<QRCheckInProps, "onCheckIn">) {
    const [size, setSize] = useState(200);

    const qrData = useMemo(() => {
        return JSON.stringify({
            type: "syshair_checkin",
            id: appointmentId,
            timestamp: Date.now(),
        });
    }, [appointmentId]);

    const qrUrl = generateQRCodeUrl(qrData, size);

    const handleDownload = async () => {
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `checkin-${appointmentId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("QR Code baixado!");
        } catch (error) {
            toast.error("Erro ao baixar QR Code");
        }
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="text-primary" />
                    QR Code Check-in
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl">
                    <img
                        src={qrUrl}
                        alt="QR Code para Check-in"
                        width={size}
                        height={size}
                        className="rounded-lg"
                    />
                </div>

                {appointmentData && (
                    <div className="text-center text-sm">
                        <p className="font-medium">{appointmentData.clientName}</p>
                        <p className="text-muted-foreground">
                            {appointmentData.service} • {appointmentData.time}
                        </p>
                    </div>
                )}

                <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download size={14} className="mr-2" />
                    Baixar QR Code
                </Button>
            </CardContent>
        </Card>
    );
}

// QR Code Scanner Component (simplified - uses camera input)
interface QRScannerProps {
    onScan: (data: string) => void;
    className?: string;
}

export function QRScanner({ onScan, className }: QRScannerProps) {
    const [manualCode, setManualCode] = useState("");
    const [scanning, setScanning] = useState(false);

    const handleManualSubmit = () => {
        if (!manualCode.trim()) {
            toast.error("Digite o código");
            return;
        }
        onScan(manualCode);
        setManualCode("");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanning(true);
        try {
            // In a real implementation, you would use a QR code reading library
            // For now, we'll simulate scanning
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.info("Use a entrada manual por enquanto");
        } finally {
            setScanning(false);
        }
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Camera className="text-primary" />
                    Escanear Check-in
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Camera upload option */}
                <div className="relative">
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={scanning}
                    />
                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={scanning}
                    >
                        {scanning ? (
                            <>
                                <RefreshCw size={16} className="mr-2 animate-spin" />
                                Escaneando...
                            </>
                        ) : (
                            <>
                                <Camera size={16} className="mr-2" />
                                Abrir Câmera
                            </>
                        )}
                    </Button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                </div>

                {/* Manual code entry */}
                <div className="flex gap-2">
                    <Input
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Digite o código manualmente"
                        className="flex-1"
                    />
                    <Button variant="brand" onClick={handleManualSubmit} aria-label="Confirmar check-in">
                        <Check size={16} />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// Check-in confirmation component
interface CheckInConfirmationProps {
    success: boolean;
    appointmentData?: {
        clientName: string;
        service: string;
        time: string;
    };
    onClose: () => void;
}

export function CheckInConfirmation({ success, appointmentData, onClose }: CheckInConfirmationProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
            "animate-in fade-in duration-200"
        )}>
            <Card className={cn(
                "w-80 text-center",
                success ? "border-success" : "border-destructive"
            )}>
                <CardContent className="pt-8 pb-6">
                    <div className={cn(
                        "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4",
                        success ? "bg-success" : "bg-destructive"
                    )}>
                        {success ? (
                            <Check size={32} className="text-success-foreground" aria-hidden />
                        ) : (
                            <X size={32} className="text-destructive-foreground" aria-hidden />
                        )}
                    </div>

                    <h3 className="text-xl font-bold mb-2">
                        {success ? "Check-in Realizado!" : "Check-in Falhou"}
                    </h3>

                    {appointmentData && success && (
                        <div className="text-sm text-muted-foreground">
                            <p>{appointmentData.clientName}</p>
                            <p>{appointmentData.service} • {appointmentData.time}</p>
                        </div>
                    )}

                    {!success && (
                        <p className="text-sm text-muted-foreground">
                            Agendamento não encontrado ou já realizado
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
