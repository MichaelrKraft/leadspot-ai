'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

interface MauticContact {
  id: number;
  fields: {
    all: {
      email?: string;
      firstname?: string;
      lastname?: string;
      phone?: string;
      [key: string]: string | undefined;
    };
  };
  dateAdded: string;
  dateModified: string;
  points: number;
}

interface ContactsResponse {
  contacts: MauticContact[];
  total: number;
  error?: string;
}

export default function ContactsPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [contacts, setContacts] = useState<MauticContact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchContacts = async (search?: string, page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', pageSize.toString());
      params.set('start', ((page - 1) * pageSize).toString());

      const response = await fetch(`/api/mautic/contacts?${params.toString()}`);
      const data: ContactsResponse = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        setError(data.error || 'Authentication required');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch contacts');
      }

      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setNeedsAuth(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchContacts(searchQuery, 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchContacts(searchQuery, page);
  };

  const connectToMautic = async () => {
    try {
      const response = await fetch('/api/mautic/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError('Failed to initiate OAuth flow');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Contacts</h1>
            <p className="text-text-secondary mt-1">Manage your contact database</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>
            <button className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Contact
            </button>
          </div>
        </div>

        {/* Auth Required Banner */}
        {needsAuth && (
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary">Connect to Mautic</h3>
                <p className="text-text-secondary">You need to authorize this dashboard to access your Mautic instance.</p>
              </div>
              <button
                onClick={connectToMautic}
                className="btn-primary"
              >
                Connect to Mautic
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && !needsAuth && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 mb-6">
            <p className="text-accent-red">{error}</p>
            <button
              onClick={() => fetchContacts(searchQuery, currentPage)}
              className="text-accent-cyan underline mt-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Filters */}
        <form onSubmit={handleSearch} className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading contacts...</p>
          </div>
        )}

        {/* Contacts Table */}
        {!loading && contacts.length > 0 && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    <input type="checkbox" className="rounded border-border-subtle" />
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">Contact</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">Points</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">Added</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const fields = contact.fields?.all || {};
                  const firstName = fields.firstname || '';
                  const lastName = fields.lastname || '';
                  const email = fields.email || 'No email';
                  const phone = fields.phone || 'N/A';
                  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';

                  return (
                    <tr key={contact.id} className="border-b border-border-subtle hover:bg-bg-tertiary transition-colors">
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded border-border-subtle" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan font-medium">
                            {initials}
                          </div>
                          <div>
                            <p className="text-text-primary font-medium">
                              {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Anonymous'}
                            </p>
                            <p className="text-text-muted text-sm">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{phone}</td>
                      <td className="px-6 py-4">
                        <span className="text-accent-cyan font-medium">{contact.points || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{formatDate(contact.dateAdded)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-cyan" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-cyan" title="Send Email">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <a
                            href={`${mauticUrl}/s/contacts/view/${contact.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-accent-purple"
                            title="View in Mautic"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle">
              <p className="text-sm text-text-muted">
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, total)} of {total.toLocaleString()} contacts
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border border-border-subtle text-text-secondary hover:border-accent-cyan hover:text-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {totalPages <= 7 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded ${
                        page === currentPage
                          ? 'bg-accent-cyan text-bg-primary'
                          : 'border border-border-subtle text-text-secondary hover:border-accent-cyan hover:text-accent-cyan'
                      } transition-colors`}
                    >
                      {page}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-accent-cyan text-bg-primary' : 'border border-border-subtle text-text-secondary hover:border-accent-cyan hover:text-accent-cyan'} transition-colors`}
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className="text-text-muted">...</span>}
                    {currentPage > 2 && currentPage < totalPages - 1 && (
                      <button
                        className="px-3 py-1 rounded bg-accent-cyan text-bg-primary"
                      >
                        {currentPage}
                      </button>
                    )}
                    {currentPage < totalPages - 2 && <span className="text-text-muted">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-accent-cyan text-bg-primary' : 'border border-border-subtle text-text-secondary hover:border-accent-cyan hover:text-accent-cyan'} transition-colors`}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border border-border-subtle text-text-secondary hover:border-accent-cyan hover:text-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && contacts.length === 0 && !error && (
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No contacts found</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'Get started by adding your first contact.'}
            </p>
            <button className="btn-primary">Add Your First Contact</button>
          </div>
        )}
      </main>
    </div>
  );
}
