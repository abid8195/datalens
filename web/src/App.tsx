import { useDeferredValue, useEffect, useMemo, useState, type JSX } from 'react';
import type { Dataset, DatasetFilter, DatasetProfile, SortState, TablePreferences, ViewName } from './types';
import { DataExplorer } from './components/DataExplorer';
import { DataHealth } from './components/DataHealth';
import { ColumnInspector } from './components/ColumnInspector';
import { Icon } from './components/Icon';
import { Overview } from './components/Overview';
import { UploadPanel } from './components/UploadPanel';
import { downloadCsv } from './services/exporter';
import { rowMatchesFilters, searchRows, sortRows } from './services/filters';
import { parseImportedFile } from './services/parser';
import { profileDataset } from './services/profiler';
import { readTablePreferences, saveTablePreferences } from './services/storage';

interface NavigationItem { view: ViewName; label: string; icon: 'grid' | 'table' | 'columns' | 'health'; }

const navigation: NavigationItem[] = [
  { view: 'overview', label: 'Overview', icon: 'grid' },
  { view: 'dataset', label: 'Dataset', icon: 'table' },
  { view: 'columns', label: 'Columns', icon: 'columns' },
  { view: 'health', label: 'Data Health', icon: 'health' },
];

const bytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
};

export default function App(): JSX.Element {
  const [dataset, setDataset] = useState<Dataset>();
  const [profile, setProfile] = useState<DatasetProfile>();
  const [activeView, setActiveView] = useState<ViewName>('overview');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<DatasetFilter[]>([]);
  const [sort, setSort] = useState<SortState>();
  const [preferences, setPreferences] = useState<TablePreferences>(() => readTablePreferences());
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [largeFileNotice, setLargeFileNotice] = useState('');

  useEffect(() => { saveTablePreferences(preferences); }, [preferences]);

  const displayedRows = useMemo(() => {
    if (!dataset || !profile) return [];
    const filtered = dataset.rows.filter((row) => rowMatchesFilters(row, filters, profile.columns));
    return sortRows(searchRows(filtered, deferredSearch), sort, profile.columns);
  }, [dataset, profile, filters, deferredSearch, sort]);

  const navigate = (view: ViewName): void => setActiveView(view);
  const inspectColumn = (column: string): void => { setSelectedColumn(column); setActiveView('columns'); };

  const handleFile = async (file: File): Promise<void> => {
    setError('');
    setLargeFileNotice(file.size > 10 * 1024 * 1024 ? 'This file is large and may take longer to analyse.' : '');
    setProcessing(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const result = await parseImportedFile(file);
    setProcessing(false);
    if (!result.dataset) { setError(result.error ?? 'This file could not be analysed.'); return; }
    const nextProfile = profileDataset(result.dataset);
    setDataset(result.dataset);
    setProfile(nextProfile);
    setSelectedColumn(result.dataset.columns[0] ?? '');
    setFilters([]);
    setSort(undefined);
    setSearch('');
    setActiveView('overview');
  };

  const clearDataset = (): void => {
    setDataset(undefined); setProfile(undefined); setSearch(''); setFilters([]); setSort(undefined); setSelectedColumn(''); setError(''); setLargeFileNotice('');
  };

  const content = (): JSX.Element => {
    if (!dataset || !profile) return <EmptyState onFile={handleFile} processing={processing} error={error} largeFileNotice={largeFileNotice} />;
    if (activeView === 'dataset') return <DataExplorer dataset={dataset} profiles={profile.columns} rows={displayedRows} search={search} onSearch={setSearch} filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} preferences={preferences} onPreferencesChange={setPreferences} onExport={() => downloadCsv(dataset.columns, displayedRows, dataset.fileName)} />;
    if (activeView === 'columns') return <ColumnInspector dataset={dataset} profile={profile} selectedColumn={selectedColumn} onSelectColumn={setSelectedColumn} />;
    if (activeView === 'health') return <DataHealth dataset={dataset} profile={profile} onSelectColumn={inspectColumn} />;
    return <Overview dataset={dataset} profile={profile} onNavigate={navigate} onSelectColumn={inspectColumn} />;
  };

  return <div className={dataset ? 'app-shell app-shell--loaded' : 'app-shell'}>
    {dataset ? <aside className="sidebar"><Brand /><nav aria-label="Main navigation">{navigation.map((item) => <button key={item.view} type="button" className={activeView === item.view ? 'is-active' : ''} onClick={() => navigate(item.view)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="sidebar__footer"><div className="dataset-file"><Icon name="file" size={17} /><span><strong>{dataset.fileName}</strong><small>{bytes(dataset.fileSize)}</small></span></div><UploadPanel onFile={handleFile} compact busy={processing} /><button className="new-file" type="button" onClick={clearDataset}><Icon name="plus" size={16} /> Start new analysis</button></div></aside> : null}
    <header className="mobile-header">{dataset ? <><Brand compact /><button className="icon-button" type="button" aria-label="Start a new analysis" onClick={clearDataset}><Icon name="plus" /></button></> : <Brand compact />}</header>
    <main className={dataset ? 'main-content' : 'main-content main-content--empty'}>{largeFileNotice && dataset ? <p className="notice notice--info"><Icon name="info" size={16} /> {largeFileNotice}</p> : null}{error && dataset ? <p className="notice notice--error" role="alert"><Icon name="warning" size={16} /> {error}</p> : null}{content()}</main>
    {dataset ? <nav className="bottom-dock" aria-label="Main navigation">{navigation.map((item) => <button key={item.view} type="button" className={activeView === item.view ? 'is-active' : ''} onClick={() => navigate(item.view)}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</nav> : null}
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }): JSX.Element {
  return <div className={compact ? 'brand brand--compact' : 'brand'}><span className="brand__mark"><Icon name="spark" size={20} /></span><span><strong>DataLens</strong>{!compact ? <small>Your instant data health check.</small> : null}</span></div>;
}

interface EmptyStateProps { onFile: (file: File) => void; processing: boolean; error: string; largeFileNotice: string; }

function EmptyState({ onFile, processing, error, largeFileNotice }: EmptyStateProps): JSX.Element {
  return <section className="empty-state"><div className="empty-state__intro"><p className="eyebrow">Private data utility</p><h1>Your instant<br />data health check.</h1><p>Understand CSV and JSON files privately, right in your browser.</p></div><div className="empty-state__upload"><UploadPanel onFile={onFile} busy={processing} />{largeFileNotice ? <p className="notice notice--info"><Icon name="info" size={16} /> {largeFileNotice}</p> : null}{error ? <p className="notice notice--error" role="alert"><Icon name="warning" size={16} /> {error}</p> : null}<div className="privacy-banner"><Icon name="check" size={18} /><span><strong>Your data stays on this device.</strong><small>Nothing is uploaded. DataLens uses no accounts, tracking, or analytics.</small></span></div></div><div className="empty-state__features"><span><Icon name="health" /> Find potential issues</span><span><Icon name="sliders" /> Filter and inspect</span><span><Icon name="download" /> Export your view</span></div></section>;
}
