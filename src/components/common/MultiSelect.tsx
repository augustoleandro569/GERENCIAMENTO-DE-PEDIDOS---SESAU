import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  subLabel?: string;
  count?: number;
  color?: string;
}

export interface MultiSelectProps {
  label?: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  className?: string;
  icon?: React.ReactNode;
  showSearch?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder,
  className = '',
  icon,
  showSearch = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isAllSelected = selected.length === 0;

  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter(item => item !== id);
      onChange(next);
    } else {
      onChange([...selected, id]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  });

  // Display trigger text
  const getTriggerText = () => {
    if (selected.length === 0) {
      return placeholder;
    }
    if (selected.length === 1) {
      const found = options.find(o => o.id === selected[0]);
      return found ? found.label : selected[0];
    }
    return `${selected.length} selecionados`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs select-none ${
          selected.length > 0
            ? 'bg-blue-50/80 border-blue-400 text-blue-950'
            : 'bg-slate-50 hover:bg-white border-slate-300 text-slate-800'
        } focus:outline-none focus:ring-2 focus:ring-blue-600/30`}
        title={placeholder}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
          <span className="truncate">{getTriggerText()}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono font-bold text-[10px] flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-64 max-w-[90vw] bg-white rounded-2xl border border-slate-300 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col">
          {/* Header Controls: Select All & Clear */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                isAllSelected ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({options.length})
            </button>

            {selected.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Limpar seleção</span>
              </button>
            )}
          </div>

          {/* Search box if enabled or many options */}
          {(showSearch || options.length > 6) && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Options List with Checkboxes */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer select-none transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-950 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {opt.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: opt.color }}
                        />
                      )}

                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="block text-[10px] text-slate-600 truncate">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {opt.count !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold shrink-0">
                        {opt.count}
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                Nenhuma opção encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
