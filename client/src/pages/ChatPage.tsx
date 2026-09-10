import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Send, BookOpen, AlertCircle } from 'lucide-react';
import { getChatConfig, sendMessage } from '../api/chat';
import { Spinner } from '../components/ui/Spinner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 max-w-xs">
      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-xs sm:max-w-sm text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === 'error') {
    return (
      <div className="flex items-start gap-2 max-w-xs sm:max-w-sm">
        <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-red-700 leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 max-w-xs sm:max-w-sm">
      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed">
        {msg.content}
      </div>
    </div>
  );
}

export function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [assistantName, setAssistantName] = useState('Campus Assistant');
  const [publicSiteKey, setPublicSiteKey] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(() => slug ? sessionStorage.getItem(`chat-session:${slug}`) ?? undefined : undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load config + greeting on mount
  useEffect(() => {
    if (!slug) return;
    getChatConfig(slug)
      .then(({ assistantName: name, greeting, publicSiteKey: key }) => {
        setAssistantName(name);
        setPublicSiteKey(new URLSearchParams(window.location.search).get('key') ?? key);
        setMessages([{ id: 'greeting', role: 'assistant', content: greeting }]);
      })
      .catch((err: unknown) => {
        setConfigError(
          err instanceof Error ? err.message : 'This assistant is not available right now.'
        );
      })
      .finally(() => setConfigLoading(false));
  }, [slug]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading || !slug || !publicSiteKey) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setLoading(true);

    try {
      const response = await sendMessage(slug, question, publicSiteKey, sessionId);
      setSessionId(response.sessionId);
      sessionStorage.setItem(`chat-session:${slug}`, response.sessionId);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.answer }]);
    } catch (err: unknown) {
      const errText =
        err instanceof Error && err.message.includes('429')
          ? "You're sending messages too fast. Please wait a moment and try again."
          : "Couldn't get a response right now. Please try again.";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'error', content: errText }]);
    } finally {
      setTyping(false);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ── Config error state ─────────────────────────────────────────────────────
  if (configLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Assistant not available</h1>
        <p className="text-sm text-gray-500 max-w-xs">{configError}</p>
      </div>
    );
  }

  // ── Chat UI ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 safe-area-top">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">{assistantName}</h1>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            Online
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 safe-area-bottom">
        <form onSubmit={handleSend} className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow disabled:opacity-60"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
