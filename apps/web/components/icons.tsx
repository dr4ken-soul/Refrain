import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function ArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function External(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function Close(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function Clock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

export function Menu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 8h14M5 16h14" />
    </svg>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M10 10v9" />
    </svg>
  );
}

export function CallsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 6h14M5 12h10M5 18h7" />
    </svg>
  );
}

export function LedgerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function KolsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19a5 5 0 0 1 10 0" />
      <path d="M16 7a3 3 0 0 1 0 5M17 14a4 4 0 0 1 3 4" />
    </svg>
  );
}

export function WatchlistIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function RulesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v16M7 7h7a3 3 0 1 1 0 6H7M7 13h9" />
    </svg>
  );
}

export function Flag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </svg>
  );
}

export function BanknoteOff(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="m4 20 16-16" />
    </svg>
  );
}

export function Eye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function Key(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="m10.5 10.5 8 8M15 15l2-2M17.5 17.5l2-2" />
    </svg>
  );
}

export function Scale(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v16M7 20h10M4 8h16M4 8l-2 5h4L4 8ZM20 8l-2 5h4l-2-5Z" />
    </svg>
  );
}

export function Shield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
