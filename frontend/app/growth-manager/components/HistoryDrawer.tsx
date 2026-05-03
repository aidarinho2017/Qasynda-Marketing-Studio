'use client';

import { useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { ConversationSummary } from '../lib/coachTypes';

interface Props {
  open: boolean;
  conversations: ConversationSummary[];
  selectedId: string | null;
  loading?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export default function HistoryDrawer({
  open,
  conversations,
  selectedId,
  loading,
  onClose,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        aria-label="Conversation history"
        className={`fixed top-0 left-0 z-50 h-full w-72 sm:w-80 bg-white border-r border-gray-100 shadow-xl flex flex-col transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">History</p>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-gray-100">
          <button
            onClick={() => {
              onCreate();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading && conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
          )}
          {!loading && conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 px-4 leading-relaxed">
              No conversations yet. Start one above.
            </p>
          )}
          {conversations.map((c) => {
            const active = c.id === selectedId;
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  active ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      active ? 'font-semibold text-brand-700' : 'text-gray-900'
                    }`}
                  >
                    {c.title}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this conversation?')) onDelete(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
