import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Send, Eye, MousePointer, AlertTriangle, Clock, Sparkles } from 'lucide-react';

export default function AdminEmailsPage() {
  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">E-mails</h1>
          <p className="text-muted-foreground">Cadência automática com assistência de IA</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nova Cadência
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Enviados', value: '0', icon: Send, color: 'text-blue-400' },
          { label: 'Entregues', value: '0', icon: Mail, color: 'text-emerald-400' },
          { label: 'Abertos', value: '0', icon: Eye, color: 'text-violet-400' },
          { label: 'Clicados', value: '0', icon: MousePointer, color: 'text-cyan-400' },
          { label: 'Bounced', value: '0', icon: AlertTriangle, color: 'text-destructive' },
        ].map((kpi) => (
          <Card key={kpi.label} className="card-gradient border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cadences */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Cadências de Disparo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhuma cadência criada</p>
                <p className="text-sm mt-1">Crie sua primeira cadência para começar a enviar e-mails automaticamente.</p>
                <Button className="mt-4" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Cadência
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sends */}
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5" />
                Últimos Envios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">Nenhum envio registrado ainda.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Assistant */}
        <div className="space-y-4">
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Assistente IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use a IA para gerar mensagens de e-mail personalizadas para suas cadências.
              </p>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Exemplo de prompt:</p>
                <p className="text-sm italic">"Crie um e-mail de apresentação para clínicas de estética"</p>
              </div>
              <Button className="w-full" variant="outline" disabled>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar E-mail com IA
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Configure a chave OpenAI nas configurações da conta para ativar.
              </p>
            </CardContent>
          </Card>

          {/* Templates */}
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Nenhum template criado.</p>
                <Button className="mt-3" variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
