import type { JSX } from 'react';
import type { ColumnProfile, Dataset, DatasetProfile, ViewName } from '../types';
import { displayType } from '../services/inference';
import { formatNumber } from '../services/statistics';
import { ColumnChart } from './Charts';
import { HealthScore } from './HealthScore';
import { Icon } from './Icon';

interface OverviewProps {
  dataset: Dataset;
  profile: DatasetProfile;
  onNavigate: (view: ViewName) => void;
  onSelectColumn: (column: string) => void;
}

const detail = (column: ColumnProfile): string => {
  if (column.type === 'number' && column.numberStatistics) return `Average ${formatNumber(column.numberStatistics.mean)}`;
  if (column.type === 'date' && column.dateRange) return `${column.dateRange.earliest} → ${column.dateRange.latest}`;
  if (column.type === 'boolean' && column.booleanCounts) return `${column.booleanCounts.trueCount} true`;
  return `${formatNumber(column.uniqueCount, 0)} unique values`;
};

export function Overview({ dataset, profile, onNavigate, onSelectColumn }: OverviewProps): JSX.Element {
  const highlights = profile.columns.filter((column) => !column.empty).slice(0, 4);
  const visualColumn = profile.columns.find((column) => column.type === 'category' || column.type === 'number' || column.type === 'date');
  return (
    <div className="view-stack">
      <section className="page-intro">
        <div><p className="eyebrow">Overview</p><h1>See what your data is telling you.</h1><p>{dataset.fileName} · {formatNumber(dataset.rows.length, 0)} rows · {formatNumber(dataset.columns.length, 0)} columns</p></div>
        <HealthScore score={profile.health.score} />
      </section>

      <section className="metric-grid" aria-label="Dataset summary">
        <article className="metric-card"><span className="metric-card__icon"><Icon name="table" /></span><b>{formatNumber(dataset.rows.length, 0)}</b><small>Rows</small></article>
        <article className="metric-card"><span className="metric-card__icon"><Icon name="columns" /></span><b>{formatNumber(dataset.columns.length, 0)}</b><small>Columns</small></article>
        <article className="metric-card"><span className="metric-card__icon"><Icon name="warning" /></span><b>{formatNumber(profile.health.duplicateCount, 0)}</b><small>Duplicate rows</small></article>
        <article className="metric-card"><span className="metric-card__icon"><Icon name="check" /></span><b>{formatNumber(profile.health.completeValuePercentage)}%</b><small>Values complete</small></article>
      </section>

      <section className="content-grid content-grid--wide">
        <article className="card quality-card"><div className="card__heading"><div><p className="eyebrow">Data quality</p><h2>What needs attention</h2></div><button className="text-button" type="button" onClick={() => onNavigate('health')}>Open report <Icon name="arrowRight" size={16} /></button></div>
          <ul className="issue-list">
            {profile.health.issues.length === 0 ? <li className="issue issue--info"><Icon name="check" /><div><strong>Everything looks complete</strong><span>No potential data-quality issues were detected.</span></div></li> : profile.health.issues.slice(0, 4).map((issue) => <li className={`issue issue--${issue.severity}`} key={issue.id}><Icon name={issue.severity === 'info' ? 'info' : issue.severity === 'error' ? 'warning' : 'warning'} /><div><strong>{issue.title}</strong><span>{issue.description}</span></div></li>)}
          </ul>
        </article>
        <article className="card"><div className="card__heading"><div><p className="eyebrow">Privacy</p><h2>Local by design</h2></div><Icon name="file" /></div><p className="card__copy">Your dataset is analysed in this browser. DataLens does not upload it or send it to a service.</p><div className="privacy-note"><Icon name="check" size={16} /> Your data stays on this device.</div></article>
      </section>

      <section className="card"><div className="card__heading"><div><p className="eyebrow">Column overview</p><h2>Know your fields</h2></div><button className="text-button" type="button" onClick={() => onNavigate('columns')}>View all <Icon name="arrowRight" size={16} /></button></div>
        <div className="column-grid">{highlights.map((column) => <button className="column-tile" type="button" key={column.name} onClick={() => onSelectColumn(column.name)}><span className={`type-dot type-dot--${column.type}`} /><div><strong>{column.name}</strong><small>{displayType(column.type)}</small></div><em>{detail(column)}</em></button>)}</div>
      </section>

      {visualColumn ? <section className="card chart-card"><div className="card__heading"><div><p className="eyebrow">Visualisation</p><h2>{visualColumn.name} distribution</h2></div><button className="text-button" type="button" onClick={() => onSelectColumn(visualColumn.name)}>Inspect <Icon name="arrowRight" size={16} /></button></div><ColumnChart profile={visualColumn} rows={dataset.rows} /></section> : null}
    </div>
  );
}
