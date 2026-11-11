"use client";

import { useEffect, useRef, useState } from "react";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  preview: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
}

export function ChatPanel({ readingId }: { readingId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadConversations() {
    const response = await fetch(`/api/v1/conversations?readingId=${readingId}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const list = (payload.data.conversations ?? []) as Conversation[];
      setConversations(list);
      if (!conversationId && list.length > 0) {
        await openConversation(list[0].id);
      }
    }
  }

  async function openConversation(id: string) {
    setConversationId(id);
    const response = await fetch(`/api/v1/conversations/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setMessages(payload.data.messages ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversations();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  async function send() {
    const text = question.trim();
    if (!text || streaming) return;
    setStreaming(true);
    setError(null);
    setQuestion("");

    const optimistic: Message = { id: `temp-${Date.now()}`, role: "user", content: text };
    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [...current, optimistic, { id: assistantId, role: "assistant", content: "" }]);

    try {
      let id = conversationId;
      if (!id) {
        const created = await fetch("/api/v1/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readingId, title: text.slice(0, 80) }),
        });
        const payload = await created.json().catch(() => ({}));
        if (!created.ok) {
          setError(payload?.error?.message ?? "The conversation could not be started.");
          setMessages((current) => current.filter((message) => message.id !== assistantId));
          return;
        }
        id = payload.data.id as string;
        setConversationId(id);
      }

      const response = await fetch(`/api/v1/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "The assistant could not answer just now.");
        setMessages((current) => current.filter((message) => message.id !== assistantId));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? { ...message, content: answer } : message)),
        );
      }
      void loadConversations();
    } catch {
      setError("The network interrupted the answer. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section id="ask" className="no-print card card-pad scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Ask about your reading</p>
          <h2 className="mt-2 font-serif text-2xl text-[#10152b]">A grounded conversation.</h2>
          <p className="mt-2 max-w-xl text-[0.82rem] leading-relaxed text-[#6b6785]">
            The assistant answers only from this report. It cannot add palm lines, planets or numbers that
            are not already there.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setConversationId(null);
            setMessages([]);
            setError(null);
          }}
        >
          New conversation
        </button>
      </div>

      {conversations.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {conversations.slice(0, 6).map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`badge ${conversation.id === conversationId ? "badge-royal" : "badge-muted"}`}
              onClick={() => void openConversation(conversation.id)}
            >
              {conversation.title.slice(0, 36)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[#fbf9f4] p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-[0.85rem] font-medium text-[#4b4866]">Ask a specific question about your report.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {["What does my Life Path number mean?", "Which limitations apply to my chart?", "How do the methods differ?"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-[var(--line-strong)] bg-white px-3 py-1.5 text-[0.72rem] text-[#4b4866] hover:border-[rgba(103,70,200,.4)]"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.82rem] leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-[#22205a] text-[#faf7f0]"
                : "border border-[var(--line)] bg-white text-[#37344e]"
            }`}
          >
            {message.content || (streaming ? "…" : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-[#f2c9c1] bg-[#fff4f2] px-3 py-2 text-[0.76rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          className="textarea flex-1"
          rows={2}
          maxLength={1200}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about a section, a number or a limitation…"
          aria-label="Ask a question about your report"
        />
        <button type="submit" className="btn btn-primary sm:self-end" disabled={streaming || !question.trim()}>
          {streaming ? "Answering…" : "Ask"}
        </button>
      </form>
      <p className="mt-2 text-[0.68rem] text-[#8a86a0]">
        Follow-up questions use AI processing consent. Conversations are saved to your account and can be
        deleted with the reading.
      </p>
    </section>
  );
}
