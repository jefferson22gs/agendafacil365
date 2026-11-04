import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportColumn {
    key: string;
    label: string;
}

interface DataExporterProps {
    data: Record<string, any>[];
    columns: ExportColumn[];
    filename?: string;
    className?: string;
}

export function DataExporter({ data, columns, filename = "export", className }: DataExporterProps) {
    const [isExporting, setIsExporting] = useState<"csv" | "pdf" | null>(null);

    const exportToCSV = async () => {
        setIsExporting("csv");
        try {
            // Build CSV header
            const header = columns.map((col) => col.label).join(";");

            // Build CSV rows
            const rows = data.map((row) =>
                columns.map((col) => {
                    const value = row[col.key];
                    // Handle different types
                    if (value === null || value === undefined) return "";
                    if (typeof value === "number") return value.toString().replace(".", ",");
                    if (typeof value === "object") return JSON.stringify(value);
                    // Escape quotes and wrap in quotes if contains separator
                    const strValue = String(value);
                    if (strValue.includes(";") || strValue.includes('"') || strValue.includes("\n")) {
                        return `"${strValue.replace(/"/g, '""')}"`;
                    }
                    return strValue;
                }).join(";")
            ).join("\n");

            const csv = `${header}\n${rows}`;

            // Create and download file
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("CSV exportado com sucesso!");
        } catch (error) {
            console.error("Error exporting CSV:", error);
            toast.error("Erro ao exportar CSV");
        } finally {
            setIsExporting(null);
        }
    };

    const exportToPDF = async () => {
        setIsExporting("pdf");
        try {
            // Create printable HTML
            const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #2563EB; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>${filename}</h1>
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th>${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data.map((row) => `
                <tr>
                  ${columns.map((col) => {
                const value = row[col.key];
                if (value === null || value === undefined) return "<td>-</td>";
                if (typeof value === "number") {
                    return `<td>${value.toLocaleString("pt-BR")}</td>`;
                }
                return `<td>${String(value)}</td>`;
            }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Exportado em ${new Date().toLocaleString("pt-BR")} | Agenda Fácil 365
          </div>
        </body>
        </html>
      `;

            // Open print dialog
            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.focus();

                // Wait for content to load then print
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);

                toast.success("PDF preparado para impressão!");
            } else {
                toast.error("Bloqueador de popup ativo. Permita popups para exportar PDF.");
            }
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("Erro ao exportar PDF");
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={className} disabled={isExporting !== null}>
                    {isExporting ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                        <Download size={16} className="mr-2" />
                    )}
                    Exportar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} disabled={isExporting !== null}>
                    <FileSpreadsheet size={16} className="mr-2" />
                    Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF} disabled={isExporting !== null}>
                    <FileText size={16} className="mr-2" />
                    Exportar PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
