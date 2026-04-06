import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExtractedLead } from './types';

interface Props {
  leads: ExtractedLead[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRemove: (id: string) => void;
}

export function ExtractionResultsTable({ leads, selectedIds, onToggleSelect, onSelectAll, onRemove }: Props) {
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Resultados ({leads.length} leads)
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selecionados
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => onToggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{lead.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.cidade}</TableCell>
                  <TableCell>{lead.telefone}</TableCell>
                  <TableCell>
                    {lead.site ? (
                      <a
                        href={lead.site.startsWith('http') ? lead.site : `https://${lead.site}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Site
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onRemove(lead.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
