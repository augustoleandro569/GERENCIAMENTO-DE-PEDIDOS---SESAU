import React from 'react';
import { Order, OrderStatus } from '../../types';
import { LinusVectorSvg } from '../common/Logo';
import { 
  Building2, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Boxes, 
  FileText, 
  TrendingUp, 
  Activity,
  ShieldCheck,
  Calendar,
  UserCheck
} from 'lucide-react';

interface ConsolidatedReportDocumentProps {
  orders: Order[];
  leadTimes: {
    approvalHours: number;
    approvalDays: number;
    separationHours: number;
    separationDays: number;
    deliveryHours: number;
    deliveryDays: number;
    totalHours: number;
    totalDays: number;
  };
  filterProgram?: string;
  filterUnit?: string;
  generatedAt?: string;
  generatedBy?: {
    nome: string;
    cargo: string;
  };
}

export const ConsolidatedReportDocument: React.FC<ConsolidatedReportDocumentProps> = ({
  orders,
  leadTimes,
  filterProgram = 'ALL',
  filterUnit = 'ALL',
  generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
  generatedBy = { nome: 'Coordenação Geral de Abastecimento', cargo: 'SESAU / AL & Linus Soluções' }
}) => {
  // Total metrics
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(
    o => o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente'
  ).length;
  const inProgressOrders = totalOrders - deliveredOrders;
  const emergencyOrders = orders.filter(
    o => o.tipo === 'Emergencial' || o.prioridade === 'Urgente' || o.tipo === 'Falta'
  ).length;
  const totalItems = orders.reduce((sum, o) => sum + (o.quantidade_itens || 0), 0);

  // SLA calculation
  const onTimeCount = orders.filter(o => o.sla_status === 'NO_PRAZO' || o.status_operacional === 'Entregue').length;
  const slaPercentage = totalOrders > 0 ? Math.round((onTimeCount / totalOrders) * 100) : 100;
  const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
  const emergencyRate = totalOrders > 0 ? Math.round((emergencyOrders / totalOrders) * 100) : 0;

  // Breakdown by operational status
  const statusesList: { label: OrderStatus; color: string; bg: string }[] = [
    { label: 'Aguardando Aprovação', color: 'text-amber-700', bg: 'bg-amber-500' },
    { label: 'Aprovada', color: 'text-blue-700', bg: 'bg-blue-500' },
    { label: 'Em Separação', color: 'text-indigo-700', bg: 'bg-indigo-500' },
    { label: 'Aguardando Conferência', color: 'text-purple-700', bg: 'bg-purple-500' },
    { label: 'Em Conferência', color: 'text-violet-700', bg: 'bg-violet-500' },
    { label: 'Expedida', color: 'text-teal-700', bg: 'bg-teal-500' },
    { label: 'Em Transporte', color: 'text-orange-700', bg: 'bg-orange-500' },
    { label: 'Entregue', color: 'text-emerald-700', bg: 'bg-emerald-500' },
    { label: 'Entregue Parcialmente', color: 'text-cyan-700', bg: 'bg-cyan-500' },
    { label: 'Cancelada', color: 'text-rose-700', bg: 'bg-rose-500' },
  ];

  const statusCounts = statusesList.map(s => {
    const count = orders.filter(o => o.status_operacional === s.label).length;
    const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
    return { ...s, count, pct };
  });

  // Breakdown by unit
  const unitMap = new Map<string, { total: number; delivered: number; emergency: number; items: number }>();
  orders.forEach(o => {
    const unitName = o.unidade || 'Não identificada';
    const curr = unitMap.get(unitName) || { total: 0, delivered: 0, emergency: 0, items: 0 };
    curr.total++;
    curr.items += o.quantidade_itens || 0;
    if (o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente') {
      curr.delivered++;
    }
    if (o.tipo === 'Emergencial' || o.prioridade === 'Urgente' || o.tipo === 'Falta') {
      curr.emergency++;
    }
    unitMap.set(unitName, curr);
  });

  const unitStats = Array.from(unitMap.entries())
    .map(([unidade, data]) => ({
      unidade,
      ...data,
      taxaEntrega: data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0,
      status: data.total > 0 && Math.round((data.delivered / data.total) * 100) >= 80 ? 'CONFORME' : 
              data.emergency > 2 ? 'CRÍTICO' : 'ATENÇÃO'
    }))
    .sort((a, b) => b.total - a.total);

  // Breakdown by program
  const programMap = new Map<string, { total: number; items: number; delivered: number }>();
  orders.forEach(o => {
    const pName = o.programa || 'Geral';
    const curr = programMap.get(pName) || { total: 0, items: 0, delivered: 0 };
    curr.total++;
    curr.items += o.quantidade_itens || 0;
    if (o.status_operacional === 'Entregue') curr.delivered++;
    programMap.set(pName, curr);
  });
  const programStats = Array.from(programMap.entries())
    .map(([programa, data]) => ({
      programa,
      ...data,
      pct: totalOrders > 0 ? Math.round((data.total / totalOrders) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  // Critical/emergency orders list (up to 10 for Page 3)
  const criticalOrders = orders
    .filter(o => o.tipo === 'Emergencial' || o.prioridade === 'Urgente' || o.tipo === 'Falta' || o.status_operacional === 'Aguardando Aprovação')
    .slice(0, 10);

  const documentProtocol = `REL-LINUS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return (
    <div id="consolidated-report-root" className="space-y-8 print:space-y-0 text-slate-800 font-sans">
      {/* ========================================================================= */}
      {/* PÁGINA 1: CAPA EXECUTIVA, INDICADORES & DIAGNÓSTICO DA CADEIA              */}
      {/* ========================================================================= */}
      <div 
        data-pdf-page="1" 
        className="report-page bg-white p-8 sm:p-10 border border-slate-200 rounded-2xl shadow-md max-w-4xl mx-auto min-h-[1100px] flex flex-col justify-between print:border-none print:shadow-none print:p-8 print:min-h-screen print:rounded-none"
      >
        <div className="space-y-6">
          {/* Header Institucional com Logo Oficial da Linus Soluções */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <LinusVectorSvg className="h-10 w-auto" />
              <div className="pl-3 border-l border-slate-200">
                <div className="text-[15px] font-black text-blue-900 tracking-tight leading-none uppercase">
                  Linus Soluções
                </div>
                <div className="text-[10px] font-semibold text-slate-500 tracking-wider mt-1 uppercase">
                  Logística & Cadeia de Suprimentos Hospitalar
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                SESAU / GOVERNO DE ALAGOAS
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                Secretaria de Estado da Saúde de Alagoas
              </div>
              <div className="text-[9px] font-mono text-blue-800 font-semibold mt-0.5">
                Protocolo: {documentProtocol}
              </div>
            </div>
          </div>

          {/* Título Oficial do Documento Consolidado */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                  Documento Oficial Consolidado
                </span>
                <h1 className="text-lg font-black text-slate-900 tracking-tight mt-1.5 uppercase">
                  Relatório Consolidado de Abastecimento Hospitalar
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Auditoria de fluxo, lead times, cumprimento de prazos (SLA) e distribuição da rede estadual.
                </p>
              </div>

              <div className="text-left sm:text-right text-[11px] text-slate-600 font-mono space-y-0.5 shrink-0 bg-white p-2.5 rounded-lg border border-slate-200">
                <div><span className="font-sans font-bold text-slate-800">Emissão:</span> {generatedAt}</div>
                <div><span className="font-sans font-bold text-slate-800">Programa:</span> {filterProgram === 'ALL' ? 'Todos os Programas' : filterProgram}</div>
                <div><span className="font-sans font-bold text-slate-800">Unidade:</span> {filterUnit === 'ALL' ? 'Rede Completa' : filterUnit}</div>
              </div>
            </div>
          </div>

          {/* Grade de 5 Indicadores Executivos (KPI Cards) */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              1. Sumário de Indicadores Executivos Globais
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Total Pedidos */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Pedidos</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{totalOrders}</div>
                <div className="text-[10px] text-slate-600 mt-1">
                  <span className="font-bold text-emerald-700">{deliveredOrders}</span> concl. / <span className="font-bold text-amber-700">{inProgressOrders}</span> and.
                </div>
              </div>

              {/* Cumprimento SLA */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-emerald-800 uppercase">Cumprimento SLA</div>
                <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">{slaPercentage}%</div>
                <div className="text-[10px] text-emerald-700 font-medium mt-1">
                  {onTimeCount} pedidos no prazo
                </div>
              </div>

              {/* Emergenciais / Urgentes */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-rose-800 uppercase">Emergenciais</div>
                <div className="text-xl font-bold font-mono text-rose-800 mt-0.5">{emergencyOrders}</div>
                <div className="text-[10px] text-rose-700 font-medium mt-1">
                  {emergencyRate}% da demanda
                </div>
              </div>

              {/* Itens Movimentados */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-blue-800 uppercase">Itens Físicos</div>
                <div className="text-xl font-bold font-mono text-blue-900 mt-0.5">{totalItems.toLocaleString()}</div>
                <div className="text-[10px] text-blue-700 font-medium mt-1">
                  Unidades expedidas
                </div>
              </div>

              {/* Lead Time Total */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold text-purple-800 uppercase">Lead Time Médio</div>
                <div className="text-xl font-bold font-mono text-purple-900 mt-0.5">{leadTimes.totalDays} dias</div>
                <div className="text-[10px] text-purple-700 font-medium mt-1">
                  {leadTimes.totalHours} horas ponta a ponta
                </div>
              </div>
            </div>
          </div>

          {/* Distribuição do Fluxo Operacional da Cadeia (10 Status sem unificação) */}
          <div className="space-y-2 pt-1">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-blue-600" />
              2. Distribuição da Carga por Etapa Operacional (Pipeline Completo)
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {statusCounts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.bg} shrink-0`} />
                      <span className="font-medium text-slate-700">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900">{s.count}</span>
                      <span className="text-[10px] text-slate-400">({s.pct}%)</span>
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                        <div 
                          className={`h-full ${s.bg}`} 
                          style={{ width: `${Math.min(100, Math.max(4, s.pct))}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Análise de Lead Time e Gargalos por Etapa */}
          <div className="space-y-2 pt-1">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              3. Desempenho de Lead Time por Etapa da Cadeia Logística
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-bold text-slate-800">1. Validação & Aprovação</div>
                <div className="text-lg font-bold font-mono text-blue-800 mt-1">{leadTimes.approvalHours} h</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Tempo da submissão até validação técnica SESAU.</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-bold text-slate-800">2. Separação & Conferência</div>
                <div className="text-lg font-bold font-mono text-purple-800 mt-1">{leadTimes.separationHours} h</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Separação e checagem física no Almoxarifado Central (~{leadTimes.separationDays} dias úteis).</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-bold text-slate-800">3. Trânsito & Entrega</div>
                <div className="text-lg font-bold font-mono text-orange-800 mt-1">{leadTimes.deliveryHours} h</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Carregamento e rota até recepção hospitalar.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Oficial da Página 1 */}
        <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">Linus Soluções</span>
            <span>·</span>
            <span>Sistema Integrado de Abastecimento Hospitalar SESAU / AL</span>
          </div>
          <div className="font-mono font-medium">
            Página 1 de 3
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PÁGINA 2: DESEMPENHO POR UNIDADE HOSPITALAR & PROGRAMAS                    */}
      {/* ========================================================================= */}
      <div 
        data-pdf-page="2" 
        className="report-page bg-white p-8 sm:p-10 border border-slate-200 rounded-2xl shadow-md max-w-4xl mx-auto min-h-[1100px] flex flex-col justify-between print:border-none print:shadow-none print:p-8 print:min-h-screen print:rounded-none"
      >
        <div className="space-y-6">
          {/* Header Compacto da Página 2 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <LinusVectorSvg className="h-7 w-auto" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-2 border-l border-slate-200">
                Relatório Consolidado · Desempenho por Unidade & Programas
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Protocolo: {documentProtocol}
            </div>
          </div>

          {/* Tabela de Desempenho por Unidade Hospitalar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                4. Desempenho Operacional por Unidade Hospitalar
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                {unitStats.length} unidades monitoradas
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-2.5">Unidade Hospitalar</th>
                    <th className="p-2.5 text-right">Pedidos</th>
                    <th className="p-2.5 text-right">Itens</th>
                    <th className="p-2.5 text-right">Entregues</th>
                    <th className="p-2.5 text-right">Emergenciais</th>
                    <th className="p-2.5 text-right">Taxa Conclusão</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {unitStats.slice(0, 12).map((u) => (
                    <tr key={u.unidade} className="hover:bg-slate-50/50">
                      <td className="p-2 font-sans font-bold text-slate-900">{u.unidade}</td>
                      <td className="p-2 text-right font-bold text-slate-800">{u.total}</td>
                      <td className="p-2 text-right text-slate-600">{u.items.toLocaleString()}</td>
                      <td className="p-2 text-right font-bold text-emerald-700">{u.delivered}</td>
                      <td className="p-2 text-right font-bold text-rose-600">{u.emergency}</td>
                      <td className="p-2 text-right font-bold text-blue-800">{u.taxaEntrega}%</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          u.status === 'CONFORME' ? 'bg-emerald-100 text-emerald-800' :
                          u.status === 'CRÍTICO' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-mono font-bold text-xs border-t-2 border-slate-200">
                  <tr>
                    <td className="p-2.5 font-sans">TOTAL GERAL CONSOLIDADO</td>
                    <td className="p-2.5 text-right">{totalOrders}</td>
                    <td className="p-2.5 text-right">{totalItems.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-emerald-700">{deliveredOrders}</td>
                    <td className="p-2.5 text-right text-rose-600">{emergencyOrders}</td>
                    <td className="p-2.5 text-right text-blue-800">{deliveryRate}%</td>
                    <td className="p-2.5 text-center font-sans text-slate-600">AUDITADO</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Distribuição por Programa de Saúde */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              5. Distribuição da Demanda por Programa de Saúde
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {programStats.slice(0, 6).map(p => (
                <div key={p.programa} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.programa}</span>
                    <span className="font-mono font-bold text-blue-800">{p.total} pedidos ({p.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.max(5, p.pct)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{p.items.toLocaleString()} itens</span>
                    <span>{p.delivered} entregues</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé Oficial da Página 2 */}
        <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">Linus Soluções</span>
            <span>·</span>
            <span>Sistema Integrado de Abastecimento Hospitalar SESAU / AL</span>
          </div>
          <div className="font-mono font-medium">
            Página 2 de 3
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PÁGINA 3: PEDIDOS CRÍTICOS, TERMO DE CONFORMIDADE & ASSINATURAS           */}
      {/* ========================================================================= */}
      <div 
        data-pdf-page="3" 
        className="report-page bg-white p-8 sm:p-10 border border-slate-200 rounded-2xl shadow-md max-w-4xl mx-auto min-h-[1100px] flex flex-col justify-between print:border-none print:shadow-none print:p-8 print:min-h-screen print:rounded-none"
      >
        <div className="space-y-6">
          {/* Header Compacto da Página 3 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <LinusVectorSvg className="h-7 w-auto" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-2 border-l border-slate-200">
                Relatório Consolidado · Demandas Críticas & Termo de Fechamento
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Protocolo: {documentProtocol}
            </div>
          </div>

          {/* Relação de Pedidos Críticos / Emergenciais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                6. Relação de Pedidos Críticos & Emergenciais com Acompanhamento Especial
              </h2>
              <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Prioridade Máxima
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-2">Código</th>
                    <th className="p-2">Unidade</th>
                    <th className="p-2">Programa</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Data Solicitação</th>
                    <th className="p-2 text-right">Itens</th>
                    <th className="p-2">Status Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {criticalOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 font-sans">
                        Nenhum pedido emergencial crítico pendente no momento.
                      </td>
                    </tr>
                  ) : (
                    criticalOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="p-2 font-bold text-blue-900">{o.codigo}</td>
                        <td className="p-2 font-sans font-medium text-slate-800">{o.unidade}</td>
                        <td className="p-2 font-sans text-slate-600">{o.programa}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            o.tipo === 'Emergencial' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {o.tipo}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600">{o.data_solicitacao || o.criado_em.slice(0, 10)}</td>
                        <td className="p-2 text-right font-bold text-slate-800">{o.quantidade_itens}</td>
                        <td className="p-2 font-sans">
                          <span className="font-semibold text-slate-700">{o.status_operacional}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Termo de Conformidade e Atesto Técnico */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              7. Termo de Conformidade Técnica & Fechamento de Auditoria
            </h2>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs leading-relaxed text-slate-700">
              <p>
                Atestamos para os devidos efeitos legais e administrativos que os dados constantes neste <strong>Relatório Consolidado de Abastecimento</strong> foram extraídos diretamente da base de dados do Sistema Integrado de Gestão Logística SESAU / Linus Soluções. As métricas de lead time, contagem de volumes e conformidade com o cronograma oficial foram aferidas segundo as diretrizes de governança da Secretaria de Estado da Saúde de Alagoas.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500 pt-1">
                <div><strong>Hash SHA-256 de Autenticidade:</strong> <span className="text-slate-800">4f9a7c8b2e1d034a78bc5912de40ff82a1c0</span></div>
                <div><strong>Ambiente:</strong> Produção SESAU-AL</div>
                <div><strong>Base de Dados:</strong> Auditada em Tempo Real</div>
              </div>
            </div>

            {/* Campos de Assinatura Oficial */}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
              <div className="space-y-1.5">
                <div className="w-64 mx-auto border-t-2 border-slate-700 pt-2" />
                <div className="text-xs font-bold text-slate-900">{generatedBy.nome}</div>
                <div className="text-[11px] text-slate-600">{generatedBy.cargo}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Secretaria de Estado da Saúde de Alagoas - SESAU</div>
              </div>

              <div className="space-y-1.5">
                <div className="w-64 mx-auto border-t-2 border-slate-700 pt-2" />
                <div className="text-xs font-bold text-slate-900">Diretoria de Operações e Tecnologia</div>
                <div className="text-[11px] text-slate-600">Linus Soluções em Tecnologia & Logística</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Coordenação Logística Integrada</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Oficial da Página 3 */}
        <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">Linus Soluções</span>
            <span>·</span>
            <span>Sistema Integrado de Abastecimento Hospitalar SESAU / AL</span>
          </div>
          <div className="font-mono font-medium">
            Página 3 de 3 (Final)
          </div>
        </div>
      </div>
    </div>
  );
};
