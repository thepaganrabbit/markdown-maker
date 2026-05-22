'use client';

import { useEffect, useMemo, useState } from 'react';

type ElementType = 'heading' | 'text' | 'line' | 'table';

type TableData = {
  headers: string[];
  rows: string[][];
};

type CanvasItem = {
  id: string;
  type: ElementType;
  row: number;
  content?: string;
  table?: TableData;
};

type DocListItem = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

const GRID_ROW_PX = 44;
const INITIAL_ROWS = 18;
const DRAFT_STORAGE_KEY = 'doc-u-maker:workspace-draft:v1';

function createEmptyTable(columnCount = 3, rowCount = 2): TableData {
  return {
    headers: Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''))
  };
}

function toMarkdown(items: CanvasItem[]) {
  const ordered = [...items].sort((a, b) => a.row - b.row);
  return ordered
    .map((item) => {
      if (item.type === 'heading') return `# ${item.content ?? 'Main Heading'}`;
      if (item.type === 'text') return item.content ?? 'Text paragraph';
      if (item.type === 'table') {
        const table = item.table ?? createEmptyTable();
        const headers = table.headers.length > 0 ? table.headers : ['Column 1'];
        const normalizedRows = table.rows.map((row) =>
          headers.map((_, colIndex) => row[colIndex] ?? '')
        );
        const headerLine = `| ${headers.join(' | ')} |`;
        const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
        const bodyLines = normalizedRows.map((row) => `| ${row.join(' | ')} |`);
        return [headerLine, separatorLine, ...bodyLines].join('\n');
      }
      return '---';
    })
    .join('\n\n');
}

function fromMarkdown(content: string): CanvasItem[] {
  const blocks = content.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    if (block.startsWith('# ')) {
      return { id: `load-${index}`, type: 'heading' as const, row: index, content: block.slice(2) };
    }
    if (block === '---') {
      return { id: `load-${index}`, type: 'line' as const, row: index };
    }
    const lines = block.split('\n').map((line) => line.trim());
    const isTable =
      lines.length >= 2 &&
      lines[0].startsWith('|') &&
      lines[0].endsWith('|') &&
      /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(lines[1]);
    if (isTable) {
      const parseRow = (line: string) =>
        line
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());
      const headers = parseRow(lines[0]);
      const rows = lines.slice(2).map(parseRow);
      return {
        id: `load-${index}`,
        type: 'table' as const,
        row: index,
        table: {
          headers,
          rows: rows.map((row) => headers.map((_, colIndex) => row[colIndex] ?? ''))
        }
      };
    }
    return { id: `load-${index}`, type: 'text' as const, row: index, content: block };
  });
}

