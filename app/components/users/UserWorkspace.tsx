'use client';

import ReactMarkdown from 'react-markdown';
import { useEffect, useMemo, useRef, useState } from 'react';

type ElementType =
  | 'heading'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'boldHeading'
  | 'text'
  | 'line'
  | 'table'
  | 'code'
  | 'definition'
  | 'task'
  | 'image'
  | 'olist'
  | 'ulist';

const KNOWN_CODE_LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'java',
  'csharp',
  'cpp',
  'go',
  'ruby',
  'php',
  'rust',
  'bash',
  'json',
  'yaml',
  'markdown'
] as const;

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
  code?: {
    language: string;
    customLanguage: string;
    useCustomLanguage: boolean;
    content: string;
  };
  definition?: {
    term: string;
    description: string;
  };
  task?: {
    checked: boolean;
    label: string;
  };
  image?: {
    source: 'url' | 'upload';
    url: string;
    alt: string;
  };
  list?: {
    items: string[];
  };
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
const CSRF_HEADER = 'x-csrf-token';

function getCookieValue(name: string) {
  const token = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return token ? decodeURIComponent(token) : null;
}

function createEmptyTable(columnCount = 3, rowCount = 2): TableData {
  return {
    headers: Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''))
  };
}

function splitMarkdownBlocks(content: string) {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) inFence = !inFence;

    if (!inFence && line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current.join('\n').trim());
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) blocks.push(current.join('\n').trim());
  return blocks.filter(Boolean);
}

function toMarkdown(items: CanvasItem[]) {
  const ordered = [...items].sort((a, b) => a.row - b.row);
  return ordered
    .map((item) => {
      if (item.type === 'heading') return `# ${item.content ?? 'Main Heading'}`;
      if (item.type === 'heading2') return `## ${item.content ?? 'Sub Heading'}`;
      if (item.type === 'heading3') return `### ${item.content ?? 'Sub Heading'}`;
      if (item.type === 'heading4') return `#### ${item.content ?? 'Sub Heading'}`;
      if (item.type === 'boldHeading') return `**${item.content ?? 'Bold Heading'}**`;
      if (item.type === 'text') return item.content ?? 'Text paragraph';
      if (item.type === 'table') {
        const table = item.table ?? createEmptyTable();
        const headers = table.headers.length > 0 ? table.headers : ['Column 1'];
        const normalizedRows = table.rows.map((row) => headers.map((_, colIndex) => row[colIndex] ?? ''));
        const headerLine = `| ${headers.join(' | ')} |`;
        const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
        const bodyLines = normalizedRows.map((row) => `| ${row.join(' | ')} |`);
        return [headerLine, separatorLine, ...bodyLines].join('\n');
      }
      if (item.type === 'code') {
        const code = item.code ?? {
          language: 'plaintext',
          customLanguage: '',
          useCustomLanguage: false,
          content: ''
        };
        const language = code.useCustomLanguage ? code.customLanguage.trim() || 'plaintext' : code.language;
        return `\`\`\`${language}\n${code.content || '// Code snippet'}\n\`\`\``;
      }
      if (item.type === 'definition') {
        const definition = item.definition ?? { term: 'Term', description: 'Definition' };
        return `${definition.term || 'Term'}\n: ${definition.description || 'Definition'}`;
      }
      if (item.type === 'task') {
        const task = item.task ?? { checked: false, label: 'Task item' };
        return `- [${task.checked ? 'x' : ' '}] ${task.label || 'Task item'}`;
      }
      if (item.type === 'image') {
        const image = item.image ?? { source: 'url', url: 'https://placehold.co/1200x600/png', alt: 'Image' };
        return `![${image.alt || 'Image'}](${image.url || 'https://placehold.co/1200x600/png'})`;
      }
      if (item.type === 'olist') {
        const listItems = item.list?.items?.length ? item.list.items : ['First item'];
        return listItems.map((entry, idx) => `${idx + 1}. ${entry || 'List item'}`).join('\n');
      }
      if (item.type === 'ulist') {
        const listItems = item.list?.items?.length ? item.list.items : ['First item'];
        return listItems.map((entry) => `- ${entry || 'List item'}`).join('\n');
      }
      return '---';
    })
    .join('\n\n');
}

