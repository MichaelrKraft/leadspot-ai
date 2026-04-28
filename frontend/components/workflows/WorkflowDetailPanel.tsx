'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Loader2, Save, Users, GripVertical, Target } from 'lucide-react';
import {
  getWorkflow,
  updateWorkflow,
  listGoals,
  addGoal,
  removeGoal,
  type WorkflowDetail,
  type WorkflowStepInput,
  type WorkflowGoal,
} from '@/lib/api/workflows';

interface Props {
  workflowId: string | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
  onEnroll: (workflowId: string) => void;
}

function emptyStep(): WorkflowStepInput {
  return { delayDays: 1, subject: '', body: '', stepType: 'send_email', actionConfig: {}, branchCondition: null };
}

function stepsFromDetail(detail: WorkflowDetail): WorkflowStepInput[] {
  return detail.steps
    .slice()
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => ({
      delayDays: s.delay_days,
      subject: s.subject,
      body: s.body,
      stepType: (s.step_type as WorkflowStepInput['stepType']) ?? 'send_email',
      actionConfig: s.action_config ? JSON.parse(s.action_config) : {},
      branchCondition: s.branch_condition ? JSON.parse(s.branch_condition) : null,
    }));
}

const VARIABLE_PILLS = [
  { label: '{firstName}', value: '{firstName}' },
  { label: '{lastName}', value: '{lastName}' },
  { label: '{fullName}', value: '{fullName}' },
  { label: '{company}', value: '{company}' },
  { label: '{email}', value: '{email}' },
];

