interface VendorWatchLogoProps {
  size?: number;
  className?: string;
}

export function VendorWatchLogo({ size = 120, className = "" }: VendorWatchLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`vendor-watch-logo ${className}`}
      style={{ filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))" }}
    >
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>

      <rect width="120" height="120" rx="24" fill="url(#bgGradient)" />

      <g stroke="#10B981" strokeWidth="2" fill="none">
        <path
          d="M60 15 L95 30 L95 60 Q95 90 60 105 Q25 90 25 60 L25 30 Z"
          strokeLinejoin="round"
        />
        <circle cx="60" cy="15" r="5" fill="#10B981" />
        <circle cx="95" cy="30" r="5" fill="#10B981" />
        <circle cx="95" cy="60" r="5" fill="#10B981" />
        <circle cx="60" cy="105" r="5" fill="#10B981" />
        <circle cx="25" cy="60" r="5" fill="#10B981" />
        <circle cx="25" cy="30" r="5" fill="#10B981" />
      </g>

      <g stroke="#10B981" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <circle cx="60" cy="55" r="4" fill="#10B981" />
        <path d="M48 55 Q48 43 60 43 Q72 43 72 55" />
        <path d="M48 55 Q48 67 60 67 Q72 67 72 55" />
        <path d="M38 55 Q38 35 60 35 Q82 35 82 55" />
        <path d="M38 55 Q38 75 60 75 Q82 75 82 55" />
      </g>
    </svg>
  );
}

export default VendorWatchLogo;
