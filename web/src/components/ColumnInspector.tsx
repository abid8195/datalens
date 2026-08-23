import type { JSX } from 'react';
import type { ColumnProfile, Dataset, DatasetProfile } from '../types';
import { displayType } from '../services/inference';
import { formatNumber } from '../services/statistics';
import { ColumnChart } from './Charts';
import { Icon } from './Icon';

interface ColumnInspectorProps {
  dataset: Dataset;
  profile: DatasetProfile;
  selectedColumn: string;
  onSelectColumn: (column: string) => void;
}

const ProfileDetails = ({ column }: { column: ColumnProfile }): JSX.Element => {
  const detailRows: Array<[string, string]> = [
    ['Type', displayType(column.type)], ['Values', formatNumber(column.totalValues, 0)], ['Missing', formatNumber(column.missingCount, 0)], ['Unique', formatNumber(column.uniqueCount, 0)],
  ];
  if (column.numberStatistics) detailRows.push(['Minimum', formatNumber(column.numberStatistics.minimum)], ['Maximum', formatNumber(column.numberStatistics.maximum)], ['Average', formatNumber(column.numberStatistics.mean)], ['Median', formatNumber(column.numberStatistics.median)]);
  if (column.dateRange) detailRows.push(['Earliest', column.dateRange.earliest], ['Latest', column.dateRange.latest]);
  if (column.booleanCounts) detailRows.push(['True', formatNumber(column.booleanCounts.trueCount, 0)], ['False', formatNumber(column.booleanCounts.falseCount, 0)]);
  return <dl className="profile-details">{detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
};

export function ColumnInspector({ dataset, profile, selectedColumn, onSelectColumn }: ColumnInspectorProps): JSX.Element {
  const column = profile.columns.find((item) => item.name === selectedColumn) ?? profile.columns[0];
  return <div className="view-stack"><section className="page-intro page-intro--compact"><div><p className="eyebrow">Columns</p><h1>Understand every field.</h1><p>Inferred types and basic statistics are calculated locally.</p></div></section>
    <div className="columns-layout"><aside className="card column-list" aria-label="Columns">{profile.columns.map((item) => <button type="button" className={item.name === column.name ? 'is-selected' : ''} onClick={() => onSelectColumn(item.name)} key={item.name}><span className={`type-dot type-dot--${item.type}`} /><span><strong>{item.name}</strong><small>{displayType(item.type)} · {formatNumber(item.uniqueCount, 0)} unique</small></span><Icon name="arrowRight" size={15} /></button>)}</aside>
      <section className="card profile-card"><div className="card__heading"><div><p className="eyebrow">Column profile</p><h2>{column.name}</h2></div><span className={`type-pill type-pill--${column.type}`}>{displayType(column.type)}</span></div><ProfileDetails column={column} />
        {column.invalidValueCount > 0 ? <p className="inline-notice"><Icon name="warning" size={16} /> {column.invalidValueCount} values do not match the inferred pattern.</p> : null}
        <div className="profile-chart"><h3>Distribution</h3><ColumnChart profile={column} rows={dataset.rows} /></div>
        {(column.type === 'category' || column.type === 'text') && column.frequentValues.length > 0 ? <div className="frequency-list"><h3>Most frequent values</h3>{column.frequentValues.map((entry) => <div key={entry.value}><span>{entry.value || 'Blank'}</span><b>{formatNumber(entry.count, 0)}</b></div>)}</div> : null}
      </section>
    </div>
  </div>;
}
