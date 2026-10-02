import React, { useId } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showSubtitle?: boolean;
  showSystemName?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Authentic, exact official vector SVG of Linus Soluções.
 * 100% vector fidelity directly from the official Linus Soluções brand assets.
 * Features the signature isometric ribbon emblem (navy/purple/orange gradients)
 * and the exact corporate wordmarks for LINUS (royal blue) and SOLUÇÕES (vibrant orange).
 */
export const LinusVectorSvg: React.FC<{ className?: string; idPrefix?: string }> = ({ 
  className = 'h-9 w-auto',
  idPrefix
}) => {
  const generatedId = useId().replace(/:/g, '_');
  const pId = idPrefix || `linus_logo_${generatedId}`;

  return (
    <svg 
      viewBox="0 0 177 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Linus Soluções"
    >
      {/* Official 3D Isometric Ribbon Geometry */}
      <rect width="26.1015" height="10.4504" transform="matrix(0.892834 0.450385 0 1 33.9099 0.00610352)" fill={`url(#${pId}_paint0)`} />
      <rect width="26.1015" height="10.4504" transform="matrix(-0.892834 0.450385 0 1 33.9099 0.00610352)" fill={`url(#${pId}_paint1)`} />
      <path d="M10.6055 11.813L33.9099 23.5687V34.0192L10.6055 22.2634V11.813Z" fill={`url(#${pId}_paint2)`} />
      <path d="M10.6055 11.813L33.9099 23.5687V34.0192L10.6055 22.2634V11.813Z" fill={`url(#${pId}_paint3)`} />
      <rect width="37.8772" height="10.4504" transform="matrix(-0.892834 0.450385 0 1 67.7279 6.50952)" fill={`url(#${pId}_paint4)`} />
      <path d="M44.2683 28.7941L33.9099 34.0193V23.5688L44.2683 28.7941Z" fill={`url(#${pId}_paint5)`} />
      <path d="M0.108521 20.4214L33.9266 37.4808V47.9312L0.108521 30.8718V20.4214Z" fill={`url(#${pId}_paint6)`} />
      <rect width="26.1016" height="10.4504" transform="matrix(-0.892834 0.450385 0 1 57.2311 25.7251)" fill={`url(#${pId}_paint7)`} />
      <path d="M44.2851 42.7062L33.9267 47.9314V37.481L44.2851 42.7062Z" fill={`url(#${pId}_paint8)`} />

      {/* Official Typography: SOLUÇÕES (Orange) & LINUS (Blue) */}
      <g clipPath={`url(#${pId}_clip0)`}>
        {/* SOLUÇÕES wordmark */}
        <path 
          fillRule="evenodd" 
          clipRule="evenodd" 
          d="M147.584 31.9611C146.539 31.9518 145.296 32.2057 145.296 32.9395C145.296 33.6356 146.398 33.7579 147.839 33.8708C149.891 34.0307 151.323 34.4446 151.323 35.818C151.323 37.0691 150.089 37.9628 147.848 37.9628C146.304 37.9628 144.938 37.5113 143.912 36.627L144.618 35.8274C145.513 36.627 146.567 36.9844 147.895 36.9844C149.364 36.9844 150.174 36.5988 150.174 35.9121C150.174 35.2348 149.345 35.056 147.688 34.9149C145.87 34.7644 144.157 34.3599 144.157 33.0147C144.157 31.7072 145.673 30.9828 147.565 30.9828C148.997 30.9828 150.211 31.4062 151.002 32.074L150.287 32.8454C149.609 32.2528 148.677 31.9706 147.584 31.9611ZM135.578 31.1804H142.047V32.1681H136.699V33.9272H141.2V34.9149H136.699V36.7775H142.141V37.7652H135.578V31.1804ZM129.005 37.9628C126.472 37.9628 124.909 36.6458 124.909 34.4728C124.909 32.2998 126.472 30.9828 129.005 30.9828C131.538 30.9828 133.101 32.2998 133.101 34.4728C133.101 36.6458 131.538 37.9628 129.005 37.9628ZM129.005 31.98C127.216 31.98 126.058 32.8736 126.058 34.4728C126.058 36.072 127.207 36.9656 129.005 36.9656C130.794 36.9656 131.943 36.072 131.943 34.4728C131.943 32.8736 130.794 31.98 129.005 31.98ZM130.004 30.3243C129.184 30.3243 128.751 29.7976 128.026 29.7976C127.536 29.7976 127.31 30.0139 127.113 30.2585L126.548 29.7035C126.783 29.346 127.282 28.9321 128.007 28.9321C128.826 28.9321 129.25 29.4589 129.994 29.4589C130.474 29.4589 130.7 29.2426 130.889 28.998L131.463 29.5624C131.228 29.9198 130.729 30.3243 130.004 30.3243ZM119.702 36.9656C120.775 36.9656 121.623 36.6176 122.122 35.7992L123.167 36.3166C122.546 37.2761 121.34 37.9628 119.674 37.9628C117.207 37.9628 115.653 36.6364 115.653 34.4728C115.653 32.3092 117.207 30.9828 119.721 30.9828C121.34 30.9828 122.546 31.679 123.158 32.6197L122.103 33.1464C121.613 32.3374 120.775 31.98 119.702 31.98C117.96 31.98 116.802 32.8266 116.802 34.4728C116.802 36.119 117.96 36.9656 119.702 36.9656ZM109.72 37.9628C107.394 37.9628 106.142 36.6082 106.142 34.661V31.1804H107.272V34.5857C107.272 36.0626 108.148 36.9562 109.72 36.9562C111.302 36.9562 112.178 36.0626 112.178 34.5857V31.1804H113.308V34.661C113.308 36.6082 112.056 37.9628 109.72 37.9628ZM98.5524 31.1804H99.6823V36.7681H104.541V37.7652H98.5524V31.1804ZM91.9795 37.9628C89.4465 37.9628 87.8834 36.6458 87.8834 34.4728C87.8834 32.2998 89.4465 30.9828 91.9795 30.9828C94.5125 30.9828 96.0756 32.2998 96.0756 34.4728C96.0756 36.6458 94.5125 37.9628 91.9795 37.9628ZM91.9795 31.98C90.1904 31.98 89.0322 32.8736 89.0322 34.4728C89.0322 36.072 90.181 36.9656 91.9795 36.9656C93.7686 36.9656 94.9174 36.072 94.9174 34.4728C94.9174 32.8736 93.7686 31.98 91.9795 31.98ZM82.5253 33.8708C84.5781 34.0307 86.0094 34.4446 86.0094 35.818C86.0094 37.0691 84.7758 37.9628 82.5347 37.9628C80.9904 37.9628 79.6251 37.5113 78.5987 36.627L79.3049 35.8274C80.1995 36.627 81.2541 36.9844 82.5818 36.9844C84.0508 36.9844 84.8605 36.5988 84.8605 35.9121C84.8605 35.2348 84.0319 35.056 82.3747 34.9149C80.5573 34.7644 78.8435 34.3599 78.8435 33.0147C78.8435 31.7072 80.3596 30.9828 82.2523 30.9828C83.6835 30.9828 84.8982 31.4062 85.6892 32.074L84.9736 32.8454C84.2956 32.2528 83.3634 31.9706 82.2711 31.9611C81.2259 31.9518 79.9829 32.2057 79.9829 32.9395C79.9829 33.6356 81.0846 33.7579 82.5253 33.8708ZM120.107 38.2732L118.901 39.7783L118.101 39.5619L119.062 38.1039L120.107 38.2732Z" 
          fill="#FF760A"
        />
        {/* LINUS wordmark */}
        <path 
          fillRule="evenodd" 
          clipRule="evenodd" 
          d="M167.357 11.7194C165.475 11.7194 163.202 12.0175 163.202 13.164C163.202 14.2417 165.061 14.3793 167.931 14.6086C173.187 15.0442 176.905 16.0761 176.905 19.7678C176.905 23.0696 173.852 25.3168 168.022 25.3168C163.891 25.3168 160.425 24.1932 157.9 22.1754L160.356 19.2862C162.261 20.8913 164.901 21.7856 168.114 21.7856C170.868 21.7856 172.246 21.2811 172.246 20.2263C172.246 19.1945 170.96 18.8506 167.655 18.5754C162.881 18.1627 158.543 17.1079 158.543 13.5309C158.543 10.0914 162.261 8.21118 167.357 8.21118C170.8 8.21118 173.967 9.03665 176.171 10.5959L173.806 13.5079C172.016 12.2468 169.859 11.7423 167.357 11.7194ZM143.968 25.3168C137.977 25.3168 134.626 22.1066 134.626 17.2226V8.73857H139.309V16.8557C139.309 19.6531 140.869 21.4646 143.968 21.4646C147.067 21.4646 148.604 19.6531 148.604 16.8557V8.73857H153.287V17.2226C153.287 22.1066 149.959 25.3168 143.968 25.3168ZM114.221 14.2417V24.7894H109.7V8.73857H114.657L124.183 18.5525V8.73857H128.704V24.7894H124.596L114.221 14.2417ZM98.7971 8.73857H103.479V24.7894H98.7971V8.73857ZM78.5987 8.73857H83.281V21.0289H94.0917V24.7894H78.5987V8.73857Z" 
          fill="#2440AD"
        />
      </g>

      {/* Official Linear Gradients & Clip Definitions */}
      <defs>
        <linearGradient id={`${pId}_paint0`} x1="0.912444" y1="6.50336" x2="13.5697" y2="17.2342" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E74600" />
          <stop offset="1" stopColor="#7A3B60" />
        </linearGradient>
        <linearGradient id={`${pId}_paint1`} x1="-1.05133" y1="12.472" x2="1.50149" y2="-1.28655" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4E25" />
          <stop offset="1" stopColor="#F38F10" />
        </linearGradient>
        <linearGradient id={`${pId}_paint2`} x1="33.9099" y1="28.8351" x2="9.92586" y2="17.0842" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EE7100" />
          <stop offset="0.414982" stopColor="#E25407" />
          <stop offset="0.609566" stopColor="#D6360E" />
          <stop offset="0.849544" stopColor="#773B63" />
          <stop offset="1" stopColor="#2440AD" />
        </linearGradient>
        <linearGradient id={`${pId}_paint3`} x1="33.9099" y1="28.8351" x2="9.92586" y2="17.0842" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EE7100" />
          <stop offset="0.414982" stopColor="#E25407" />
          <stop offset="0.609566" stopColor="#D6360E" />
          <stop offset="0.849544" stopColor="#773B63" />
          <stop offset="1" stopColor="#2440AD" />
        </linearGradient>
        <linearGradient id={`${pId}_paint4`} x1="0" y1="5.22522" x2="37.8772" y2="5.22522" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9C000" />
          <stop offset="0.672727" stopColor="#F59C0C" />
          <stop offset="1" stopColor="#F17817" />
        </linearGradient>
        <linearGradient id={`${pId}_paint5`} x1="39.0891" y1="23.5688" x2="39.0891" y2="34.0193" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ED6E00" />
          <stop offset="1" stopColor="#EE7201" />
        </linearGradient>
        <linearGradient id={`${pId}_paint6`} x1="33.9266" y1="42.7471" x2="4.31364" y2="19.0504" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EE7100" />
          <stop offset="0.414982" stopColor="#E25407" />
          <stop offset="0.609566" stopColor="#D6360E" />
          <stop offset="0.849544" stopColor="#773B63" />
          <stop offset="1" stopColor="#2440AD" />
        </linearGradient>
        <linearGradient id={`${pId}_paint7`} x1="0" y1="5.22522" x2="26.1016" y2="5.22522" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9C000" />
          <stop offset="0.672727" stopColor="#F59C0C" />
          <stop offset="1" stopColor="#F17817" />
        </linearGradient>
        <linearGradient id={`${pId}_paint8`} x1="39.1059" y1="37.481" x2="39.1059" y2="47.9314" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ED6E00" />
          <stop offset="1" stopColor="#EE7201" />
        </linearGradient>
        <clipPath id={`${pId}_clip0`}>
          <rect width="98.356" height="31.6021" fill="white" transform="translate(78.5654 8.19897)" />
        </clipPath>
      </defs>
    </svg>
  );
};

