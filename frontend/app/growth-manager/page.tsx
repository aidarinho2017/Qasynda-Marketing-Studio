'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { refreshCredits } from '@/lib/credits';
import ChatPane from './components/ChatPane';
import HistoryDrawer from './components/HistoryDrawer';
import { coachApi } from './lib/coachApi';
import type {
  CoachMessage,
  CoachModule,
  ConversationOut,
  ConversationSummary,
} from './lib/coachTypes';

export default function GrowthManagerPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeConvo, setActiveConvo] = useState<ConversationOut | null>(null);
  const [module, setModule] = useState<CoachModule>('foundation');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const refreshList = useCallback(async () => {
    try {
      const res = await coachApi.list();
      setConversations(res.items);
      return res.items;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Load full conversation when selection changes.
  useEffect(() => {
    setAnimatingMessageId(null);
    if (!selectedId) {
      setActiveConvo(null);
      return;
    }
    void (async () => {
      try {
        const c = await coachApi.get(selectedId);
        setActiveConvo(c);
        setModule(c.current_module);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation.');
      }
    })();
  }, [selectedId]);

  const handleNew = () => {
    setError(null);
    setSelectedId(null);
    setActiveConvo(null);
    setModule('foundation');
    setDrawerOpen(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await coachApi.remove(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setActiveConvo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete conversation.');
    }
  };

  const handleSend = async (message: string, sendModule: CoachModule) => {
    setError(null);

    let convoId = selectedId;
    if (!convoId) {
      try {
        const c = await coachApi.create(sendModule);
        convoId = c.id;
        setConversations((prev) => [
          {
            id: c.id,
            title: c.title,
            current_module: c.current_module,
            last_message_at: c.last_message_at,
            updated_at: c.updated_at,
          },
          ...prev,
        ]);
        setSelectedId(c.id);
        setActiveConvo(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start conversation.');
        return;
      }
    }

    const optimisticUser: CoachMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: message,
      structured_output: null,
      module: sendModule,
      created_at: new Date().toISOString(),
    };
    setActiveConvo((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
    );
    setModule(sendModule);
    setSending(true);

    try {
      await coachApi.send(convoId!, message, sendModule);
      const fresh = await coachApi.get(convoId!);
      setActiveConvo(fresh);
      setModule(fresh.current_module);
      const lastAssistant = [...fresh.messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) setAnimatingMessageId(lastAssistant.id);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId
            ? {
                ...c,
                title: fresh.title,
                current_module: fresh.current_module,
                last_message_at: fresh.last_message_at,
                updated_at: fresh.updated_at,
              }
            : c,
        ),
      );
      await refreshCredits();
    } catch (err) {
      setActiveConvo((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticUser.id) }
          : prev,
      );
      setError(err instanceof Error ? err.message : 'The coach could not reply. Try again.');
    } finally {
      setSending(false);
    }
  };

  const messages = activeConvo?.messages ?? [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar showUserMenu />

      <HistoryDrawer
        open={drawerOpen}
        conversations={conversations}
        selectedId={selectedId}
        loading={loadingList}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => setSelectedId(id)}
        onCreate={handleNew}
        onDelete={handleDelete}
      />

      <main className="flex-1 flex flex-col pt-16 min-h-0">
        <div className="border-b border-gray-100 bg-white">
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 h-12 flex items-center justify-between">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open history"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-3">
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </div>
          </div>
        )}

        <ChatPane
          messages={messages}
          module={module}
          onSend={handleSend}
          sending={sending}
          animatingMessageId={animatingMessageId}
        />
      </main>
    </div>
  );
}
