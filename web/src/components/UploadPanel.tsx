import { useRef, useState, type ChangeEvent, type DragEvent, type JSX } from 'react';
import { Icon } from './Icon';

interface UploadPanelProps {
  onFile: (file: File) => void;
  compact?: boolean;
  busy?: boolean;
}

export function UploadPanel({ onFile, compact = false, busy = false }: UploadPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (files: FileList | null): void => {
    const firstFile = files?.item(0);
    if (firstFile && !busy) onFile(firstFile);
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!busy) setDragging(true);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files);
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>): void => choose(event.target.files);
  return (
    <div className={`dropzone ${compact ? 'dropzone--compact' : ''} ${dragging ? 'dropzone--active' : ''}`} onDragOver={onDragOver} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <input ref={inputRef} type="file" accept=".csv,application/json,.json,text/csv" onChange={onInput} className="sr-only" />
      <div className="dropzone__mark"><Icon name="upload" size={compact ? 19 : 26} /></div>
      <div>
        <strong>{busy ? 'Analysing your file…' : compact ? 'Analyse another file' : 'Drop your file here'}</strong>
        {!compact ? <span>CSV or JSON · processed only in this browser</span> : null}
      </div>
      <button className="button button--secondary" type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }} disabled={busy}>
        Browse files
      </button>
    </div>
  );
}