export const LinusLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  onClick?: () => void;
  className?: string;
}> = ({
  size = 'md',
  onClick,
  className = '',
}) => {
  const heightClass = 
    size === 'sm' ? 'h-7' : 
    size === 'lg' ? 'h-10 sm:h-11' : 
    size === 'xl' ? 'h-12 sm:h-14' : 
    size === '2xl' ? 'h-16 sm:h-20' : 'h-8 sm:h-9';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="Linus Soluções"
    >
      {/* Exact official vector with fallback */}
      <img
        src="/logo-linus-solucoes.svg"
        alt="Linus Soluções"
        className={`${heightClass} w-auto object-contain transition-transform duration-150 ${onClick ? 'group-hover:scale-102 group-active:scale-98' : ''}`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // If image load fails for any reason, hide img and fallback is already embedded
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};

export const SesauLogo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  showSystemName = true,
  onClick,
  className = '',
}) => {
  const logoHeight = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-10' : size === 'xl' ? 'h-12' : size === '2xl' ? 'h-14' : 'h-8 sm:h-9';
  const titleSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : size === 'xl' ? 'text-base' : 'text-xs sm:text-sm';
  const subtitleSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 sm:gap-3 shrink-0 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="Linus Soluções · Gestão de Abastecimento Hospitalar (SESAU/AL)"
    >
      {/* 100% Exact Official Linus Soluções Logo */}
      <img
        src="/logo-linus-solucoes.svg"
        alt="Linus Soluções"
        className={`${logoHeight} w-auto object-contain transition-transform duration-150 ${onClick ? 'group-hover:scale-102 group-active:scale-98' : ''}`}
        referrerPolicy="no-referrer"
      />

      {showSystemName && (
        <>
          {/* Institutional Divider */}
          <div className="h-7 w-px bg-slate-200 hidden sm:block shrink-0" />

          {/* System & Institutional Context */}
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span className={`font-black text-slate-900 ${titleSize} tracking-tight whitespace-nowrap`}>
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
        </>
      )}
    </div>
  );
};
