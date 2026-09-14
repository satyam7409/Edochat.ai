import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Trash2, Upload, Zap, RefreshCw, CheckCircle2,
  Copy, Check, ExternalLink, LogOut, AlertCircle, RotateCcw, Sparkles,
  Database, ArrowUpRight, Home, Pencil
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import {
  listDocuments, uploadDocument, createTextDocument, deleteDocument, getDocument, replaceDocument, replaceTextDocument,
  type Document, type DocumentCategory
} from '../api/org';
import { generateAssistant, type GenerateResult } from '../api/assistant';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────

type CategoryDef = { id: DocumentCategory; label: string };

const CATEGORIES: CategoryDef[] = [
  { id: 'SYLLABUS', label: 'Syllabus' },
  { id: 'NOTICE', label: 'Notices' },
  { id: 'FINANCE', label: 'Finance' },
  { id: 'TEST_PAPER', label: 'Test Papers' },
  { id: 'EVENTS', label: 'Events' },
  { id: 'OTHER', label: 'Other' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: Document['status']) {
  if (status === 'READY') return 'ready';
  if (status === 'FAILED') return 'failed';
  return 'processing';
}

function statusLabel(status: Document['status']) {
  if (status === 'READY') return 'Ready';
  if (status === 'FAILED') return 'Failed';
  return 'Processing';
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Generate Success Modal ───────────────────────────────────────────────────

function GenerateModal({ open, onClose, result }: { open: boolean; onClose: () => void; result: GenerateResult | null }) {
  if (!result) return null;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-7 sm:p-8 text-center">
        <div className="pop-in inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-50 ring-8 ring-emerald-50/60 mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Your assistant is live!</h2>
        <p className="text-sm text-gray-500 mb-6">Students can now ask questions via the link below.</p>

        {/* Public URL */}
        <div className="text-left mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Public link</span>
            <div className="flex gap-3">
              <CopyButton text={result.publicUrl} label="Copy link" />
              <a
                href={result.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 break-all dashboard-mono">
            {result.publicUrl}
          </div>
        </div>

        {/* Embed snippet */}
        <div className="text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Embed snippet</span>
            <CopyButton text={result.embedSnippet} label="Copy code" />
          </div>
          <div className="bg-slate-950 rounded-xl px-4 py-3 text-left overflow-x-auto shadow-inner">
            <code className="text-xs text-green-400 break-all whitespace-pre-wrap">{result.embedSnippet}</code>
          </div>
        </div>

        <Button variant="secondary" onClick={onClose} className="mt-6 w-full justify-center">
          Done
        </Button>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  loading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete document?</h3>
            <p className="text-sm text-gray-500">This will also remove all indexed content.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mb-5 font-medium truncate">
          {title}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center" disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} className="flex-1 justify-center">
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TextDocumentModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial?: Document | null; onSave: (title: string, text: string) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [text, setText] = useState(initial?.textContent ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setTitle(initial?.title ?? ''); setText(initial?.textContent ?? ''); }, [initial, open]);
  async function save() { if (!title.trim() || !text.trim()) return; setSaving(true); try { await onSave(title.trim(), text.trim()); onClose(); } finally { setSaving(false); } }
  return <Modal open={open} onClose={onClose}><div className="p-6 sm:p-7"><h2 className="text-xl font-bold text-slate-900">{initial ? 'Edit text document' : 'Add text document'}</h2><p className="mt-1 text-sm text-slate-500">Paste the content your assistant should search.</p><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" className="mt-5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste document text here…" rows={10} className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><div className="mt-4 flex gap-2"><Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button><Button onClick={save} loading={saving} disabled={!title.trim() || !text.trim()} className="flex-1 justify-center">{initial ? 'Save changes' : 'Add text'}</Button></div></div></Modal>;
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onDelete,
  onReplace,
}: {
  doc: Document;
  onDelete: (doc: Document) => void;
  onReplace: (doc: Document) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group rounded-lg">
      <div className="h-8 w-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
        <FileText className="h-4 w-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(doc.createdAt).toLocaleDateString()}
        </p>
      </div>
      <Badge variant={statusBadgeVariant(doc.status)}>
        {statusLabel(doc.status)}
      </Badge>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onReplace(doc)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          title="Replace file"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(doc)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, orgId, logout } = useAuth();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('SYLLABUS');
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState('');

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<DocumentCategory | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<Document | null>(null);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textEditTarget, setTextEditTarget] = useState<Document | null>(null);

  // Generate assistant
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [generateError, setGenerateError] = useState('');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [assistantLive, setAssistantLive] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Polling refs
  const pollingRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const orgName = user?.name ?? 'My Institution';

  // ── Load all docs ──────────────────────────────────────────────────────────

  const loadAllDocs = useCallback(async () => {
    if (!orgId) return;
    setDocsError('');
    try {
      const docs = await listDocuments(orgId);
      setAllDocs(docs);
      // Check if assistant is live (any doc is READY means we know it was generated at some point — but we track it via generate call)
    } catch (err: unknown) {
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadAllDocs();
  }, [loadAllDocs]);

  // ── Poll a single doc ──────────────────────────────────────────────────────

  function startPolling(docId: string) {
    if (!orgId) return;

    const tick = async () => {
      try {
        const updated = await getDocument(orgId, docId);
        setAllDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));

        if (updated.status === 'READY' || updated.status === 'FAILED') {
          pollingRefs.current.delete(docId);
          return; // stop polling
        }
      } catch {
        // silently retry
      }

      const timer = setTimeout(tick, 2500);
      pollingRefs.current.set(docId, timer);
    };

    const timer = setTimeout(tick, 2500);
    pollingRefs.current.set(docId, timer);
  }

  // cleanup polls on unmount
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // start polling any PROCESSING docs that were loaded initially
  useEffect(() => {
    allDocs.forEach((doc) => {
      if (doc.status === 'PROCESSING' && !pollingRefs.current.has(doc.id)) {
        startPolling(doc.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocs.length]);

  // ── Upload ─────────────────────────────────────────────────────────────────

  function handleUploadClick() {
    setUploadingFor(selectedCategory);
    fileInputRef.current?.click();
  }

  async function handleTextSave(title: string, text: string) {
    if (!orgId) return;
    if (textEditTarget) {
      await replaceTextDocument(orgId, textEditTarget.id, { title, text });
      setAllDocs(prev => prev.map(d => d.id === textEditTarget.id ? { ...d, title, sourceType: 'TEXT', status: 'PROCESSING' } : d));
      startPolling(textEditTarget.id);
    } else {
      const doc = await createTextDocument(orgId, { category: selectedCategory, title, text });
      setAllDocs(prev => [doc, ...prev]);
      startPolling(doc.id);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId || !uploadingFor) return;
    e.target.value = '';

    try {
      const newDoc = await uploadDocument(orgId, file, uploadingFor);
      setAllDocs((prev) => [newDoc, ...prev]);
      startPolling(newDoc.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Couldn't upload — please try a smaller file");
    } finally {
      setUploadingFor(null);
    }
  }

  // ── Replace ────────────────────────────────────────────────────────────────

  function handleReplaceClick(doc: Document) {
    if (doc.sourceType === 'TEXT') { setTextEditTarget(doc); setTextModalOpen(true); return; }
    setReplaceTarget(doc);
    replaceFileInputRef.current?.click();
  }

  async function handleReplaceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId || !replaceTarget) return;
    e.target.value = '';

    // Optimistically set to PROCESSING
    setAllDocs((prev) =>
      prev.map((d) => (d.id === replaceTarget.id ? { ...d, status: 'PROCESSING', title: file.name } : d))
    );

    try {
      await replaceDocument(orgId, replaceTarget.id, file);
      startPolling(replaceTarget.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Couldn't replace file");
      // reload to get actual state
      loadAllDocs();
    } finally {
      setReplaceTarget(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget || !orgId) return;
    setDeleteLoading(true);
    try {
      // Clear any active polling for this doc
      const timer = pollingRefs.current.get(deleteTarget.id);
      if (timer) { clearTimeout(timer); pollingRefs.current.delete(deleteTarget.id); }

      await deleteDocument(orgId, deleteTarget.id);
      setAllDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Generate assistant ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!orgId) return;
    setGenerateError('');
    setGenerating(true);
    try {
      const result = await generateAssistant(orgId);
      setGenerateResult(result);
      setAssistantLive(true);
      setGenerateModalOpen(true);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const categoryDocs = allDocs.filter((d) => d.category === selectedCategory);
  const readyCount = allDocs.filter((d) => d.status === 'READY').length;
  const countsByCategory = Object.fromEntries(
    CATEGORIES.map(({ id }) => [id, allDocs.filter((d) => d.category === id).length])
  );
  const canGenerate = readyCount > 0;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-shell h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-[72px] bg-white/90 backdrop-blur border-b border-slate-200/80 flex items-center px-4 sm:px-7 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => navigate('/')} title="Back to landing page" className="h-10 w-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-lg shadow-slate-900/15 hover:bg-indigo-700"><Sparkles className="h-4 w-4" /></button>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-indigo-600">Knowledge studio</p>
            <span className="font-bold text-slate-900 truncate block leading-tight">{orgName}</span>
          </div>
          <Badge variant={assistantLive ? 'live' : 'draft'}>
            {assistantLive ? 'Live' : 'Not live yet'}
          </Badge>
          <span className="text-sm text-gray-400 hidden sm:block">·</span>
          <span className="text-sm text-slate-500 hidden md:block">{readyCount} sources ready</span>
        </div>

        <div className="flex items-center gap-2">
          {generateError && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {generateError}
            </span>
          )}
          <div className="relative group">
            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={!canGenerate}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {assistantLive ? 'Regenerate' : 'Generate My Assistant'}
            </Button>
            {!canGenerate && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 pointer-events-none">
                Upload at least one document first
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button onClick={() => navigate('/')} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Home className="h-3.5 w-3.5" /> Home</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-60 bg-white/70 border-r border-slate-200/80 flex-shrink-0 py-6 overflow-y-auto hidden md:block">
          <div className="px-5 mb-6">
            <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-[0.14em]">Knowledge base</p>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">Organise the sources that power your assistant.</p>
          </div>
          <p className="px-5 text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-2">
            Library
          </p>
          <nav className="flex flex-col gap-0.5 px-2">
            {CATEGORIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === id
                    ? 'bg-slate-800 text-white shadow-sm shadow-slate-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{label}</span>
                {countsByCategory[id] > 0 && (
                  <span
                    className={`text-xs font-medium rounded-full px-1.5 py-0.5 ${
                      selectedCategory === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {countsByCategory[id]}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
            <div className="dashboard-panel mb-8 rounded-2xl bg-slate-950 px-5 py-5 sm:px-7 sm:py-6 text-white overflow-hidden relative">
              <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full bg-indigo-500/30 blur-2xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-200 text-xs font-bold uppercase tracking-[0.14em] mb-2"><Database className="h-3.5 w-3.5" /> Assistant readiness</div>
                  <p className="dashboard-serif text-2xl sm:text-3xl leading-tight">{readyCount ? 'Your knowledge base is ready.' : 'Add your first source.'}</p>
                  <p className="text-sm text-slate-300 mt-2">{readyCount ? `${readyCount} ready source${readyCount === 1 ? '' : 's'} can answer student questions.` : 'Upload a PDF and we’ll turn it into searchable answers.'}</p>
                </div>
                {assistantLive && generateResult && <a href={generateResult.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 transition-colors">Open assistant <ArrowUpRight className="h-4 w-4" /></a>}
              </div>
            </div>
            {/* Panel header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {categoryDocs.length} document{categoryDocs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2"><Button onClick={() => { setTextEditTarget(null); setTextModalOpen(true); }} variant="secondary"><Pencil className="h-4 w-4" /> Add text</Button><Button onClick={handleUploadClick} variant="secondary">
                <Upload className="h-4 w-4" />
                Upload PDF
              </Button></div>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileSelected}
            />
            <input
              ref={replaceFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleReplaceFileSelected}
            />

            {/* Docs list */}
            {docsLoading ? (
              <div className="flex justify-center py-20">
                <Spinner size="lg" />
              </div>
            ) : docsError ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-600">{docsError}</p>
                <Button variant="secondary" onClick={loadAllDocs}>
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : categoryDocs.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No documents yet</p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Upload a PDF or add text to start building your knowledge base for this category.
                </p>
                <Button variant="secondary" onClick={handleUploadClick} className="mt-1">
                  <Pencil className="h-4 w-4" />
                  Add text
                </Button>
              </div>
            ) : (
              <div className="card dashboard-panel divide-y divide-slate-100 border-slate-200/70">
                {categoryDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onDelete={setDeleteTarget}
                    onReplace={handleReplaceClick}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <GenerateModal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        result={generateResult}
      />
      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.title ?? ''}
        loading={deleteLoading}
      />
      <TextDocumentModal open={textModalOpen} onClose={() => { setTextModalOpen(false); setTextEditTarget(null); }} initial={textEditTarget} onSave={handleTextSave} />
    </div>
  );
}
