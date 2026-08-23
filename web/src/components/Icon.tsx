import type { JSX } from 'react';

type IconName = 'arrowLeft' | 'arrowRight' | 'check' | 'chevronDown' | 'columns' | 'download' | 'file' | 'filter' | 'grid' | 'health' | 'info' | 'plus' | 'search' | 'sliders' | 'spark' | 'table' | 'upload' | 'warning' | 'x';

interface IconProps {
  name: IconName;
  size?: number;
  title?: string;
}

const paths: Record<IconName, JSX.Element> = {
  arrowLeft: <path d="m14 18-6-6 6-6M8 12h12" />,
  arrowRight: <path d="m10 6 6 6-6 6m6-6H4" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  columns: <path d="M4 5h16M4 12h16M4 19h16M7 3v4m5-4v4m5-4v4M7 10v4m5-4v4m5-4v4M7 17v4m5-4v4m5-4v4" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />,
  file: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h5" />,
  filter: <path d="M4 5h16M7 12h10m-7 7h4" />,
  grid: <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" />,
  health: <path d="M4 13h3l2-7 4 12 2-5h5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  plus: <path d="M12 5v14m-7-7h14" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  sliders: <path d="M4 7h7m2 0h7M4 17h3m2 0h11M11 4v6m-4 4v6" />,
  spark: <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />,
  table: <path d="M4 5h16v14H4zM4 10h16M9 5v14" />,
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />,
  warning: <><path d="M10.3 4.7 2.9 18a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({ name, size = 18, title }: IconProps): JSX.Element {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
