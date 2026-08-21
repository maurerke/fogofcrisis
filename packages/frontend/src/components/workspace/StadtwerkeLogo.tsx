/**
 * Fictional logo for "Stadtwerke Musterstadt" — adds realism to the game environment.
 * Styled as a typical German municipal utility corporate identity.
 */
export default function StadtwerkeLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 200 46"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Stadtwerke Musterstadt"
        role="img"
        className="w-full h-auto"
      >
        {/* Icon mark: stylized water drop */}
        <g transform="translate(0, 1)">
          <path
            d="M19 0 C19 0 4 11 4 21 C4 30.4 10.8 38 19 38 C27.2 38 34 30.4 34 21 C34 11 19 0 19 0Z"
            fill="#005fa3"
          />
          <path
            d="M7 24 Q11 19.5 15 24 Q19 28.5 23 24 Q27 19.5 31 24 L31 32 Q26 37.5 19 37.5 Q12 37.5 7 32 Z"
            fill="#3a9fd6"
          />
          <ellipse cx="13" cy="16" rx="2.5" ry="4" fill="white" opacity="0.2" transform="rotate(-15 13 16)" />
        </g>

        {/* Company name */}
        <text
          x="43"
          y="19"
          fontFamily="'Arial', 'Helvetica', sans-serif"
          fontSize="15"
          fontWeight="700"
          fill="#005fa3"
          letterSpacing="0.2"
        >
          Stadtwerke
        </text>
        <text
          x="43"
          y="31"
          fontFamily="'Arial', 'Helvetica', sans-serif"
          fontSize="9.5"
          fontWeight="400"
          fill="#3a9fd6"
          letterSpacing="2.4"
        >
          MUSTERSTADT
        </text>

        {/* Divider */}
        <line x1="43" y1="35.5" x2="198" y2="35.5" stroke="#bcd8ee" strokeWidth="0.8" />

        {/* Tagline */}
        <text
          x="43"
          y="43"
          fontFamily="'Arial', 'Helvetica', sans-serif"
          fontSize="7"
          fill="#8fb8d4"
          letterSpacing="0.6"
        >
          Energie · Wasser · Mobilität
        </text>
      </svg>
    </div>
  );
}
