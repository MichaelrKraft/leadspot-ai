'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, Mail, Phone, Tag, MoreVertical, RefreshCw, Upload, Download, UserPlus, X, CheckCircle } from 'lucide-react';
import { listContacts, createContact, updateContact, deleteContact, type Contact, type ContactCreateData } from '@/lib/api/contacts';
import { listSegments, updateSegment, type Segment } from '@/lib/api/segments';

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

function parseCSVContacts(text: string): ContactCreateData[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const raw = lines[0].replace(/\r/, '');
  const headers = raw.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  return lines.slice(1)
    .map(line => {
      const values = line.replace(/\r/, '').split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });

      return {
        firstName: row['first name'] || row['firstname'] || row['first_name'] || '',
        lastName: row['last name'] || row['lastname'] || row['last_name'] || '',
        email: row['email'] || '',
        company: row['company'] || undefined,
        phone: row['phone'] || undefined,
        tags: row['tags'] ? row['tags'].split(';').map(t => t.trim()).filter(Boolean) : [],
      } as ContactCreateData;
    })
    .filter(c => c.email && c.firstName);
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  // Add contact modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', company: '', phone: '', tags: '' });

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ContactCreateData[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);

  // View details / edit modal
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [editFields, setEditFields] = useState({ firstName: '', lastName: '', email: '', company: '', phone: '', tags: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Add to segment modal
  const [addToSegmentContact, setAddToSegmentContact] = useState<Contact | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

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

  // --- Import handlers ---
  const handleFileSelect = (file: File) => {
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportPreview(parseCSVContacts(text));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile || importPreview.length === 0) return;
    setIsImporting(true);
    let imported = 0;
    let failed = 0;
    for (const contact of importPreview) {
      try {
        await createContact(contact);
        imported++;
      } catch {
        failed++;
      }
    }
    setImportResult({ imported, failed });
    setIsImporting(false);
    if (imported > 0) {
      await loadContacts(searchQuery || undefined);
      showToast(`Imported ${imported} contact${imported !== 1 ? 's' : ''}!`);
    }
  };

  // --- View/edit contact handlers ---
  const openViewContact = (contact: Contact) => {
    setViewingContact(contact);
    setEditFields({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      company: contact.company || '',
      phone: contact.phone || '',
      tags: contact.tags.join(', '),
    });
  };

  const handleSaveContact = async () => {
    if (!viewingContact) return;
    setIsSaving(true);
    try {
      await updateContact(viewingContact.id, {
        firstName: editFields.firstName,
        lastName: editFields.lastName,
        email: editFields.email,
        company: editFields.company || undefined,
        phone: editFields.phone || undefined,
        tags: editFields.tags ? editFields.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      setViewingContact(null);
      await loadContacts(searchQuery || undefined);
      showToast('Contact updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Add to segment handlers ---
  const openAddToSegment = async (contact: Contact) => {
    setAddToSegmentContact(contact);
    setSegmentsLoading(true);
    try {
      const data = await listSegments();
      setSegments(data.segments);
    } catch {
      setSegments([]);
    } finally {
      setSegmentsLoading(false);
    }
  };

  const handleAddToSegment = async (segment: Segment) => {
    if (!addToSegmentContact) return;
    try {
      await updateSegment(segment.id, { contact_count: segment.contact_count + 1 });
      setAddToSegmentContact(null);
      showToast(`Added to "${segment.name}"!`);
    } catch {
      showToast('Failed to add to segment.');
    }
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{toast}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Synced from your CRM</p>
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
            onClick={() => { setImportFile(null); setImportPreview([]); setImportResult(null); setShowImportModal(true); }}
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
          <button
            onClick={() => loadContacts(searchQuery || undefined)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-500/20 hover:from-primary-600 hover:to-primary-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Sync
          </button>
        </div>
      </div>

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

      {isLoading && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading contacts...</div>
      )}

      {!isLoading && (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-800/50 dark:bg-zinc-900">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Company</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Tags</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Points</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Last Active</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-800/50">
                {contacts.map((contact) => (
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
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{contact.company || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${contact.points >= 100 ? 'text-green-600 dark:text-green-400' : contact.points >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {contact.points}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{contact.lastActive || '-'}</td>
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
                            onClick={() => { setOpenMenuId(null); openAddToSegment(contact); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                          >
                            Add to segment
                          </button>
                          <button
                            onClick={() => { setOpenMenuId(null); openViewContact(contact); }}
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

          {contacts.length === 0 && (
            <div className="text-center py-16">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                {searchQuery ? 'No contacts found' : 'No contacts yet'}
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {searchQuery ? 'Try a different search term' : 'Add your first contact.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Add Contact Modal ── */}
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
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500">Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Import Contacts</h2>
              <button onClick={() => setShowImportModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!importResult ? (
              <>
                <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">
                  Upload a CSV file with columns: <code className="rounded bg-slate-100 px-1 dark:bg-zinc-800">First Name, Last Name, Email, Phone, Company, Tags</code>
                </p>
                <div
                  className="mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-zinc-700 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.csv')) handleFileSelect(file);
                  }}
                >
                  <Upload className="mb-2 h-8 w-8 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {importFile ? importFile.name : 'Click or drag a CSV file here'}
                  </p>
                  {importFile && importPreview.length > 0 && (
                    <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
                      {importPreview.length} contact{importPreview.length !== 1 ? 's' : ''} ready to import
                    </p>
                  )}
                  {importFile && importPreview.length === 0 && (
                    <p className="mt-1 text-sm text-red-500">No valid contacts found — check column headers</p>
                  )}
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowImportModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                  <button
                    onClick={handleImport}
                    disabled={importPreview.length === 0 || isImporting}
                    className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? 'Importing…' : `Import ${importPreview.length > 0 ? importPreview.length : ''} Contacts`}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Import Complete</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  {importResult.imported} imported{importResult.failed > 0 ? `, ${importResult.failed} failed` : ''}
                </p>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View / Edit Contact Modal ── */}
      {viewingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact Details</h2>
              <button onClick={() => setViewingContact(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">First Name</label>
                  <input value={editFields.firstName} onChange={e => setEditFields(p => ({ ...p, firstName: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Last Name</label>
                  <input value={editFields.lastName} onChange={e => setEditFields(p => ({ ...p, lastName: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email</label>
                <input type="email" value={editFields.email} onChange={e => setEditFields(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Company</label>
                  <input value={editFields.company} onChange={e => setEditFields(p => ({ ...p, company: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Phone</label>
                  <input value={editFields.phone} onChange={e => setEditFields(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Tags <span className="text-slate-400 font-normal">(comma separated)</span></label>
                <input value={editFields.tags} onChange={e => setEditFields(p => ({ ...p, tags: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-sm text-slate-500 dark:text-zinc-400">
                Lead score: <span className="font-semibold text-slate-700 dark:text-zinc-200">{viewingContact.points} pts</span>
                {viewingContact.lastActive && <> &bull; Last active: {viewingContact.lastActive}</>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setViewingContact(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                <button onClick={handleSaveContact} disabled={isSaving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-50">
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add to Segment Modal ── */}
      {addToSegmentContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add to Segment</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">{addToSegmentContact.firstName} {addToSegmentContact.lastName}</p>
              </div>
              <button onClick={() => setAddToSegmentContact(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {segmentsLoading ? (
              <div className="py-8 text-center text-slate-500 dark:text-zinc-400">Loading segments…</div>
            ) : segments.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-zinc-400">
                No segments yet. Create one on the Segments page first.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {segments.map((segment) => (
                  <button
                    key={segment.id}
                    onClick={() => handleAddToSegment(segment)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{segment.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-zinc-500">{segment.contact_count} contacts</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button onClick={() => setAddToSegmentContact(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