function fromMarkdown(content: string): CanvasItem[] {
  const blocks = splitMarkdownBlocks(content);

  return blocks.map((block, index) => {
    if (block.startsWith('# ')) {
      return { id: `load-${index}`, type: 'heading' as const, row: index, content: block.slice(2) };
    }
    if (block.startsWith('## ')) {
      return { id: `load-${index}`, type: 'heading2' as const, row: index, content: block.slice(3) };
    }
    if (block.startsWith('### ')) {
      return { id: `load-${index}`, type: 'heading3' as const, row: index, content: block.slice(4) };
    }
    if (block.startsWith('#### ')) {
      return { id: `load-${index}`, type: 'heading4' as const, row: index, content: block.slice(5) };
    }
    const boldHeadingMatch = block.match(/^\*\*([\s\S]+)\*\*$/);
    if (boldHeadingMatch) {
      return { id: `load-${index}`, type: 'boldHeading' as const, row: index, content: boldHeadingMatch[1] };
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

    const codeMatch = block.match(/^```([^\n]*)\n([\s\S]*?)\n```$/);
    if (codeMatch) {
      const language = codeMatch[1].trim() || 'plaintext';
      const knownLanguages = new Set<string>(KNOWN_CODE_LANGUAGES);
      const isKnown = knownLanguages.has(language);
      return {
        id: `load-${index}`,
        type: 'code' as const,
        row: index,
        code: {
          language: isKnown ? language : 'plaintext',
          customLanguage: isKnown ? '' : language,
          useCustomLanguage: !isKnown,
          content: codeMatch[2]
        }
      };
    }

    const definitionMatch = block.match(/^([^\n]+)\n:\s+([\s\S]+)$/);
    if (definitionMatch) {
      return {
        id: `load-${index}`,
        type: 'definition' as const,
        row: index,
        definition: {
          term: definitionMatch[1],
          description: definitionMatch[2]
        }
      };
    }

    const taskMatch = block.match(/^- \[( |x|X)\] (.+)$/);
    if (taskMatch) {
      return {
        id: `load-${index}`,
        type: 'task' as const,
        row: index,
        task: {
          checked: taskMatch[1].toLowerCase() === 'x',
          label: taskMatch[2]
        }
      };
    }

    const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      return {
        id: `load-${index}`,
        type: 'image' as const,
        row: index,
        image: {
          source: imageMatch[2].startsWith('/api/uploads/') ? 'upload' : 'url',
          alt: imageMatch[1],
          url: imageMatch[2]
        }
      };
    }

    const orderedListLines = lines.filter((line) => /^\d+\.\s+/.test(line));
    if (orderedListLines.length === lines.length && orderedListLines.length > 0) {
      return {
        id: `load-${index}`,
        type: 'olist' as const,
        row: index,
        list: {
          items: orderedListLines.map((line) => line.replace(/^\d+\.\s+/, ''))
        }
      };
    }

    const unorderedListLines = lines.filter((line) => /^[-*]\s+/.test(line));
    if (unorderedListLines.length === lines.length && unorderedListLines.length > 0) {
      return {
        id: `load-${index}`,
        type: 'ulist' as const,
        row: index,
        list: {
          items: unorderedListLines.map((line) => line.replace(/^[-*]\s+/, ''))
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
  const [previewMode, setPreviewMode] = useState<'code' | 'rendered'>('code');
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const textInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const markdown = useMemo(() => toMarkdown(items), [items]);
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.row - b.row), [items]);

  function saveDraftProgress() {
    const payload = JSON.stringify({ title, items });
    window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    setMessage('Progress saved locally.');
  }

  async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const headers = new Headers(init?.headers);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = getCookieValue('csrfToken');
      if (csrfToken) headers.set(CSRF_HEADER, csrfToken);
    }

    const requestInit = { ...init, headers };
    const response = await fetch(input, requestInit);
    if (response.status !== 401) return response;

    const refresh = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refresh.ok) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    return fetch(input, requestInit);
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
        content:
          type === 'heading'
            ? 'Main Heading'
            : type === 'heading2'
              ? 'Sub Heading'
              : type === 'heading3'
                ? 'Sub Heading'
                : type === 'heading4'
                  ? 'Sub Heading'
                  : type === 'boldHeading'
                    ? 'Bold Heading'
                    : type === 'text'
                      ? 'Text paragraph'
                      : undefined,
        row,
        table: type === 'table' ? createEmptyTable() : undefined,
        code:
          type === 'code'
            ? { language: 'plaintext', customLanguage: '', useCustomLanguage: false, content: '' }
            : undefined,
        definition: type === 'definition' ? { term: 'Term', description: 'Definition' } : undefined,
        task: type === 'task' ? { checked: false, label: 'Task item' } : undefined,
        image: type === 'image' ? { source: 'url', url: 'https://placehold.co/1200x600/png', alt: 'Image' } : undefined,
        list: type === 'olist' || type === 'ulist' ? { items: ['First item'] } : undefined
      }
    ]);
    setDragType(null);
  }

  function updateContent(id: string, value: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, content: value } : item)));
  }

  function updateList(itemId: string, value: string) {
    const items = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || (item.type !== 'olist' && item.type !== 'ulist')) return item;
        return { ...item, list: { items } };
      })
    );
  }

  function applyInlineFormat(itemId: string, format: string) {
    const textarea = textInputRefs.current[itemId];
    if (!textarea) return;

    const value = textarea.value;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = value.slice(start, end) || 'text';
    let prefix = '';
    let suffix = '';

    if (format === 'bold') {
      prefix = '**';
      suffix = '**';
    }
    if (format === 'italic') {
      prefix = '*';
      suffix = '*';
    }
    if (format === 'strikethrough') {
      prefix = '~~';
      suffix = '~~';
    }
    if (format === 'highlight') {
      prefix = '==';
      suffix = '==';
    }
    if (format === 'subscript') {
      prefix = '<sub>';
      suffix = '</sub>';
    }
    if (format === 'superscript') {
      prefix = '<sup>';
      suffix = '</sup>';
    }

    const inserted = `${prefix}${selected}${suffix}`;

    const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    updateContent(itemId, next);

    window.requestAnimationFrame(() => {
      const ref = textInputRefs.current[itemId];
      if (!ref) return;
      ref.focus();
      const selectionStart = start + prefix.length;
      const selectionEnd = selectionStart + selected.length;
      ref.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function updateCode(itemId: string, patch: Partial<NonNullable<CanvasItem['code']>>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'code') return item;
        const code = item.code ?? { language: 'plaintext', customLanguage: '', useCustomLanguage: false, content: '' };
        return { ...item, code: { ...code, ...patch } };
      })
    );
  }

  function updateDefinition(itemId: string, patch: Partial<NonNullable<CanvasItem['definition']>>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'definition') return item;
        const definition = item.definition ?? { term: 'Term', description: 'Definition' };
        return { ...item, definition: { ...definition, ...patch } };
      })
    );
  }

  function updateTask(itemId: string, patch: Partial<NonNullable<CanvasItem['task']>>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'task') return item;
        const task = item.task ?? { checked: false, label: 'Task item' };
        return { ...item, task: { ...task, ...patch } };
      })
    );
  }

  function updateImage(itemId: string, patch: Partial<NonNullable<CanvasItem['image']>>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.type !== 'image') return item;
        const image = item.image ?? { source: 'url', url: '', alt: 'Image' };
        return { ...item, image: { ...image, ...patch } };
      })
    );
  }

  async function uploadImage(itemId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    setUploadingItemId(itemId);
    const response = await authFetch('/api/uploads', {
      method: 'POST',
      body: formData
    });
    setUploadingItemId(null);

    if (!response.ok) {
      setMessage('Failed to upload image.');
      return;
    }

    const json = await response.json();
    updateImage(itemId, { source: 'upload', url: json.url });
    setMessage('Image uploaded.');
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
                {(
                  [
                    'heading',
                    'heading2',
                    'heading3',
                    'heading4',
                    'boldHeading',
                    'text',
                    'line',
                    'table',
                    'code',
                    'definition',
                    'task',
                    'image',
                    'olist',
                    'ulist'
                  ] as ElementType[]
                ).map(
                  (type) => (
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
                        : type === 'heading2'
                          ? 'Sub Heading 1'
                          : type === 'heading3'
                            ? 'Sub Heading 2'
                            : type === 'heading4'
                              ? 'Sub Heading 3'
                              : type === 'boldHeading'
                                ? 'Bold Heading'
                        : type === 'text'
                          ? 'Text block'
                          : type === 'line'
                            ? 'Horizontal line'
                            : type === 'table'
                              ? 'Table'
                              : type === 'code'
                                ? 'Code block'
                                : type === 'definition'
                                  ? 'Definition list'
                                  : type === 'task'
                                    ? 'Task list'
                                    : type === 'image'
                                      ? 'Image block'
                                      : type === 'olist'
                                        ? 'Ordered list'
                                        : 'Unordered list'}
                    </button>
                  )
                )}
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
                  {item.type === 'heading2' ? (
                    <input
                      className="form-control border-0 px-0 fw-semibold"
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'heading3' ? (
                    <input
                      className="form-control form-control-sm border-0 px-0 fw-semibold"
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'heading4' ? (
                    <input
                      className="form-control form-control-sm border-0 px-0"
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'boldHeading' ? (
                    <input
                      className="form-control border-0 px-0 fw-bold"
                      value={item.content ?? ''}
                      onChange={(e) => updateContent(item.id, e.target.value)}
                    />
                  ) : null}
                  {item.type === 'text' ? (
                    <div className="pt-2 pe-4">
                      <select
                        className="form-select form-select-sm mb-2"
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) return;
                          applyInlineFormat(item.id, value);
                          e.currentTarget.value = '';
                        }}
                      >
                        <option value="">Insert formatting...</option>
                        <option value="bold">Bold</option>
                        <option value="italic">Italic</option>
                        <option value="strikethrough">Strikethrough</option>
                        <option value="highlight">Highlight</option>
                        <option value="subscript">Subscript</option>
                        <option value="superscript">Superscript</option>
                      </select>
                      <textarea
                        ref={(node) => {
                          textInputRefs.current[item.id] = node;
                        }}
                        className="form-control border-0 px-0"
                        rows={2}
                        value={item.content ?? ''}
                        onChange={(e) => updateContent(item.id, e.target.value)}
                      />
                    </div>
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
                                      onChange={(e) => updateTableCell(item.id, rowIndex, colIndex, e.target.value)}
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
                  {item.type === 'code' ? (
                    <div className="pt-2 pe-4">
                      <div className="row g-2 mb-2">
                        <div className="col-7">
                          <label className="form-label mb-1 small">Language</label>
                          <select
                            className="form-select form-select-sm"
                            value={item.code?.useCustomLanguage ? '__custom__' : item.code?.language ?? 'plaintext'}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '__custom__') {
                                updateCode(item.id, { useCustomLanguage: true });
                                return;
                              }
                              updateCode(item.id, { language: value, useCustomLanguage: false });
                            }}
                          >
                            {KNOWN_CODE_LANGUAGES.map((language) => (
                              <option key={language} value={language}>
                                {language}
                              </option>
                            ))}
                            <option value="__custom__">Custom...</option>
                          </select>
                        </div>
                        {item.code?.useCustomLanguage ? (
                          <div className="col-5">
                            <label className="form-label mb-1 small">Custom</label>
                            <input
                              className="form-control form-control-sm"
                              value={item.code?.customLanguage ?? ''}
                              onChange={(e) => updateCode(item.id, { customLanguage: e.target.value })}
                            />
                          </div>
                        ) : null}
                      </div>
                      <textarea
                        className="form-control form-control-sm"
                        rows={4}
                        value={item.code?.content ?? ''}
                        onChange={(e) => updateCode(item.id, { content: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {item.type === 'definition' ? (
                    <div className="pt-2 pe-4">
                      <label className="form-label mb-1 small">Term</label>
                      <input
                        className="form-control form-control-sm mb-2"
                        value={item.definition?.term ?? ''}
                        onChange={(e) => updateDefinition(item.id, { term: e.target.value })}
                      />
                      <label className="form-label mb-1 small">Definition</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={item.definition?.description ?? ''}
                        onChange={(e) => updateDefinition(item.id, { description: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {item.type === 'task' ? (
                    <div className="pt-2 pe-4 d-flex align-items-center gap-2">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={item.task?.checked ?? false}
                        onChange={(e) => updateTask(item.id, { checked: e.target.checked })}
                      />
                      <input
                        className="form-control form-control-sm"
                        value={item.task?.label ?? ''}
                        onChange={(e) => updateTask(item.id, { label: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {item.type === 'image' ? (
                    <div className="pt-2 pe-4">
                      <label className="form-label mb-1 small">Alt text</label>
                      <input
                        className="form-control form-control-sm mb-2"
                        value={item.image?.alt ?? ''}
                        onChange={(e) => updateImage(item.id, { alt: e.target.value })}
                      />
                      <div className="btn-group btn-group-sm mb-2">
                        <button
                          type="button"
                          className={`btn ${item.image?.source === 'url' ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => updateImage(item.id, { source: 'url' })}
                        >
                          URL
                        </button>
                        <button
                          type="button"
                          className={`btn ${item.image?.source === 'upload' ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => updateImage(item.id, { source: 'upload' })}
                        >
                          Upload
                        </button>
                      </div>
                      {item.image?.source === 'url' ? (
                        <input
                          className="form-control form-control-sm"
                          placeholder="https://example.com/image.png"
                          value={item.image?.url ?? ''}
                          onChange={(e) => updateImage(item.id, { url: e.target.value })}
                        />
                      ) : (
                        <div className="d-grid gap-2">
                          <input
                            className="form-control form-control-sm"
                            readOnly
                            placeholder="Uploaded image URL"
                            value={item.image?.url ?? ''}
                          />
                          <label className="btn btn-outline-secondary btn-sm mb-0">
                            {uploadingItemId === item.id ? 'Uploading...' : 'Upload Image'}
                            <input
                              type="file"
                              className="d-none"
                              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                uploadImage(item.id, file).catch(() => setMessage('Failed to upload image.'));
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {item.type === 'olist' || item.type === 'ulist' ? (
                    <div className="pt-2 pe-4">
                      <label className="form-label mb-1 small">One item per line</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={4}
                        value={(item.list?.items ?? []).join('\n')}
                        onChange={(e) => updateList(item.id, e.target.value)}
                      />
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
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="h6 mb-0">Markdown Preview</h2>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setPreviewMode((prev) => (prev === 'code' ? 'rendered' : 'code'))}
                >
                  {previewMode === 'code' ? 'Rendered Preview' : 'Code Preview'}
                </button>
              </div>

              {previewMode === 'code' ? (
                <pre className="markdown-preview flex-grow-1">{markdown || '# Empty canvas'}</pre>
              ) : (
                <div className="markdown-rendered flex-grow-1">
                  <ReactMarkdown>{markdown || '# Empty canvas'}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