export default function WorkflowDetailPanel({ workflowId, orgId, onClose, onSaved, onEnroll }: Props) {
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<WorkflowStepInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  // Goal conditions
  const [goals, setGoals] = useState<WorkflowGoal[]>([]);
  const [newGoalTag, setNewGoalTag] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  // Ref to track body textarea for variable insertion
  const bodyRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    if (!workflowId) return;
    setDetail(null);
    setError(null);
    setGoals([]);
    setNewGoalTag('');
    setLoading(true);
    Promise.all([
      getWorkflow(orgId, workflowId),
      listGoals(orgId, workflowId),
    ])
      .then(([d, g]) => {
        setDetail(d);
        setName(d.name);
        setSteps(stepsFromDetail(d));
        setExpandedStep(0);
        setGoals(g);
      })
      .catch(() => setError('Failed to load workflow'))
      .finally(() => setLoading(false));
  }, [workflowId, orgId]);

  if (!workflowId) return null;

  function updateStep(index: number, field: keyof WorkflowStepInput, value: string | number) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function updateStepActionConfig(index: number, key: string, value: string) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, actionConfig: { ...s.actionConfig, [key]: value } }
          : s,
      ),
    );
  }

  function updateStepBranch(
    index: number,
    updates: Partial<NonNullable<WorkflowStepInput['branchCondition']>>,
  ) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              branchCondition: s.branchCondition
                ? { ...s.branchCondition, ...updates }
                : { type: 'email_opened', true_next_step: index + 1, false_next_step: index + 2, ...updates },
            }
          : s,
      ),
    );
  }

  function toggleBranch(index: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              branchCondition: s.branchCondition
                ? null
                : { type: 'email_opened', true_next_step: index + 1, false_next_step: index + 2 },
            }
          : s,
      ),
    );
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
    setExpandedStep(steps.length);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setExpandedStep((prev) => (prev !== null && prev >= index ? Math.max(0, prev - 1) : prev));
  }

  async function handleSave() {
    if (!workflowId || !name.trim() || steps.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await updateWorkflow(orgId, workflowId, name.trim(), steps);
      onSaved();
    } catch {
      setError('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddGoal() {
    if (!workflowId || !newGoalTag.trim()) return;
    setAddingGoal(true);
    try {
      const goal = await addGoal(orgId, workflowId, 'tag_added', newGoalTag.trim());
      setGoals((prev) => [...prev, goal]);
      setNewGoalTag('');
    } catch {
      setError('Failed to add goal condition');
    } finally {
      setAddingGoal(false);
    }
  }

  async function handleRemoveGoal(goalId: string) {
    if (!workflowId) return;
    try {
      await removeGoal(orgId, workflowId, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch {
      setError('Failed to remove goal condition');
    }
  }

  function insertVariable(stepIndex: number, variable: string) {
    const textarea = bodyRefs.current[stepIndex];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = steps[stepIndex].body;
    const newBody = current.substring(0, start) + variable + current.substring(end);
    updateStep(stepIndex, 'body', newBody);
    // Restore cursor after variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }

  const dayLabel = (days: number) => {
    if (days === 0) return 'Send immediately';
    return `Send ${days} day${days === 1 ? '' : 's'} after previous step`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          {loading ? (
            <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg border border-transparent px-2 py-1 text-lg font-bold text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:bg-zinc-900 dark:text-white"
              placeholder="Workflow name"
            />
          )}
          <button
            onClick={() => detail && onEnroll(detail.id)}
            disabled={!detail}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
          >
            <Users className="h-4 w-4" />
            Enroll
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && steps.length > 0 && (
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isExpanded = expandedStep === index;
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    {/* Step header (always visible) */}
                    <button
                      type="button"
                      onClick={() => setExpandedStep(isExpanded ? null : index)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {(step.stepType ?? 'send_email') === 'add_tag'
                            ? `Add tag: ${step.actionConfig?.tagName || '(no tag)'}`
                            : (step.stepType ?? 'send_email') === 'remove_tag'
                            ? `Remove tag: ${step.actionConfig?.tagName || '(no tag)'}`
                            : (step.stepType ?? 'send_email') === 'webhook'
                            ? `Webhook: ${step.actionConfig?.webhookUrl || '(no URL)'}`
                            : step.subject || <span className="italic text-slate-400">(no subject)</span>}
                          {step.branchCondition && (
                            <span className="ml-1 rounded bg-purple-50 px-1 py-0.5 text-xs text-purple-500 dark:bg-purple-500/10">
                              &#x2442;
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">{dayLabel(step.delayDays)}</p>
                      </div>
                      <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-zinc-600" />
                    </button>

                    {/* Step body (expanded) */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-zinc-700">
                        <div className="space-y-3">
                          {/* Step type selector */}
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                              Step type
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {(['send_email', 'add_tag', 'remove_tag', 'webhook'] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => updateStep(index, 'stepType', type)}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                    (step.stepType ?? 'send_email') === type
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                                  }`}
                                >
                                  {type === 'send_email'
                                    ? 'Send Email'
                                    : type === 'add_tag'
                                    ? 'Add Tag'
                                    : type === 'remove_tag'
                                    ? 'Remove Tag'
                                    : 'Webhook'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Delay (shown for all step types) */}
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                              Delay
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={step.delayDays}
                                onChange={(e) => updateStep(index, 'delayDays', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                              />
                              <span className="text-sm text-slate-500 dark:text-zinc-400">
                                {step.delayDays === 0 ? 'day (send immediately)' : `day${step.delayDays === 1 ? '' : 's'} after previous step`}
                              </span>
                            </div>
                          </div>

                          {/* send_email fields */}
                          {(step.stepType ?? 'send_email') === 'send_email' && (
                            <>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                                  Subject line
                                </label>
                                <input
                                  type="text"
                                  value={step.subject}
                                  onChange={(e) => updateStep(index, 'subject', e.target.value)}
                                  placeholder="Email subject…"
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                                />
                              </div>

                              <div>
                                <div className="mb-1 flex items-center justify-between">
                                  <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                    Email body
                                  </label>
                                  <div className="flex flex-wrap gap-1">
                                    {VARIABLE_PILLS.map((pill) => (
                                      <button
                                        key={pill.value}
                                        type="button"
                                        onClick={() => insertVariable(index, pill.value)}
                                        className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                                      >
                                        {pill.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  ref={(el) => { bodyRefs.current[index] = el; }}
                                  rows={8}
                                  value={step.body}
                                  onChange={(e) => updateStep(index, 'body', e.target.value)}
                                  placeholder="Email body… click a variable above to insert it"
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                                />
                              </div>
                            </>
                          )}

                          {/* add_tag / remove_tag fields */}
                          {((step.stepType ?? 'send_email') === 'add_tag' || (step.stepType ?? 'send_email') === 'remove_tag') && (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                                Tag name
                              </label>
                              <input
                                type="text"
                                value={step.actionConfig?.tagName ?? ''}
                                onChange={(e) => updateStepActionConfig(index, 'tagName', e.target.value)}
                                placeholder="e.g. booked-call"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                              />
                            </div>
                          )}

                          {/* webhook fields */}
                          {(step.stepType ?? 'send_email') === 'webhook' && (
                            <div className="space-y-3">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                                  Webhook URL
                                </label>
                                <input
                                  type="url"
                                  value={step.actionConfig?.webhookUrl ?? ''}
                                  onChange={(e) => updateStepActionConfig(index, 'webhookUrl', e.target.value)}
                                  placeholder="https://…"
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                                  Method
                                </label>
                                <select
                                  value={step.actionConfig?.webhookMethod ?? 'POST'}
                                  onChange={(e) => updateStepActionConfig(index, 'webhookMethod', e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                >
                                  <option>POST</option>
                                  <option>GET</option>
                                  <option>PUT</option>
                                  <option>PATCH</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                                  Body (JSON, supports {'{firstName}'} variables)
                                </label>
                                <textarea
                                  rows={4}
                                  value={step.actionConfig?.webhookBody ?? ''}
                                  onChange={(e) => updateStepActionConfig(index, 'webhookBody', e.target.value)}
                                  placeholder='{"contact": "{firstName} {lastName}", "email": "{email}"}'
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Branch condition */}
                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                                  Branch after this step
                                </span>
                                {step.branchCondition && (
                                  <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                                    active
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleBranch(index)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                  step.branchCondition ? 'bg-purple-500' : 'bg-slate-200 dark:bg-zinc-600'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    step.branchCondition ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {step.branchCondition && (
                              <div className="mt-3 space-y-2">
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400">
                                    Condition
                                  </label>
                                  <select
                                    value={step.branchCondition.type}
                                    onChange={(e) =>
                                      updateStepBranch(index, { type: e.target.value as 'email_opened' | 'tag_has' })
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                  >
                                    <option value="email_opened">Email was opened</option>
                                    <option value="tag_has">Contact has tag…</option>
                                  </select>
                                </div>

                                {step.branchCondition.type === 'tag_has' && (
                                  <input
                                    type="text"
                                    value={step.branchCondition.value ?? ''}
                                    onChange={(e) => updateStepBranch(index, { value: e.target.value })}
                                    placeholder="Tag name, e.g. replied"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                                  />
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400">
                                      If true &#x2192; step
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={step.branchCondition.true_next_step + 1}
                                      onChange={(e) =>
                                        updateStepBranch(index, {
                                          true_next_step: Math.max(0, parseInt(e.target.value) - 1 || 0),
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400">
                                      If false &#x2192; step
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={step.branchCondition.false_next_step + 1}
                                      onChange={(e) =>
                                        updateStepBranch(index, {
                                          false_next_step: Math.max(0, parseInt(e.target.value) - 1 || 0),
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-zinc-500">
                                  Step numbers shown as 1-based (step 1 = index 0)
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeStep(index)}
                              disabled={steps.length === 1}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove step
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addStep}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <Plus className="h-4 w-4" />
                Add step
              </button>

              {/* Goal / Exit Conditions */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Target className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Goal / Exit Conditions</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">— complete enrollment early when contact meets a condition</p>
                </div>
                <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-zinc-700">
                  {goals.length > 0 && (
                    <ul className="mb-3 space-y-1.5">
                      {goals.map((g) => (
                        <li key={g.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <span className="text-slate-600 dark:text-zinc-300">
                            Stop if contact has tag <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{g.condition_value}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGoal(g.id)}
                            className="ml-2 text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newGoalTag}
                      onChange={(e) => setNewGoalTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddGoal(); } }}
                      placeholder="Tag name, e.g. booked-call"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddGoal()}
                      disabled={!newGoalTag.trim() || addingGoal}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                    >
                      {addingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-zinc-800">
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !name.trim() || steps.length === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
