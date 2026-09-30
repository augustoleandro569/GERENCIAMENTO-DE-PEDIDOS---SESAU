import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  onClick?: () => void;
  className?: string;
}

export const SesauLogo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  onClick,
  className = '',
}) => {
  const iconSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const titleSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const subtitleSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-xs' : 'text-[10px]';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 shrink-0 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="SESAU - Secretaria de Estado da Saúde de Alagoas | Gestão de Pedidos"
    >
      {/* High-Fidelity Vector Emblem */}
      <div
        className={`${iconSize} rounded-xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 border border-blue-500/30 flex items-center justify-center shadow-xs shrink-0 transition-transform duration-150 ${
          onClick ? 'group-hover:scale-105 group-active:scale-95' : ''
        }`}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-white"
        >
          {/* Medical Cross Geometry - Crisp Pixel Alignment */}
          <path
            d="M15 7C15 6.44772 15.4477 6 16 6H20C20.5523 6 21 6.44772 21 7V13H27C27.5523 13 28 13.4477 28 14V18C28 18.5523 27.5523 19 27 19H21V25C21 25.5523 20.5523 26 20 26H16C15.4477 26 15 25.5523 15 25V19H9C8.44772 19 8 18.5523 8 18V14C8 13.4477 8.44772 13 9 13H15V7Z"
            fill="white"
          />
          {/* Logistics Dynamic Arrow / Pulse Core */}
          <circle cx="18" cy="16" r="3.2" fill="#10B981" />
          <path
            d="M16.5 16L17.5 17.2L19.5 14.8"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Supply Flow Accent Arc */}
          <path
            d="M10 28C14.5 30.5 21.5 30.5 26 28"
            stroke="#60A5FA"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Official Typography Branding */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black text-slate-950 ${titleSize} tracking-tight whitespace-nowrap`}>
            Gestão de Pedidos
          </span>
          <span className="font-mono text-[9px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300/80 px-1.5 py-0.5 rounded leading-none shrink-0">
            SESAU / AL
          </span>
        </div>
        {showSubtitle && (
          <span className={`text-slate-500 font-semibold tracking-normal mt-0.5 whitespace-nowrap hidden xl:block ${subtitleSize}`}>
            Abastecimento & Logística Hospitalar
          </span>
        )}
      </div>
    </div>
  );
};
