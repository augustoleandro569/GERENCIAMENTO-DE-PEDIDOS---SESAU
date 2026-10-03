import React from 'react';

interface LinusLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LinusLogo: React.FC<LinusLogoProps> = ({ className = '', size = 'md' }) => {
  const iconDimensions = {
    sm: { width: 28, height: 28 },
    md: { width: 38, height: 38 },
    lg: { width: 48, height: 48 },
  }[size];

  const textSizes = {
    sm: { title: 'text-sm', sub: 'text-[7px]' },
    md: { title: 'text-lg', sub: 'text-[9px]' },
    lg: { title: 'text-2xl', sub: 'text-[11px]' },
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Isometric 3D Faceted Origami / Cube Icon */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        <g>
          {/* Top-left golden amber facet */}
          <path d="M 50 15 L 78 30 L 50 46 L 22 30 Z" fill="#F59E0B" />
          
          {/* Top-right vibrant orange facet */}
          <path d="M 50 15 L 78 30 L 78 40 L 50 25 Z" fill="#F97316" />

          {/* Lower left warm coral facet */}
          <path d="M 22 30 L 50 46 L 50 78 L 22 62 Z" fill="#EA580C" />

          {/* Lower right deep navy/blue facet */}
          <path d="M 50 46 L 78 30 L 78 62 L 50 78 Z" fill="#0F3562" />

          {/* Inner accent facet: vibrant royal blue */}
          <path d="M 50 46 L 68 36 L 68 56 L 50 66 Z" fill="#0284C7" />

          {/* Bottom wrap orange facet */}
          <path d="M 22 62 L 50 78 L 78 62 L 78 72 L 50 88 L 22 72 Z" fill="#C2410C" />
        </g>
      </svg>

      {/* Brand Typography: LINUS SOLUÇÕES */}
      <div className="flex flex-col leading-none">
        <span className={`font-black text-[#0284c7] tracking-tight ${textSizes.title} font-sans`}>
          LINUS
        </span>
        <span className={`font-extrabold text-[#ea580c] tracking-[0.22em] ${textSizes.sub} font-sans mt-0.5 uppercase`}>
          SOLUÇÕES
        </span>
      </div>
    </div>
  );
};
