import type { JSX } from 'react';
import type { ColumnProfile, DataRow } from '../types';
import { toDateTimestamp, toNumber } from '../services/inference';
import { formatNumber } from '../services/statistics';

interface ChartProps {
  profile: ColumnProfile;
  rows: DataRow[];
}

const empty = (message: string): JSX.Element => <div className="chart-empty">{message}</div>;

export function ColumnChart({ profile, rows }: ChartProps): JSX.Element {
  const values = rows.map((row) => row.values[profile.name] ?? '');
  if (profile.type === 'category' || profile.type === 'text' || profile.type === 'boolean') {
    const entries = profile.frequentValues.slice(0, 5);
    if (entries.length === 0) return empty('Not enough values to visualise this column.');
    const highest = entries[0].count;
    return <div className="bar-chart" role="img" aria-label={`${profile.name} value distribution`}>
      {entries.map((entry) => <div className="bar-chart__row" key={entry.value}><span title={entry.value}>{entry.value || 'Blank'}</span><div className="bar-chart__track"><i style={{ width: `${(entry.count / highest) * 100}%` }} /></div><b>{formatNumber(entry.count, 0)}</b></div>)}
    </div>;
  }
  if (profile.type === 'number') {
    const numbers = values.map(toNumber).filter((value): value is number => value !== undefined);
    if (numbers.length < 2) return empty('At least two numerical values are needed for a distribution.');
    const minimum = Math.min(...numbers);
    const maximum = Math.max(...numbers);
    const buckets = Array.from({ length: Math.min(8, Math.max(3, Math.ceil(Math.sqrt(numbers.length)))) }, () => 0);
    const span = maximum - minimum || 1;
    numbers.forEach((value) => { buckets[Math.min(buckets.length - 1, Math.floor(((value - minimum) / span) * buckets.length))] += 1; });
    const maxBucket = Math.max(...buckets);
    return <div className="histogram" role="img" aria-label={`${profile.name} numerical distribution from ${minimum} to ${maximum}`}>
      <div className="histogram__bars">{buckets.map((count, index) => <i key={index} style={{ height: `${Math.max(5, (count / maxBucket) * 100)}%` }} title={`${count} values`} />)}</div>
      <div className="chart-axis"><span>{formatNumber(minimum)}</span><span>{formatNumber(maximum)}</span></div>
    </div>;
  }
  if (profile.type === 'date') {
    const dates = values.map(toDateTimestamp).filter((value): value is number => value !== undefined);
    if (dates.length < 2) return empty('At least two dates are needed for a timeline.');
    const minimum = Math.min(...dates);
    const maximum = Math.max(...dates);
    const range = maximum - minimum || 1;
    return <div className="timeline-chart" role="img" aria-label={`${profile.name} timeline from ${new Date(minimum).toLocaleDateString()} to ${new Date(maximum).toLocaleDateString()}`}><div className="timeline-chart__line">{dates.slice(0, 80).map((date, index) => <i key={`${date}-${index}`} style={{ left: `${((date - minimum) / range) * 100}%` }} />)}</div><div className="chart-axis"><span>{new Date(minimum).toLocaleDateString()}</span><span>{new Date(maximum).toLocaleDateString()}</span></div></div>;
  }
  return empty('No suitable chart is available for this column.');
}
