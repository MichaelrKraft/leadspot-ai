'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Pencil, Phone, Tag } from 'lucide-react';
import { getContact, type Contact } from '@/lib/api/contacts';
import ActivityTimeline from '@/components/timeline/ActivityTimeline';

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = params?.id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getContact(contactId)
      .then((c) => {
        if (!cancelled) setContact(c);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contact');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (!contactId) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Link>

      {/* Top bar */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {isLoading ? (
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
          ) : contact ? (
            <>
              <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {contact.firstName} {contact.lastName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-zinc-400">
                {contact.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="break-all">{contact.email}</span>
                  </span>
                )}
                {contact.company && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {contact.company}
                  </span>
                )}
              </div>
            </>
          ) : (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contact not found</h1>
          )}
        </div>

        <button
          type="button"
          disabled={!contact}
          // Edit modal placeholder — wire up to existing edit modal in a follow-up.
          onClick={() => {
            if (typeof window !== 'undefined' && contact) {
              window.alert('Edit contact: opens existing edit modal (TODO).');
            }
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Two-column on ≥880px (custom breakpoint via min-w in CSS); on smaller screens, stack. */}
      <div className="mt-6 grid grid-cols-1 gap-6 [@media(min-width:880px)]:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Info card */}
        <aside className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800/50 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Contact info
          </h2>
          {isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
            </div>
          ) : contact ? (
            <dl className="mt-4 space-y-4 text-sm">
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact.email} mono />
              <Field
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Company"
                value={contact.company || '—'}
              />
              <Field
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Phone"
                value={contact.phone || '—'}
              />
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {contact.tags.length === 0 ? (
                    <span className="text-sm text-slate-400 dark:text-zinc-500">—</span>
                  ) : (
                    contact.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/60">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Lead score
                </div>
                <div
                  className={`mt-0.5 text-lg font-semibold ${
                    contact.points >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : contact.points >= 50
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-slate-700 dark:text-zinc-200'
                  }`}
                >
                  {contact.points} pts
                </div>
                {contact.lastActive && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Last active: {contact.lastActive}
                  </div>
                )}
              </div>
            </dl>
          ) : null}
        </aside>

        {/* Activity timeline */}
        <section className="min-w-0">
          <ActivityTimeline contactId={contactId} />
        </section>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 break-words text-sm text-slate-800 dark:text-zinc-100 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
