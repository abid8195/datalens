import { useEffect, useMemo, useState, type JSX } from 'react';
import type { ColumnProfile, DataRow, Dataset, DatasetFilter, SortState, TablePreferences } from '../types';
import { displayType } from '../services/inference';
import { formatNumber } from '../services/statistics';
import { Icon } from './Icon';

interface DataExplorerProps {
  dataset: Dataset;
  profiles: ColumnProfile[];
  rows: DataRow[];
  search: string;
  onSearch: (value: string) => void;
  filters: DatasetFilter[];
  onFiltersChange: (filters: DatasetFilter[]) => void;
  sort: SortState | undefined;
  onSortChange: (sort: SortState) => void;
  preferences: TablePreferences;
  onPreferencesChange: (preferences: TablePreferences) => void;
  onExport: () => void;
}

const operatorsFor = (type: ColumnProfile['type']): Array<{ value: DatasetFilter['operator']; label: string }> => {
  if (type === 'number') return [{ value: 'equals', label: 'is' }, { value: 'greaterThan', label: 'is greater than' }, { value: 'lessThan', label: 'is less than' }, { value: 'between', label: 'is between' }];
  if (type === 'date') return [{ value: 'before', label: 'is before' }, { value: 'after', label: 'is after' }, { value: 'between', label: 'is between' }];
  if (type === 'category' || type === 'boolean') return [{ value: 'in', label: 'is one of' }, { value: 'equals', label: 'is' }];
  return [{ value: 'contains', label: 'contains' }, { value: 'equals', label: 'is' }, { value: 'startsWith', label: 'starts with' }];
};

const cellText = (value: string): string => value === '' ? '—' : value;

