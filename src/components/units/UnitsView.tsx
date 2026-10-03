import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { HospitalUnit } from '../../types';
import { 
  Building2, 
  Plus, 
  Search, 
  X, 
  Edit2, 
  Trash2,
  AlertTriangle,
  CheckCircle2, 
  MapPin, 
  Activity,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Check,
  Package
} from 'lucide-react';

export const UnitsView: React.FC = () => {
  const { units, orders, addUnit, updateUnit, deleteUnit, currentUser } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HospitalUnit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<HospitalUnit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [sigla, setSigla] = useState('');
  const [nome, setNome] = useState('');
  const [municipio, setMunicipio] = useState('Maceió');
  const [tipo, setTipo] = useState<HospitalUnit['tipo']>('Hospital');
  const [descricao, setDescricao] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [updateAssociatedOrders, setUpdateAssociatedOrders] = useState(true);

  // Quick inline edit state for unit name
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditName, setQuickEditName] = useState('');

  const filteredUnits = units.filter(u => {
    if (filterType !== 'ALL' && u.tipo !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return u.sigla.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q) || u.municipio.toLowerCase().includes(q);
    }
    return true;
  });

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { type, title, message }
    }));
  };

  const handleOpenNew = () => {
    setEditingUnit(null);
    setSigla('');
    setNome('');
    setMunicipio('Maceió');
    setTipo('Hospital');
    setDescricao('');
    setAtiva(true);
    setUpdateAssociatedOrders(true);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (unit: HospitalUnit) => {
    setEditingUnit(unit);
    setSigla(unit.sigla);
    setNome(unit.nome);
    setMunicipio(unit.municipio);
    setTipo(unit.tipo);
    setDescricao(unit.descricao || '');
    setAtiva(unit.ativa);
    setUpdateAssociatedOrders(true);
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (unit: HospitalUnit) => {
    setUnitToDelete(unit);
  };

  const handleStartQuickEdit = (unit: HospitalUnit) => {
    setQuickEditId(unit.id);
    setQuickEditName(unit.nome);
  };

  const handleSaveQuickEdit = (unit: HospitalUnit) => {
    if (!quickEditName.trim()) {
      showToast('error', 'Nome obrigatório', 'O nome da unidade não pode ficar vazio.');
      return;
    }
    updateUnit(unit.id, { nome: quickEditName.trim() }, false);
    setQuickEditId(null);
    showToast('success', 'Nome Atualizado', `O nome da unidade ${unit.sigla} foi atualizado para "${quickEditName.trim()}".`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !sigla.trim()) {
      showToast('error', 'Campos obrigatórios', 'Por favor preencha a sigla e o nome oficial da unidade.');
      return;
    }

    if (editingUnit) {
      updateUnit(editingUnit.id, {
        sigla: sigla.toUpperCase().trim(),
        nome: nome.trim(),
        municipio: municipio.trim(),
        tipo,
        descricao: descricao.trim(),
        ativa,
      }, updateAssociatedOrders);

      showToast('success', 'Unidade Atualizada', `O cadastro da unidade ${sigla.toUpperCase().trim()} foi atualizado no sistema.`);
    } else {
      addUnit({
        sigla: sigla.toUpperCase().trim(),
        nome: nome.trim(),
        municipio: municipio.trim(),
        tipo,
        descricao: descricao.trim(),
        ativa,
      });

      showToast('success', 'Unidade Cadastrada', `A unidade ${sigla.toUpperCase().trim()} foi adicionada com sucesso.`);
    }
    setIsEditModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    setIsDeleting(true);

    try {
      const deletedSigla = unitToDelete.sigla;
      const success = deleteUnit(unitToDelete.id);
      if (success) {
        showToast('success', 'Unidade Excluída', `A unidade ${deletedSigla} foi removida com sucesso do sistema e do banco de dados.`);
      } else {
        showToast('error', 'Erro', 'Não foi possível encontrar a unidade para exclusão.');
      }
      setUnitToDelete(null);
      if (isEditModalOpen) {
        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      showToast('error', 'Falha ao excluir', err.message || 'Erro durante a exclusão da unidade.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Unidades Hospitalares & Solicitantes
              </h2>
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                {units.length} unidades cadastradas
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Gestão de cadastros mestre, edição de nomes, siglas e exclusão de unidades hospitalares
            </p>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs text-xs">
            <button
              onClick={() => setViewLayout('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewLayout === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
              title="Visualizar em cartões"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Grade</span>
            </button>
            <button
              onClick={() => setViewLayout('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewLayout === 'table'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
              title="Visualizar em tabela completa"
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Tabela</span>
            </button>
          </div>

          <button
            onClick={handleOpenNew}
            disabled={currentUser.role === 'VIEWER'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Cadastrar Nova Unidade</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por Sigla (ex: HGE, HMA), Nome do Hospital ou Município..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition-all cursor-pointer shadow-2xs truncate"
            title="Filtrar por Tipo de Unidade"
          >
            <option value="ALL">Todos os Tipos ({units.length})</option>
            <option value="Hospital">Hospital</option>
            <option value="UPA">UPA</option>
            <option value="Maternidade">Maternidade</option>
            <option value="Hemocentro">Hemocentro</option>
            <option value="Laboratório">Laboratório</option>
            <option value="Ambulatório">Ambulatório</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
      </div>

      {/* VIEW 1: GRID VIEW (CARDS) */}
      {viewLayout === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => {
            const sig = (unit.sigla || '').toUpperCase();
            const nom = (unit.nome || '').toUpperCase();
            const unitOrdersCount = orders.filter(o => {
              if (!o.unidade) return false;
              const u = o.unidade.toUpperCase();
              return u === sig || u === nom || u.includes(sig) || nom.includes(u);
            }).length;
            const isEditingThisName = quickEditId === unit.id;

            return (
              <div
                key={unit.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Sigla, Tipo, Status Ativa */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {unit.sigla}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {unit.tipo}
                      </span>
                    </div>

                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                      unit.ativa ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-500 bg-slate-100 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${unit.ativa ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {unit.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {/* Unit Name Section with Quick Inline Edit or Direct Edit Click */}
                  <div className="min-h-[48px]">
                    {isEditingThisName ? (
                      <div className="flex items-center gap-1.5 mb-1 animate-in fade-in">
                        <input
                          type="text"
                          value={quickEditName}
                          onChange={(e) => setQuickEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveQuickEdit(unit);
                            if (e.key === 'Escape') setQuickEditId(null);
                          }}
                          autoFocus
                          className="w-full text-xs font-bold px-2 py-1 bg-blue-50/70 border border-blue-400 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleSaveQuickEdit(unit)}
                          className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs"
                          title="Salvar nome"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setQuickEditId(null)}
                          className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 shrink-0"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 
                          onClick={() => currentUser.role !== 'VIEWER' && handleStartQuickEdit(unit)}
                          className={`text-sm font-bold text-slate-900 leading-snug line-clamp-2 ${currentUser.role !== 'VIEWER' ? 'cursor-pointer hover:text-blue-700 transition-colors' : ''}`}
                          title="Clique para editar o nome da unidade rapidamente"
                        >
                          {unit.nome}
                        </h3>
                        {currentUser.role !== 'VIEWER' && (
                          <button
                            onClick={() => handleStartQuickEdit(unit)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            title="Editar nome da unidade"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{unit.municipio} — AL</span>
                  </div>

                  {unit.descricao && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                      "{unit.descricao}"
                    </p>
                  )}
                </div>

                {/* Card Footer: Pedidos Vinculados & Action Buttons (Editar Nome / Excluir) */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span><strong className="text-slate-900 font-bold">{unitOrdersCount}</strong> {unitOrdersCount === 1 ? 'pedido' : 'pedidos'}</span>
                  </div>

                  {currentUser.role !== 'VIEWER' && (
                    <div className="flex items-center gap-1.5">
                      {/* Botão Editar Nome / Dados */}
                      <button
                        onClick={() => handleOpenEdit(unit)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Editar nome e configurações desta unidade"
                      >
                        <Edit2 className="w-3 h-3 text-blue-600" />
                        <span>Editar</span>
                      </button>

                      {/* Botão Excluir */}
                      <button
                        onClick={() => handleOpenDelete(unit)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Excluir esta unidade hospitalar"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: TABLE VIEW */}
      {viewLayout === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Sigla</th>
                  <th className="py-3 px-4">Nome Oficial da Unidade</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Município</th>
                  <th className="py-3 px-4 text-center">Pedidos</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUnits.map((unit) => {
                  const sig = (unit.sigla || '').toUpperCase();
                  const nom = (unit.nome || '').toUpperCase();
                  const unitOrdersCount = orders.filter(o => {
                    if (!o.unidade) return false;
                    const u = o.unidade.toUpperCase();
                    return u === sig || u === nom || u.includes(sig) || nom.includes(u);
                  }).length;
                  const isEditingThisName = quickEditId === unit.id;

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {unit.sigla}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isEditingThisName ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in max-w-md">
                            <input
                              type="text"
                              value={quickEditName}
                              onChange={(e) => setQuickEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveQuickEdit(unit);
                                if (e.key === 'Escape') setQuickEditId(null);
                              }}
                              autoFocus
                              className="w-full text-xs font-bold px-2 py-1 bg-blue-50/80 border border-blue-400 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleSaveQuickEdit(unit)}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs"
                              title="Salvar nome"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setQuickEditId(null)}
                              className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 shrink-0"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/name">
                            <span className="font-bold text-slate-900">{unit.nome}</span>
                            {currentUser.role !== 'VIEWER' && (
                              <button
                                onClick={() => handleStartQuickEdit(unit)}
                                className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover/name:opacity-100"
                                title="Editar nome rapidamente"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {unit.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {unit.municipio}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {unitOrdersCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          unit.ativa ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${unit.ativa ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {unit.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {currentUser.role !== 'VIEWER' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(unit)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Editar nome e configurações desta unidade"
                            >
                              <Edit2 className="w-3 h-3 text-blue-600" />
                              <span>Editar Nome</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(unit)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Excluir esta unidade hospitalar"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredUnits.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">Nenhuma unidade encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou o filtro de tipos de unidade.</p>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT UNIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingUnit ? 'Editar Nome & Cadastro da Unidade' : 'Cadastrar Nova Unidade'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingUnit ? 'Altere o nome oficial, sigla ou município com atualização imediata no banco' : 'Adicione uma nova unidade à rede SESAU'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Campo Nome da Unidade (Destaque Principal) */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Nome Oficial da Unidade Hospitalar *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Hospital Geral do Estado Dr. Osvaldo Brandão Vilela"
                  className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-slate-900 shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Nome descritivo exibido nos relatórios, dashboards, cabeçalhos e consultas.
                </span>
              </div>

              {/* Sigla e Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Sigla da Unidade *</label>
                  <input
                    type="text"
                    required
                    value={sigla}
                    onChange={(e) => setSigla(e.target.value)}
                    placeholder="Ex: HGE"
                    className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl uppercase text-slate-900 shadow-2xs focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Tipo de Unidade *</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as HospitalUnit['tipo'])}
                    className="w-full text-xs px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl font-bold text-slate-900 shadow-2xs"
                  >
                    <option value="Hospital">Hospital</option>
                    <option value="UPA">UPA</option>
                    <option value="Maternidade">Maternidade</option>
                    <option value="Hemocentro">Hemocentro</option>
                    <option value="Laboratório">Laboratório</option>
                    <option value="Ambulatório">Ambulatório</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Município */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Município em Alagoas *</label>
                <input
                  type="text"
                  required
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Ex: Maceió, Arapiraca, União dos Palmares, Penedo..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl font-medium text-slate-900 shadow-2xs"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Descrição / Detalhes Operacionais</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl resize-none text-slate-900 shadow-2xs"
                  placeholder="Capacidade de leitos, especialidades, ponto focal de recebimento..."
                />
              </div>

              {/* Checkboxes de Controle */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ativa}
                    onChange={(e) => setAtiva(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-800 font-medium">
                    Unidade ativa para novas solicitações e cronogramas
                  </span>
                </label>

                {editingUnit && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateAssociatedOrders}
                      onChange={(e) => setUpdateAssociatedOrders(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-slate-800 font-medium">
                      Atualizar automaticamente a sigla nos pedidos já existentes vinculados a esta unidade
                    </span>
                  </label>
                )}
              </div>

              {/* Modal Footer com Botão de Excluir + Salvar */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                {editingUnit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      handleOpenDelete(editingUnit);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Excluir Unidade</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer active:scale-95"
                  >
                    {editingUnit ? 'Salvar Alterações' : 'Cadastrar Unidade'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DE UNIDADE */}
      {unitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-900">
                Excluir Unidade Hospitalar?
              </h3>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Você tem certeza que deseja excluir o cadastro da unidade{' '}
                <strong className="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {unitToDelete.sigla}
                </strong>{' '}
                — <span className="font-semibold text-slate-800">{unitToDelete.nome}</span>?
              </p>

              {/* Informação sobre pedidos vinculados */}
              {(() => {
                const sig = (unitToDelete.sigla || '').toUpperCase();
                const nom = (unitToDelete.nome || '').toUpperCase();
                const linkedCount = orders.filter(o => {
                  if (!o.unidade) return false;
                  const u = o.unidade.toUpperCase();
                  return u === sig || u === nom || u.includes(sig) || nom.includes(u);
                }).length;
                if (linkedCount > 0) {
                  return (
                    <div className="mt-3.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-900">
                        <span className="font-bold block">Atenção: Unidade com pedidos associados</span>
                        Esta unidade possui <strong className="font-mono">{linkedCount}</strong> {linkedCount === 1 ? 'pedido vinculado' : 'pedidos vinculados'} no sistema. A exclusão removerá o registro mestre da unidade do cadastro.
                      </div>
                    </div>
                  );
                }
                return (
                  <p className="text-[11px] text-slate-400 mt-3">
                    Esta unidade não possui pedidos vinculados atualmente. A exclusão é segura.
                  </p>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUnitToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Unidade'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
