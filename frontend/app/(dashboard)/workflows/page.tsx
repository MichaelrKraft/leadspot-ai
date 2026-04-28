'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2, Users, GitBranch } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  listWorkflows,
  createWorkflow,
  deleteWorkflow,
  listEnrollments,
  enrollContacts,
  enrollSegment,
  pauseEnrollment,
  resumeEnrollment,
  cancelEnrollment,
  refreshEnrollmentContact,
  type Workflow,
  type WorkflowEnrollment,
  type WorkflowStepInput,
} from '@/lib/api/workflows';
import { listContacts, type Contact } from '@/lib/api/contacts';
import { listSegments, type Segment } from '@/lib/api/segments';
import WorkflowDetailPanel from '@/components/workflows/WorkflowDetailPanel';

// ============================================================================
// Helpers
// ============================================================================

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    completed: 'bg-slate-100 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] ?? colors.active}`}>
      {status}
    </span>
  );
}

const emptyStep = (): WorkflowStepInput => ({ delayDays: 0, subject: '', body: '' });

// ============================================================================
// Page
// ============================================================================

export default function WorkflowsPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId ?? '';

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSteps, setCreateSteps] = useState<WorkflowStepInput[]>([emptyStep()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enroll modal
  const [enrollWorkflowId, setEnrollWorkflowId] = useState<string | null>(null);
  const [enrollTab, setEnrollTab] = useState<'contacts' | 'segment'>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);

  // Detail panel
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  // Enrollments view modal
  const [enrollmentsWorkflowId, setEnrollmentsWorkflowId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentActionId, setEnrollmentActionId] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) loadWorkflows();
  }, [orgId]);

  async function loadWorkflows() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listWorkflows(orgId);
      setWorkflows(data);
    } catch {
      setError('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  function openCreate() {
    setCreateName('');
    setCreateSteps([emptyStep()]);
    setShowCreate(true);
  }

  function updateStep(index: number, field: keyof WorkflowStepInput, value: string | number) {
    setCreateSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function addStep() {
    setCreateSteps(prev => [...prev, emptyStep()]);
  }

  function removeStep(index: number) {
    setCreateSteps(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || createSteps.length === 0) return;
    try {
      setIsSubmitting(true);
      await createWorkflow(orgId, createName.trim(), createSteps);
      setShowCreate(false);
      await loadWorkflows();
    } catch {
      setError('Failed to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      await deleteWorkflow(orgId, id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch {
      setError('Failed to delete workflow');
    }
  }

  // ── Enroll ──────────────────────────────────────────────────────────────────

  async function openEnroll(workflowId: string) {
    setEnrollWorkflowId(workflowId);
    setEnrollTab('contacts');
    setSelectedContacts([]);
    setSelectedSegmentId('');
    setEnrollLoading(true);
    try {
      const [contactsData, segmentsData] = await Promise.all([
        listContacts({ limit: 200 }),
        listSegments(),
      ]);
      setContacts(contactsData.contacts);
      setSegments(segmentsData.segments);
    } catch {
      setError('Failed to load contacts or segments');
    } finally {
      setEnrollLoading(false);
    }
  }

  function toggleContact(id: string) {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  }

  async function handleEnrollSubmit() {
    if (!enrollWorkflowId) return;
    setEnrollSubmitting(true);
    try {
      if (enrollTab === 'contacts') {
        const toEnroll = contacts
          .filter(c => selectedContacts.includes(c.id))
          .map(c => ({ id: c.id, email: c.email }));
        await enrollContacts(orgId, enrollWorkflowId, toEnroll);
      } else {
        await enrollSegment(orgId, enrollWorkflowId, selectedSegmentId);
      }
      setEnrollWorkflowId(null);
      await loadWorkflows();
    } catch {
      setError('Failed to enroll contacts');
    } finally {
      setEnrollSubmitting(false);
    }
  }

  // ── View Enrollments ─────────────────────────────────────────────────────────

  async function openEnrollments(workflowId: string) {
    setEnrollmentsWorkflowId(workflowId);
    setEnrollmentsLoading(true);
    try {
      const data = await listEnrollments(orgId, workflowId);
      setEnrollments(data);
    } catch {
      setError('Failed to load enrollments');
    } finally {
      setEnrollmentsLoading(false);
    }
  }

  async function handleEnrollmentAction(
    action: 'pause' | 'resume' | 'cancel' | 'refresh',
    enrollment: WorkflowEnrollment,
  ) {
    if (!enrollmentsWorkflowId) return;
    setEnrollmentActionId(enrollment.id);
    try {
      if (action === 'pause') await pauseEnrollment(orgId, enrollmentsWorkflowId, enrollment.id);
      else if (action === 'resume') await resumeEnrollment(orgId, enrollmentsWorkflowId, enrollment.id);
      else if (action === 'cancel') await cancelEnrollment(orgId, enrollmentsWorkflowId, enrollment.id);
      else if (action === 'refresh') await refreshEnrollmentContact(orgId, enrollmentsWorkflowId, enrollment.id);
      // Reload enrollments to show updated state
      const data = await listEnrollments(orgId, enrollmentsWorkflowId);
      setEnrollments(data);
    } catch {
      setError(`Failed to ${action} enrollment`);
    } finally {
      setEnrollmentActionId(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workflows</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Automated multi-step email sequences for your contacts.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-900">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Workflow</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Steps</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Active</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50">
              {workflows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
                    No workflows yet. Create your first workflow to get started.
                  </td>
                </tr>
              ) : (
                workflows.map(workflow => (
                  <tr key={workflow.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <button
                          onClick={() => setSelectedWorkflowId(workflow.id)}
                          className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400 text-left"
                        >
                          {workflow.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{workflow.step_count}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700 dark:text-zinc-300">{workflow.active_enrollment_count}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400 dark:text-zinc-500">{formatDate(workflow.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEnrollments(workflow.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-indigo-500 dark:hover:bg-zinc-700 dark:hover:text-indigo-400"
                          title="View enrollments"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEnroll(workflow.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                          title="Enroll contacts"
                        >
                          Enroll
                        </button>
                        <button
                          onClick={() => handleDelete(workflow.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                          title="Delete workflow"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Workflow Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Workflow</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Workflow Name *</label>
                <input
                  required
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Open House Follow-Up"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Steps</label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600"
                  >
                    <Plus className="h-3 w-3" /> Add Step
                  </button>
                </div>
                <div className="space-y-4">
                  {createSteps.map((step, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                          Step {i + 1}
                        </span>
                        {createSteps.length > 1 && (
                          <button type="button" onClick={() => removeStep(i)} className="text-slate-300 hover:text-red-400 dark:text-zinc-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">Send after (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={step.delayDays}
                            onChange={e => updateStep(i, 'delayDays', Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">Subject *</label>
                          <input
                            required
                            value={step.subject}
                            onChange={e => updateStep(i, 'subject', e.target.value)}
                            placeholder="Email subject line"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">Body *</label>
                        <textarea
                          required
                          rows={3}
                          value={step.body}
                          onChange={e => updateStep(i, 'body', e.target.value)}
                          placeholder="Email body (HTML or plain text)"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Enroll Modal ── */}
      {enrollWorkflowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 max-h-[80vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Enroll Contacts</h2>
              <button onClick={() => setEnrollWorkflowId(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-zinc-700">
              {(['contacts', 'segment'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setEnrollTab(tab)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors capitalize ${
                    enrollTab === tab
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                  }`}
                >
                  By {tab}
                </button>
              ))}
            </div>

            {enrollLoading ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                {enrollTab === 'contacts' ? (
                  <div className="space-y-1">
                    {contacts.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">No contacts found.</p>
                    ) : (
                      contacts.map(contact => (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800"
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={() => toggleContact(contact.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-zinc-500">{contact.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {segments.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">No segments found.</p>
                    ) : (
                      segments.map(segment => (
                        <label
                          key={segment.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <input
                            type="radio"
                            name="segment"
                            value={segment.id}
                            checked={selectedSegmentId === segment.id}
                            onChange={() => setSelectedSegmentId(segment.id)}
                            className="h-4 w-4 border-slate-300 text-indigo-500 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{segment.name}</p>
                            <p className="text-xs text-slate-400 dark:text-zinc-500">{segment.contact_count} contacts</p>
                          </div>
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: segment.color }}
                          />
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-zinc-700">
              <button
                onClick={() => setEnrollWorkflowId(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollSubmit}
                disabled={
                  enrollSubmitting ||
                  (enrollTab === 'contacts' && selectedContacts.length === 0) ||
                  (enrollTab === 'segment' && !selectedSegmentId)
                }
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-500 disabled:opacity-60"
              >
                {enrollSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {enrollTab === 'contacts'
                  ? `Enroll ${selectedContacts.length} Contact${selectedContacts.length !== 1 ? 's' : ''}`
                  : 'Enroll Segment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workflow Detail Panel ── */}
      <WorkflowDetailPanel
        workflowId={selectedWorkflowId}
        orgId={orgId}
        onClose={() => setSelectedWorkflowId(null)}
        onSaved={loadWorkflows}
        onEnroll={(id) => { setSelectedWorkflowId(null); openEnroll(id); }}
      />

      {/* ── Enrollments View Modal ── */}
      {enrollmentsWorkflowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Enrollments</h2>
              <button onClick={() => setEnrollmentsWorkflowId(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {enrollmentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : enrollments.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400 dark:text-zinc-500">No contacts enrolled yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-700">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Contact</th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Step</th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Next Send</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {enrollments.map(e => {
                      const isActioning = enrollmentActionId === e.id;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                              {e.contact_first_name ? `${e.contact_first_name} ${e.contact_last_name ?? ''}`.trim() : e.contact_email}
                            </p>
                            {e.contact_first_name && (
                              <p className="text-xs text-slate-400 dark:text-zinc-500">{e.contact_email}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-500 dark:text-zinc-400">{e.current_step + 1}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={e.status} /></td>
                          <td className="px-4 py-3 text-right text-xs text-slate-400 dark:text-zinc-500">{formatDate(e.next_send_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isActioning ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : (
                                <>
                                  {e.status === 'active' && (
                                    <button
                                      onClick={() => void handleEnrollmentAction('pause', e)}
                                      className="rounded px-2 py-0.5 text-xs font-medium text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-500/10"
                                      title="Pause"
                                    >
                                      Pause
                                    </button>
                                  )}
                                  {e.status === 'paused' && (
                                    <button
                                      onClick={() => void handleEnrollmentAction('resume', e)}
                                      className="rounded px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                      title="Resume"
                                    >
                                      Resume
                                    </button>
                                  )}
                                  {(e.status === 'active' || e.status === 'paused') && (
                                    <button
                                      onClick={() => void handleEnrollmentAction('cancel', e)}
                                      className="rounded p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                                      title="Cancel enrollment"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void handleEnrollmentAction('refresh', e)}
                                    className="rounded p-1 text-xs text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400"
                                    title="Refresh contact data"
                                  >
                                    ↺
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end">
              <button
                onClick={() => setEnrollmentsWorkflowId(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
