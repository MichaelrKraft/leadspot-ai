'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSmartLists,
  evaluateSmartList,
  markContactActedUpon,
} from '@/lib/api/agent';
import type { SmartList, SmartListContact, SmartListResult } from '@/lib/api/agent';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.low}`}
    >
      {priority}
    </span>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-slate-400 text-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      <span>Evaluating smart list...</span>
    </div>
  );
}

function SmartListZeroBanner({ acted, total }: { acted: number; total: number }) {
  const isComplete = total > 0 && acted >= total;
  const pct = total > 0 ? Math.round((acted / total) * 100) : 0;

  if (isComplete) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-center">
        <p className="text-lg font-semibold text-green-400">
          Smart List Zero achieved!
        </p>
        <p className="mt-1 text-sm text-green-400/70">
          All {total} contacts acted upon today.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#283347] px-5 py-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-200">Smart List Zero</span>
        <span className="text-slate-400">
          {acted} of {total} completed today
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getContactName(contact: SmartListContact): string {
  const first = contact.firstName || (contact as Record<string, unknown>).name || '';
  const last = contact.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || contact.contactId;
}

function getContactScore(contact: SmartListContact): number {
  return contact.score ?? (contact as Record<string, unknown>).leadScore as number ?? 0;
}

function getContactDays(contact: SmartListContact): number {
  return contact.lastContactDays ?? (contact as Record<string, unknown>).daysSinceLastContact as number ?? 0;
}

function ContactCard({
  contact,
  listId,
  onMarked,
}: {
  contact: SmartListContact;
  listId: string;
  onMarked: (contactId: string) => void;
}) {
  const [marking, setMarking] = useState(false);
  const actedUpon = (contact as Record<string, unknown>).actedUpon as boolean | undefined;

  const handleMarkDone = async () => {
    setMarking(true);
    try {
      await markContactActedUpon(listId, contact.contactId);
      onMarked(contact.contactId);
    } catch (err) {
      console.error('Failed to mark contact:', err);
    } finally {
      setMarking(false);
    }
  };

  const name = getContactName(contact);
  const score = getContactScore(contact);
  const days = getContactDays(contact);

  return (
    <div className="group rounded-xl border border-white/10 bg-[#283347] p-4 transition-all hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-sm font-semibold text-white">
              {name}
            </h3>
            <PriorityBadge priority={contact.priority} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            {contact.email && <span>{contact.email}</span>}
            {contact.phone && <span>{contact.phone}</span>}
          </div>

          {contact.suggestedAction && (
            <p className="mt-2.5 text-sm leading-relaxed text-indigo-300/80">
              {contact.suggestedAction}
            </p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>Score: {score}</span>
            <span>
              {days === 0
                ? 'Contacted today'
                : `${days}d since last contact`}
            </span>
          </div>
        </div>

        <button
          onClick={handleMarkDone}
          disabled={marking || actedUpon === true}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            actedUpon
              ? 'cursor-default bg-green-500/15 text-green-400'
              : marking
                ? 'cursor-wait bg-slate-700 text-slate-500'
                : 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 active:bg-indigo-500/35'
          }`}
        >
          {actedUpon ? 'Done' : marking ? '...' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}

export default function SmartListsPage() {
  const [lists, setLists] = useState<SmartList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [result, setResult] = useState<SmartListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSmartLists()
      .then((data) => {
        setLists(data);
        if (data.length > 0) {
          setSelectedListId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch smart lists:', err);
        setError('Failed to load smart lists. Is the agent service running?');
      })
      .finally(() => setLoading(false));
  }, []);

  const evaluateSelected = useCallback(async (listId: string) => {
    setEvaluating(true);
    setError(null);
    try {
      const data = await evaluateSmartList(listId);
      setResult(data);
    } catch (err) {
      console.error('Failed to evaluate smart list:', err);
      setError('Failed to evaluate smart list.');
      setResult(null);
    } finally {
      setEvaluating(false);
    }
  }, []);

  useEffect(() => {
    if (selectedListId) {
      evaluateSelected(selectedListId);
    }
  }, [selectedListId, evaluateSelected]);

  const handleContactMarked = (contactId: string) => {
    if (!result) return;
    const contacts = result.contacts.map((c: SmartListContact) =>
      c.contactId === contactId ? { ...c, actedUpon: true } : c
    );
    const actedCount = (result.completedToday ?? 0) + 1;
    setResult({ ...result, contacts, completedToday: actedCount });
  };

  const completedToday = result?.completedToday ?? 0;
  const totalContacts = result?.total ?? 0;
  const allContacts = result?.contacts ?? [];
  const activeContacts = allContacts.filter((c: Record<string, unknown>) => !c.actedUpon);
  const doneContacts = allContacts.filter((c: Record<string, unknown>) => c.actedUpon);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Smart Lists</h1>
        <p className="mt-1 text-sm text-slate-400">
          AI-prioritized contacts -- work toward Smart List Zero.
        </p>
      </div>

      {/* Smart List Zero Progress */}
      {result && !loading && (
        <div className="mb-6">
          <SmartListZeroBanner acted={completedToday} total={totalContacts} />
        </div>
      )}

      {/* List Tabs */}
      {lists.length > 0 && (
        <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#283347] p-1.5">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setSelectedListId(list.id)}
              className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedListId === list.id
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:bg-[#283347] hover:text-slate-200'
              }`}
            >
              {list.name}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {(loading || evaluating) && <LoadingSpinner />}

      {/* Empty State */}
      {!loading && lists.length === 0 && !error && (
        <div className="rounded-xl border border-white/10 bg-[#283347] px-5 py-16 text-center">
          <p className="text-lg font-medium text-slate-400">No smart lists yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Smart lists will appear once the agent service creates them.
          </p>
        </div>
      )}

      {/* Contact Cards */}
      {!loading && !evaluating && result && selectedListId && (
        <div className="space-y-3">
          {activeContacts.length === 0 && doneContacts.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-[#283347] px-5 py-12 text-center">
              <p className="text-slate-400">No contacts match this smart list.</p>
            </div>
          )}

          {activeContacts.map((contact: SmartListContact) => (
            <ContactCard
              key={contact.contactId}
              contact={contact}
              listId={selectedListId}
              onMarked={handleContactMarked}
            />
          ))}

          {doneContacts.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-medium text-slate-500">
                  Completed ({doneContacts.length})
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              {doneContacts.map((contact: SmartListContact) => (
                <div key={contact.contactId} className="opacity-50">
                  <ContactCard
                    contact={contact}
                    listId={selectedListId}
                    onMarked={handleContactMarked}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
