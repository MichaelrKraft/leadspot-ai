'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Deal, DealStage, Pipeline } from '@/types/deals';
import { listStages, type ApiStageDefinition } from '@/lib/api/deals';

interface NewDealModalProps {
  isOpen: boolean;
  pipeline: Pipeline;
  initialStage?: DealStage | null;
  onClose: () => void;
  onSubmit: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'>) => void;
}

export default function NewDealModal({ isOpen, pipeline, initialStage, onClose, onSubmit }: NewDealModalProps) {
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [value, setValue] = useState('');
  const [stageOptions, setStageOptions] = useState<ApiStageDefinition[]>([]);
  const [stage, setStage] = useState<DealStage | ''>('');
  const [priority, setPriority] = useState<Deal['priority']>('warm');
  const [notes, setNotes] = useState('');

  const isLeasing = pipeline === 'leasing';

  // Load stage options for the active pipeline; honor a pre-selected stage
  useEffect(() => {
    if (!isOpen) return;
    listStages(pipeline)
      .then((stages) => {
        setStageOptions(stages);
        if (initialStage && stages.some((s) => s.id === initialStage)) {
          setStage(initialStage);
        } else {
          setStage((prev) => (prev && stages.some((s) => s.id === prev) ? prev : (stages[0]?.id as DealStage)));
        }
      })
      .catch((err) => console.error('[NewDealModal] failed to load stages:', err));
  }, [isOpen, pipeline, initialStage]);

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title: title || contactName,
      contactName,
      email,
      company,
      propertyName,
      pipeline,
      value: Number(value) || 0,
      stage: (stage || stageOptions[0]?.id) as DealStage,
      priority,
      notes,
    });
    // Reset form
    setTitle('');
    setContactName('');
    setEmail('');
    setCompany('');
    setPropertyName('');
    setValue('');
    setStage('');
    setPriority('warm');
    setNotes('');
    onClose();
  }

  const inputClasses =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-gray-400';

  const labelClasses = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-zinc-800/50 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isLeasing ? 'New Leasing Deal' : 'New Deal'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Deal Title (leasing) */}
          {isLeasing && (
            <div>
              <label htmlFor="deal-title" className={labelClasses}>
                Deal Title
              </label>
              <input
                id="deal-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Suite 200 — Portsmouth Tech Park"
                className={inputClasses}
              />
            </div>
          )}

          {/* Property (leasing) */}
          {isLeasing && (
            <div>
              <label htmlFor="deal-property" className={labelClasses}>
                Property
              </label>
              <input
                id="deal-property"
                type="text"
                required
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="Portsmouth Tech Park"
                className={inputClasses}
              />
            </div>
          )}

          {/* Contact Name */}
          <div>
            <label htmlFor="deal-contact-name" className={labelClasses}>
              {isLeasing ? 'Tenant / Broker Contact' : 'Contact Name'}
            </label>
            <input
              id="deal-contact-name"
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Smith"
              className={inputClasses}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="deal-email" className={labelClasses}>
              Email
            </label>
            <input
              id="deal-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className={inputClasses}
            />
          </div>

          {/* Company (sales only — leasing uses Property) */}
          {!isLeasing && (
            <div>
              <label htmlFor="deal-company" className={labelClasses}>
                Company
              </label>
              <input
                id="deal-company"
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc"
                className={inputClasses}
              />
            </div>
          )}

          {/* Value + Stage row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deal-value" className={labelClasses}>
                {isLeasing ? 'Lease Value ($)' : 'Deal Value ($)'}
              </label>
              <input
                id="deal-value"
                type="number"
                min="0"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isLeasing ? '1200000' : '10000'}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="deal-stage" className={labelClasses}>
                Stage
              </label>
              <select
                id="deal-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className={inputClasses}
              >
                {stageOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={labelClasses}>Priority</label>
            <div className="flex gap-3">
              {(['hot', 'warm', 'cold'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    priority === p
                      ? p === 'hot'
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : p === 'warm'
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                          : 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400 dark:border-zinc-700 dark:text-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="deal-notes" className={labelClasses}>
              Notes
            </label>
            <textarea
              id="deal-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context..."
              className={inputClasses}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            Create Deal
          </button>
        </form>
      </div>
    </div>
  );
}
