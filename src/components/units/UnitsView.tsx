import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { HospitalUnit } from '../../types';
import { 
  Building2, 
  Plus, 
  Search, 
  X, 
  Edit2, 
  CheckCircle2, 
  MapPin, 
  Activity,
  Filter
} from 'lucide-react';

export const UnitsView: React.FC = () => {
  const { units, orders, addUnit, updateUnit, currentUser } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HospitalUnit | null>(null);

  // Form State
  const [sigla, setSigla] = useState('');
  const [nome, setNome] = useState('');
  const [municipio, setMunicipio] = useState('Maceió');
  const [tipo, setTipo] = useState<HospitalUnit['tipo']>('Hospital');
  const [descricao, setDescricao] = useState('');
  const [ativa, setAtiva] = useState(true);

  const filteredUnits = units.filter(u => {
    if (filterType !== 'ALL' && u.tipo !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return u.sigla.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q) || u.municipio.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenNew = () => {
    setEditingUnit(null);
    setSigla('');
    setNome('');
    setMunicipio('Maceió');
    setTipo('Hospital');
    setDescricao('');
    setAtiva(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: HospitalUnit) => {
    setEditingUnit(unit);
    setSigla(unit.sigla);
    setNome(unit.nome);
    setMunicipio(unit.municipio);
    setTipo(unit.tipo);
    setDescricao(unit.descricao || '');
    setAtiva(unit.ativa);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      updateUnit(editingUnit.id, {
        sigla: sigla.toUpperCase().trim(),
        nome: nome.trim(),
        municipio: municipio.trim(),
        tipo,
        descricao: descricao.trim(),
        ativa,
      });
    } else {
      addUnit({
        sigla: sigla.toUpperCase().trim(),
        nome: nome.trim(),
        municipio: municipio.trim(),
        tipo,
        descricao: descricao.trim(),
        ativa,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Cadastro Mestre de Unidades Hospitalares
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-mono font-semibold text-slate-800">{units.length} unidades</span>
            <span>·</span>
            <span>Rede estadual SESAU Alagoas</span>
            <span>·</span>
            <span>Cadastro automático por importação ativado</span>
          </div>
        </div>

        <button
          onClick={handleOpenNew}
          disabled={currentUser.role === 'VIEWER'}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Unidade</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center gap-3 shadow-xs w-full">
        <div className="relative flex-1 w-full min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por Sigla (ex: HGE, HMA), Nome do Hospital ou Município..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition-all cursor-pointer shadow-2xs truncate"
            title="Filtrar por Tipo de Unidade"
          >
            <option value="ALL">Todos os Tipos de Unidade</option>
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

      {/* Units Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnits.map((unit) => {
          const unitOrdersCount = orders.filter(o => o.unidade.toUpperCase() === unit.sigla.toUpperCase()).length;
          return (
            <div
              key={unit.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {unit.sigla}
                    </span>
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {unit.tipo}
                    </span>
                  </div>

                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    unit.ativa ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${unit.ativa ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {unit.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[32px]">
                  {unit.nome}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{unit.municipio} - AL</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-600">
                  <strong>{unitOrdersCount}</strong> solicitações
                </span>

                {currentUser.role !== 'VIEWER' && (
                  <button
                    onClick={() => handleOpenEdit(unit)}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Editar Unidade"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT UNIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUnit ? 'Editar Unidade Hospitalar' : 'Cadastrar Nova Unidade'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Sigla da Unidade *</label>
                  <input
                    type="text"
                    required
                    value={sigla}
                    onChange={(e) => setSigla(e.target.value)}
                    placeholder="Ex: HGE"
                    className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Unidade *</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as HospitalUnit['tipo'])}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
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

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Hospital Geral do Estado Dr. Osvaldo Brandão Vilela"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Município *</label>
                <input
                  type="text"
                  required
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Ex: Maceió, Arapiraca, União dos Palmares..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Descrição / Observações</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg resize-none"
                  placeholder="Capacidade de leitos, especialidades atendidas..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="unit-active"
                  checked={ativa}
                  onChange={(e) => setAtiva(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="unit-active" className="text-xs text-slate-700 select-none">
                  Unidade ativa no recebimento de pedidos e solicitações
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Salvar Unidade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