export function DataExplorer({ dataset, profiles, rows, search, onSearch, filters, onFiltersChange, sort, onSortChange, preferences, onPreferencesChange, onExport }: DataExplorerProps): JSX.Element {
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [filterColumn, setFilterColumn] = useState(dataset.columns[0]);
  const selectedProfile = profiles.find((profile) => profile.name === filterColumn) ?? profiles[0];
  const [operator, setOperator] = useState<DatasetFilter['operator']>(operatorsFor(selectedProfile.type)[0].value);
  const [filterValue, setFilterValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const visibleColumns = preferences.visibleColumns.length > 0 ? dataset.columns.filter((column) => preferences.visibleColumns.includes(column)) : dataset.columns;
  const totalPages = Math.max(1, Math.ceil(rows.length / preferences.pageSize));
  const pageRows = useMemo(() => rows.slice((page - 1) * preferences.pageSize, page * preferences.pageSize), [page, preferences.pageSize, rows]);

  useEffect(() => { setPage(1); }, [rows.length, search, filters, preferences.pageSize]);
  useEffect(() => { setOperator(operatorsFor(selectedProfile.type)[0].value); }, [filterColumn, selectedProfile.type]);

  const addFilter = (): void => {
    if (!filterValue.trim()) return;
    onFiltersChange([...filters, { id: `${filterColumn}-${Date.now()}`, column: filterColumn, operator, value: filterValue, secondaryValue: operator === 'between' ? secondaryValue : undefined }]);
    setFilterValue('');
    setSecondaryValue('');
  };
  const toggleColumn = (column: string): void => {
    const current = preferences.visibleColumns.length > 0 ? preferences.visibleColumns : dataset.columns;
    const next = current.includes(column) ? current.filter((item) => item !== column) : [...current, column];
    onPreferencesChange({ ...preferences, visibleColumns: next.length === dataset.columns.length ? [] : next });
  };
  const toggleSort = (column: string): void => onSortChange({ column, direction: sort?.column === column && sort.direction === 'asc' ? 'desc' : 'asc' });

  return <div className="view-stack"><section className="page-intro page-intro--compact"><div><p className="eyebrow">Dataset</p><h1>Explore the source data.</h1><p>Search, filter, sort, then export only the rows you need.</p></div><button className="button" type="button" onClick={onExport} disabled={rows.length === 0}><Icon name="download" /> Export CSV</button></section>
    <section className="card explorer-card"><div className="explorer-toolbar"><label className="search-field"><Icon name="search" size={17} /><span className="sr-only">Search all rows</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search all values" type="search" /></label><div className="toolbar-actions"><button type="button" className={showFilters ? 'button button--secondary is-active' : 'button button--secondary'} onClick={() => setShowFilters(!showFilters)}><Icon name="filter" /> Filters{filters.length > 0 ? ` (${filters.length})` : ''}</button><button type="button" className={showColumns ? 'button button--secondary is-active' : 'button button--secondary'} onClick={() => setShowColumns(!showColumns)}><Icon name="columns" /> Columns</button></div></div>
      {showFilters ? <div className="filter-panel"><div className="filter-fields"><label><span>Column</span><select value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)}>{profiles.map((profile) => <option value={profile.name} key={profile.name}>{profile.name}</option>)}</select></label><label><span>Condition</span><select value={operator} onChange={(event) => setOperator(event.target.value as DatasetFilter['operator'])}>{operatorsFor(selectedProfile.type).map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label><span>Value</span><input type={selectedProfile.type === 'date' ? 'date' : 'text'} value={filterValue} onChange={(event) => setFilterValue(event.target.value)} placeholder={operator === 'in' ? 'e.g. Australia, Canada' : 'Enter a value'} /></label>{operator === 'between' ? <label><span>And</span><input type={selectedProfile.type === 'date' ? 'date' : 'text'} value={secondaryValue} onChange={(event) => setSecondaryValue(event.target.value)} placeholder="Second value" /></label> : null}<button className="button" type="button" onClick={addFilter}><Icon name="plus" /> Add filter</button></div>{filters.length > 0 ? <div className="filter-chips">{filters.map((filter) => <button key={filter.id} type="button" onClick={() => onFiltersChange(filters.filter((item) => item.id !== filter.id))}>{filter.column} · {filter.operator.replace(/([A-Z])/g, ' $1').toLowerCase()} · {filter.value}{filter.secondaryValue ? ` – ${filter.secondaryValue}` : ''}<Icon name="x" size={13} /></button>)}<button type="button" className="text-button" onClick={() => onFiltersChange([])}>Clear all</button></div> : null}</div> : null}
      {showColumns ? <div className="column-picker"><p>Choose which columns to show. This preference is saved only in this browser.</p><div>{dataset.columns.map((column) => <label key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} /> {column}</label>)}</div></div> : null}
      <div className="table-summary"><span>{formatNumber(rows.length, 0)} of {formatNumber(dataset.rows.length, 0)} rows{filters.length > 0 || search ? ' match your view' : ''}</span><label>Rows per page <select value={preferences.pageSize} onChange={(event) => onPreferencesChange({ ...preferences, pageSize: Number(event.target.value) })}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label></div>
      <div className="table-scroll"><table><thead><tr>{visibleColumns.map((column) => <th key={column} scope="col"><button type="button" onClick={() => toggleSort(column)}>{column} {sort?.column === column ? <span aria-label={sort.direction === 'asc' ? 'ascending' : 'descending'}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null}</button><small>{displayType(profiles.find((profile) => profile.name === column)?.type ?? 'text')}</small></th>)}</tr></thead><tbody>{pageRows.length === 0 ? <tr><td colSpan={Math.max(1, visibleColumns.length)}><div className="table-empty"><Icon name="search" /><strong>No rows match this view</strong><span>Try removing a filter or changing your search.</span></div></td></tr> : pageRows.map((row) => <tr key={row.id}>{visibleColumns.map((column) => <td key={column} title={row.values[column] ?? ''}>{cellText(row.values[column] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <div className="pagination"><span>Page {page} of {totalPages}</span><div><button className="icon-button" type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><Icon name="arrowLeft" /></button><button className="icon-button" type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><Icon name="arrowRight" /></button></div></div>
    </section>
  </div>;
}
