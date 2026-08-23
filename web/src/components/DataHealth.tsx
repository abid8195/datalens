import type { JSX } from 'react';
import type { Dataset, DatasetProfile } from '../types';
import { formatNumber } from '../services/statistics';
import { HealthScore } from './HealthScore';
import { Icon } from './Icon';

interface DataHealthProps { dataset: Dataset; profile: DatasetProfile; onSelectColumn: (column: string) => void; }

export function DataHealth({ dataset, profile, onSelectColumn }: DataHealthProps): JSX.Element {
  const issueColumns = profile.columns.filter((column) => column.missingCount > 0 || column.invalidValueCount > 0 || column.empty);
  return <div className="view-stack"><section className="page-intro"><div><p className="eyebrow">Data health</p><h1>A clear, local quality check.</h1><p>The score is a transparent heuristic, not a guarantee of data correctness.</p></div><HealthScore score={profile.health.score} /></section>
    <section className="content-grid content-grid--wide"><article className="card"><div className="card__heading"><div><p className="eyebrow">Completeness</p><h2>{formatNumber(profile.health.completeValuePercentage)}% of values present</h2></div><Icon name="check" /></div><div className="completion-bar"><i style={{ width: `${profile.health.completeValuePercentage}%` }} /></div><p className="card__copy">Based on {formatNumber(dataset.rows.length * dataset.columns.length, 0)} cells across your dataset.</p></article><article className="card"><div className="card__heading"><div><p className="eyebrow">Duplicates</p><h2>{formatNumber(profile.health.duplicateCount, 0)} repeated rows</h2></div><Icon name="warning" /></div><p className="card__copy">{formatNumber(profile.health.duplicatePercentage)}% of rows share all source values with an earlier row.</p></article></section>
    <section className="card"><div className="card__heading"><div><p className="eyebrow">Potential issues</p><h2>Why the score changed</h2></div></div><div className="health-report">{profile.health.issues.length === 0 ? <div className="empty-inline"><Icon name="check" /><div><strong>No potential issues found</strong><span>DataLens did not identify missing values, duplicate rows, or structural warnings.</span></div></div> : profile.health.issues.map((issue) => <article className={`health-report__item health-report__item--${issue.severity}`} key={issue.id}><Icon name={issue.severity === 'info' ? 'info' : issue.severity === 'error' ? 'warning' : 'warning'} /><div><strong>{issue.title}</strong><p>{issue.description}</p>{issue.affectedColumn ? <button className="text-button" type="button" onClick={() => onSelectColumn(issue.affectedColumn ?? '')}>Inspect {issue.affectedColumn} <Icon name="arrowRight" size={15} /></button> : null}</div></article>)}</div></section>
    {issueColumns.length > 0 ? <section className="card"><p className="eyebrow">By column</p><h2>Fields to review</h2><div className="review-grid">{issueColumns.map((column) => <button type="button" onClick={() => onSelectColumn(column.name)} key={column.name}><strong>{column.name}</strong><span>{column.empty ? 'Empty column' : `${formatNumber(column.missingCount, 0)} missing · ${formatNumber(column.uniqueCount, 0)} unique`}</span></button>)}</div></section> : null}
  </div>;
}