export default function UserWorkspace() {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [dragType, setDragType] = useState<ElementType | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [title, setTitle] = useState('Untitled document');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const markdown = useMemo(() => toMarkdown(items), [items]);
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.row - b.row), [items]);

  function saveDraftProgress() {
    const payload = JSON.stringify({ title, items });
    window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    setMessage('Progress saved locally.');
  }

  async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch(input, init);
    if (response.status !== 401) return response;

    const refresh = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refresh.ok) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    return fetch(input, init);
  }

  async function loadDocs() {
    const response = await authFetch('/api/docs');
    if (!response.ok) return;
    const json = await response.json();
    setDocs(json.docs);
  }

  useEffect(() => {
    loadDocs().catch(() => setMessage('Failed to load markdown documents.'));
  }, []);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as { title?: string; items?: CanvasItem[] };
      if (draft.title) setTitle(draft.title);
      if (Array.isArray(draft.items)) setItems(draft.items);
      setMessage('Recovered local draft.');
    } catch {
      setMessage('Could not restore local draft.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const payload = JSON.stringify({ title, items });
      window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [title, items]);

  function nextFreeRow(startRow: number) {
    const occupied = new Set(items.map((item) => item.row));
    let row = Math.max(0, startRow);
    while (occupied.has(row)) row += 1;
    return row;
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('application/doc-canvas-item');
    if (draggedItemId) {
      const container = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - container.top;
      const targetRow = Math.max(0, Math.floor(relativeY / GRID_ROW_PX));

      setItems((prev) => {
        const source = prev.find((item) => item.id === draggedItemId);
        if (!source) return prev;

        const target = prev.find((item) => item.row === targetRow && item.id !== source.id);
        if (!target) {
          return prev.map((item) => (item.id === source.id ? { ...item, row: targetRow } : item));
        }

        return prev.map((item) => {
          if (item.id === source.id) return { ...item, row: target.row };
          if (item.id === target.id) return { ...item, row: source.row };
          return item;
        });
      });
      setDragItemId(null);
      setDragType(null);
      return;
    }

    const type = e.dataTransfer.getData('application/doc-element') as ElementType;
    if (!type) return;

    const container = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - container.top;
    const desiredRow = Math.floor(relativeY / GRID_ROW_PX);
    const row = nextFreeRow(desiredRow);

    const id = `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        type,
        row,
        content: type === 'heading' ? 'Main Heading' : type === 'text' ? 'Text paragraph' : undefined,
        table: type === 'table' ? createEmptyTable() : undefined
      }
    ]);
    setDragType(null);
  }

  function updateContent(id: string, value: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, content: value } : item)));
  }

  function updateTableHeader(itemId: string, columnIndex: number, value: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'table') return item;
        const table = item.table ?? createEmptyTable();
        const headers = table.headers.map((header, index) => (index === columnIndex ? value : header));
        return { ...item, table: { ...table, headers } };
      })
    );
  }

  function updateTableCell(itemId: string, rowIndex: number, columnIndex: number, value: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'table') return item;
        const table = item.table ?? createEmptyTable();
        const rows = table.rows.map((row, rIdx) =>
          rIdx === rowIndex ? row.map((cell, cIdx) => (cIdx === columnIndex ? value : cell)) : row
        );
        return { ...item, table: { ...table, rows } };
      })
    );
  }

  function resizeTable(itemId: string, nextColumnCount: number, nextRowCount: number) {
    const safeColumnCount = Math.min(8, Math.max(1, nextColumnCount));
    const safeRowCount = Math.min(10, Math.max(1, nextRowCount));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'table') return item;
        const table = item.table ?? createEmptyTable();
        const headers = Array.from({ length: safeColumnCount }, (_, colIndex) => {
          return table.headers[colIndex] ?? `Column ${colIndex + 1}`;
        });
        const rows = Array.from({ length: safeRowCount }, (_, rowIndex) => {
          const existingRow = table.rows[rowIndex] ?? [];
          return Array.from({ length: safeColumnCount }, (_, colIndex) => existingRow[colIndex] ?? '');
        });
        return { ...item, table: { headers, rows } };
      })
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function createDoc() {
    const response = await authFetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: markdown || '# Empty' })
    });

    if (!response.ok) {
      setMessage('Failed to save document.');
      return;
    }

    setMessage('Document saved.');
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    await loadDocs();
  }

  async function updateDoc() {
    if (!selectedDocId) {
      setMessage('Select a document first.');
      return;
    }

    const response = await authFetch(`/api/docs/${selectedDocId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: markdown || '# Empty' })
    });

    if (!response.ok) {
      setMessage('Failed to update document.');
      return;
    }

    setMessage('Document updated.');
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    await loadDocs();
  }

  async function loadDoc(id: string) {
    const response = await authFetch(`/api/docs/${id}`);
    if (!response.ok) {
      setMessage('Failed to load document.');
      return;
    }

    const json = await response.json();
    setSelectedDocId(id);
    setTitle(json.doc.title);
    setItems(fromMarkdown(json.doc.content));
    setMessage('Document loaded.');
  }

  async function deleteDoc(id: string) {
    const response = await authFetch(`/api/docs/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage('Failed to delete document.');
      return;
    }

    if (selectedDocId === id) {
      setSelectedDocId(null);
      setItems([]);
      setTitle('Untitled document');
    }
    setMessage('Document deleted.');
    await loadDocs();
  }

  return (
    <main className="container-fluid py-4 users-main">
      <div className="row g-3">
        <aside className="col-12 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h1 className="h4">User Workspace</h1>
              <p className="text-muted small mb-3">Drag elements into the canvas. Content snaps to rows.</p>

              <div className="d-grid gap-2 mb-4">
                {(['heading', 'text', 'line', 'table'] as ElementType[]).map((type) => (
                  <button
                    key={type}
                    className="btn btn-outline-primary text-start"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/doc-element', type);
                      setDragType(type);
                    }}
                    onDragEnd={() => setDragType(null)}
                  >
                    {type === 'heading'
                      ? 'Main heading'
                      : type === 'text'
                        ? 'Text block'
                        : type === 'line'
                          ? 'Horizontal line'
                          : 'Table'}
                  </button>
                ))}
              </div>

              <label className="form-label">Document Title</label>
              <input className="form-control mb-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="d-grid gap-2 mb-3">
                <button className="btn btn-outline-secondary" onClick={saveDraftProgress}>
                  Save Progress
                </button>
                <button className="btn btn-primary" onClick={createDoc}>
                  Save New Markdown
                </button>
                <button className="btn btn-outline-primary" onClick={updateDoc}>
                  Update Selected
                </button>
              </div>

              <h2 className="h6">Saved Markdown Files</h2>
              <div className="docs-list">
                {docs.map((doc) => (
                  <div key={doc.id} className={`doc-row ${selectedDocId === doc.id ? 'active' : ''}`}>
                    <button className="btn btn-sm btn-link p-0 me-2" onClick={() => loadDoc(doc.id)}>
                      {doc.title}
                    </button>
                    <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => deleteDoc(doc.id)}>
                      Delete
                    </button>
                  </div>
                ))}
                {docs.length === 0 ? <p className="small text-muted mb-0">No docs yet.</p> : null}
              </div>

              {message ? <div className="alert alert-info py-2 mt-3 mb-0">{message}</div> : null}
            </div>
          </div>
        </aside>

        <section className="col-12 col-lg-6">
          <div
            className={`canvas-shell ${dragType ? 'drag-active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="canvas-grid" style={{ minHeight: `${INITIAL_ROWS * GRID_ROW_PX}px` }}>
              {Array.from({ length: INITIAL_ROWS }).map((_, i) => (
                <div key={i} className="grid-row" style={{ top: `${i * GRID_ROW_PX}px`, height: `${GRID_ROW_PX}px` }} />
              ))}

              {orderedItems.map((item) => (
                <div
                  key={item.id}
                  className={`canvas-item ${dragItemId === item.id ? 'is-dragging' : ''}`}
                  style={{ top: `${item.row * GRID_ROW_PX}px` }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/doc-canvas-item', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragItemId(item.id);
                  }}
                  onDragEnd={() => setDragItemId(null)}
                >
                  <button className="btn-close btn-close-sm" onClick={() => removeItem(item.id)} />
                  {item.type === 'heading' ? (
                    <input
                      className="form-control form-control-lg border-0 px-0 fw-bold"
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'text' ? (
                    <textarea
                      className="form-control border-0 px-0"
                      rows={2}
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'line' ? <hr className="my-3" /> : null}
                  {item.type === 'table' ? (
                    <div className="table-element">
                      <div className="table-controls mb-2">
                        <label className="form-label mb-0 small">
                          Columns
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            min={1}
                            max={8}
                            value={item.table?.headers.length ?? 3}
                            onChange={(e) =>
                              resizeTable(item.id, Number(e.target.value) || 1, item.table?.rows.length ?? 2)
                            }
                          />
                        </label>
                        <label className="form-label mb-0 small">
                          Rows
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            min={1}
                            max={10}
                            value={item.table?.rows.length ?? 2}
                            onChange={(e) =>
                              resizeTable(item.id, item.table?.headers.length ?? 3, Number(e.target.value) || 1)
                            }
                          />
                        </label>
                      </div>
                      <div className="table-grid">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              {(item.table?.headers ?? []).map((header, colIndex) => (
                                <th key={`${item.id}-h-${colIndex}`}>
                                  <input
                                    className="form-control form-control-sm"
                                    value={header}
                                    onChange={(e) => updateTableHeader(item.id, colIndex, e.target.value)}
                                  />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(item.table?.rows ?? []).map((row, rowIndex) => (
                              <tr key={`${item.id}-r-${rowIndex}`}>
                                {row.map((cell, colIndex) => (
                                  <td key={`${item.id}-c-${rowIndex}-${colIndex}`}>
                                    <input
                                      className="form-control form-control-sm"
                                      value={cell}
                                      onChange={(e) =>
                                        updateTableCell(item.id, rowIndex, colIndex, e.target.value)
                                      }
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="col-12 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h2 className="h6">Markdown Preview</h2>
              <pre className="markdown-preview flex-grow-1">{markdown || '# Empty canvas'}</pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
