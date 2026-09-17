import { useState, useEffect, useRef, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Send, BookOpen, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";
import { getChatConfig, streamMessage } from "../api/chat";
import { Spinner } from "../components/ui/Spinner";

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 max-w-[min(88%,680px)]">
      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
      </div>
        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1 shadow-sm">
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot h-2 w-2 rounded-full bg-gray-400 block" />
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[min(82%,680px)] text-[15px] leading-7 shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "error") {
    return (
      <div className="flex items-start gap-3 max-w-[min(88%,680px)]">
        <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-red-700 leading-6">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 max-w-[min(88%,680px)]">
      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3.5 text-[15px] text-slate-800 leading-7 shadow-sm whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
}

export function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [assistantName, setAssistantName] = useState("Campus Assistant");
  const [publicSiteKey, setPublicSiteKey] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    slug
      ? (sessionStorage.getItem(`chat-session:${slug}`) ?? undefined)
      : undefined,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load config + greeting on mount
  useEffect(() => {
    if (!slug) return;
    getChatConfig(slug)
      .then(({ assistantName: name, greeting, publicSiteKey: key }) => {
        setAssistantName(name);
        setPublicSiteKey(
          new URLSearchParams(window.location.search).get("key") ?? key,
        );
        setMessages([{ id: "greeting", role: "assistant", content: greeting }]);
      })
      .catch((err: unknown) => {
        setConfigError(
          err instanceof Error
            ? err.message
            : "This assistant is not available right now.",
        );
      })
      .finally(() => setConfigLoading(false));
  }, [slug]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading || !slug || !publicSiteKey) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setLoading(true);

    // FIX: track whether the first token has arrived yet, so the typing
    // indicator stays visible through retrieval + time-to-first-token
    // instead of disappearing before any bubble actually has content.
    const assistantId = crypto.randomUUID();
    let firstTokenReceived = false;

    try {
      const response = await streamMessage(
        slug,
        question,
        publicSiteKey,
        (token) => {
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            setTyping(false);
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: token },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + token }
                  : message,
              ),
            );
          }
        },
        sessionId,
      );

      // FIX: safety fallback — if for any reason no "token" events arrived
      // before "done" (e.g. a future backend change or an edge case), make
      // sure the bubble still ends up showing the final answer instead of
      // rendering empty. Also creates the bubble if it was never created.
      setMessages((prev) => {
        const alreadyHasBubble = prev.some((m) => m.id === assistantId);
        if (!alreadyHasBubble) {
          return [...prev, { id: assistantId, role: "assistant", content: response.answer }];
        }
        return prev.map((m) =>
          m.id === assistantId && !m.content ? { ...m, content: response.answer } : m,
        );
      });

      setSessionId(response.sessionId);
      sessionStorage.setItem(`chat-session:${slug}`, response.sessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      const errText = message.toLowerCase().includes("monthly question limit")
        ? message
        : message.toLowerCase().includes("too many questions")
          ? "You're sending messages too fast. Please wait a moment and try again."
          : "Couldn't get a response right now. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "error", content: errText },
      ]);
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
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          Assistant not available
        </h1>
        <p className="text-sm text-gray-500 max-w-xs">{configError}</p>
      </div>
    );
  }

  // ── Chat UI ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fb] text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/95 px-4 py-3.5 shadow-sm backdrop-blur safe-area-top sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-950 shadow-lg shadow-slate-900/10">
          <BookOpen
            className="h-4.5 w-4.5 text-white"
            style={{ width: 18, height: 18 }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-slate-900 sm:text-[15px]">
            {assistantName}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            Ready to help with campus information
          </p>
        </div>
        <div className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 sm:flex"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Official assistant</div>
        </div>
      </header>

      {/* Messages */}
      <div className="w-full flex-1 overflow-y-auto px-3 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {messages.length === 1 && messages[0].role === 'assistant' && <div className="mb-1 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 sm:p-5"><div className="flex items-center gap-2 text-sm font-bold text-indigo-900"><Sparkles className="h-4 w-4 text-indigo-600" /> Ask about your institution</div><p className="mt-1 text-sm leading-6 text-indigo-900/70">Get clear answers from the information published by your school or college.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setInput('When does the semester begin?')} className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Academic calendar</button><button onClick={() => setInput('What are the fee payment details?')} className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Fee details</button><button onClick={() => setInput('What events are coming up?')} className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Upcoming events</button></div></div>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200/80 bg-white px-3 py-3.5 shadow-[0_-8px_24px_-20px_rgba(15,23,42,.35)] safe-area-bottom sm:px-6 sm:py-4">
        <form
          onSubmit={handleSend}
          className="mx-auto flex w-full max-w-4xl items-end gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={loading}
            className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder-slate-400 outline-none transition-shadow focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}