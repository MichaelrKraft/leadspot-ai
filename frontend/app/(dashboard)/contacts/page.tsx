'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, Mail, Phone, Tag, MoreVertical, RefreshCw, Upload, Download, UserPlus, X, CheckCircle } from 'lucide-react';
import { listContacts, createContact, deleteContact, type Contact } from '@/lib/api/contacts';

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}

function exportContactsToCSV(contacts: Contact[]) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Tags', 'Points'];
  const rows = contacts.map(c => [
    c.firstName,
    c.lastName,
    c.email,
    c.phone || '',
    c.company || '',
    c.tags.join('; '),
    String(c.points),
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', company: '', phone: '', tags: '' });
  const { toast, showToast } = useToast();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadContacts = useCallback(async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listContacts({ search: search || undefined });
      setContacts(data.contacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load contacts on mount and when search changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = searchQuery ? 300 : 0;
    debounceRef.current = setTimeout(() => {
      loadContacts(searchQuery || undefined);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, loadContacts]);

  const filteredContacts = contacts;

  return (
    <div className="p-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{toast}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Contacts
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isConnected
              ? 'Synced from your CRM'
              : 'Connect your CRM to sync contacts'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add Contact
          </button>
          <button
            onClick={() => showToast('Import contacts — coming soon!')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={() => { exportContactsToCSV(contacts); showToast('Contacts exported to CSV!'); }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-500/20 hover:from-primary-600 hover:to-primary-500 transition-colors">
            <RefreshCw className="h-4 w-4" />
            Sync
          </button>
        </div>
      </div>

      {/* Connection Warning */}
      {!isConnected && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                CRM not connected
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Go to Settings → Integrations to connect your CRM and sync contacts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-800/50 dark:bg-zinc-900 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          Loading contacts...
        </div>
      )}

      {/* Contacts Table */}
      {!isLoading && (<>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-800/50 dark:bg-zinc-900">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Company
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Tags
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Points
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Last Active
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-800/50">
            {filteredContacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                  {contact.company || '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`font-medium ${
                    contact.points >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : contact.points >= 50
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {contact.points}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {contact.lastActive || '-'}
                </td>
                <td className="px-6 py-4 relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === contact.id ? null : contact.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {openMenuId === contact.id && (
                    <div className="absolute right-6 top-12 z-50 w-48 rounded-xl border border-slate-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 shadow-lg py-1">
                      <button
                        onClick={() => { setOpenMenuId(null); window.location.href = `/command-center`; }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                      >
                        Chat about contact
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuId(null);
                          if (contact.email) {
                            window.location.href = `mailto:${contact.email}`;
                          } else {
                            showToast('No email address on file for this contact.');
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                      >
                        Send email
                      </button>
                      <button
                        onClick={() => { setOpenMenuId(null); showToast('Add to segment — coming soon!'); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                      >
                        Add to segment
                      </button>
                      <button
                        onClick={() => { setOpenMenuId(null); showToast('Contact detail page — coming soon!'); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                      >
                        View Details
                      </button>
                      <button
                        onClick={async () => {
                          setOpenMenuId(null);
                          try {
                            await deleteContact(contact.id);
                            await loadContacts(searchQuery || undefined);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to delete contact');
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <div className="text-center py-16">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            {searchQuery ? 'No contacts found' : 'No contacts yet'}
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {searchQuery
              ? 'Try a different search term'
              : 'Add your first contact.'}
          </p>
        </div>
      )}
      </>)}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Contact</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await createContact({
                    firstName: newContact.firstName,
                    lastName: newContact.lastName,
                    email: newContact.email,
                    company: newContact.company || undefined,
                    phone: newContact.phone || undefined,
                    tags: newContact.tags ? newContact.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                  });
                  setNewContact({ firstName: '', lastName: '', email: '', company: '', phone: '', tags: '' });
                  setShowAddModal(false);
                  await loadContacts(searchQuery || undefined);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create contact');
                  setShowAddModal(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">First Name *</label>
                  <input required value={newContact.firstName} onChange={e => setNewContact(p => ({ ...p, firstName: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Last Name *</label>
                  <input required value={newContact.lastName} onChange={e => setNewContact(p => ({ ...p, lastName: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email *</label>
                <input required type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Company</label>
                  <input value={newContact.company} onChange={e => setNewContact(p => ({ ...p, company: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Phone</label>
                  <input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Tags <span className="text-slate-400 font-normal">(comma separated)</span></label>
                <input placeholder="hot-lead, enterprise" value={newContact.tags} onChange={e => setNewContact(p => ({ ...p, tags: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500">
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
