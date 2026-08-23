import type { CSSProperties, JSX } from 'react';
import { Icon } from './Icon';

interface HealthScoreProps {
  score: number;
  compact?: boolean;
}

export function HealthScore({ score, compact = false }: HealthScoreProps): JSX.Element {
  const tone = score >= 85 ? 'good' : score >= 60 ? 'caution' : 'poor';
  return (
    <div className={`health-score health-score--${tone} ${compact ? 'health-score--compact' : ''}`} aria-label={`Data health score ${score} out of 100`}>
      <div className="health-score__ring" style={{ '--score': `${score}%` } as CSSProperties}><span>{score}</span></div>
      {!compact ? <div><p className="eyebrow">Data health</p><strong>{score >= 85 ? 'Looking healthy' : score >= 60 ? 'Needs attention' : 'Needs review'}</strong><span><Icon name={score >= 85 ? 'check' : 'warning'} size={15} /> Score out of 100</span></div> : null}
    </div>
  );
}
