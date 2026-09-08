import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Trash2, Upload, Zap, RefreshCw, CheckCircle2,
  Copy, Check, ExternalLink, LogOut, AlertCircle, RotateCcw
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import {
  listDocuments, uploadDocument, deleteDocument, getDocument, replaceDocument,
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
      <div className="p-8 text-center">
        <div className="pop-in inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-50 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
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
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 break-all font-mono">
            {result.publicUrl}
          </div>
        </div>

        {/* Embed snippet */}
        <div className="text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Embed snippet</span>
            <CopyButton text={result.embedSnippet} label="Copy code" />
          </div>
          <div className="bg-gray-900 rounded-lg px-4 py-3 text-left overflow-x-auto">
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

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  orgId,
  onDelete,
  onReplace,
}: {
  doc: Document;
  orgId: string;
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-gray-900 truncate">{orgName}</span>
          <Badge variant={assistantLive ? 'live' : 'draft'}>
            {assistantLive ? 'Live' : 'Not live yet'}
          </Badge>
          <span className="text-sm text-gray-400 hidden sm:block">·</span>
          <span className="text-sm text-gray-500 hidden sm:block">{readyCount} docs ready</span>
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
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-100 flex-shrink-0 py-4 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Categories
          </p>
          <nav className="flex flex-col gap-0.5 px-2">
            {CATEGORIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span>{label}</span>
                {countsByCategory[id] > 0 && (
                  <span
                    className={`text-xs font-medium rounded-full px-1.5 py-0.5 ${
                      selectedCategory === id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
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
          <div className="max-w-3xl mx-auto px-6 py-6">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {categoryDocs.length} document{categoryDocs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={handleUploadClick} variant="secondary">
                <Upload className="h-4 w-4" />
                Upload PDF
              </Button>
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
                  Upload a PDF to start building your knowledge base for this category.
                </p>
                <Button variant="secondary" onClick={handleUploadClick} className="mt-1">
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </Button>
              </div>
            ) : (
              <div className="card divide-y divide-gray-50">
                {categoryDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    orgId={orgId!}
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
    </div>
  );
}
