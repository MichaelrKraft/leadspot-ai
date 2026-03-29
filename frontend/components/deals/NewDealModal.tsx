'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Deal, DealStage } from '@/types/deals';

interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt'>) => void;
}

const STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function NewDealModal({ isOpen, onClose, onSubmit }: NewDealModalProps) {
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<DealStage>('lead');
  const [priority, setPriority] = useState<Deal['priority']>('warm');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      contactName,
      email,
      company,
      value: Number(value) || 0,
      stage,
      priority,
      notes,
    });
    // Reset form
    setContactName('');
    setEmail('');
    setCompany('');
    setValue('');
    setStage('lead');
    setPriority('warm');
    setNotes('');
    onClose();
  }

  const inputClasses =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400';

  const labelClasses = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Deal</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Name */}
          <div>
            <label htmlFor="deal-contact-name" className={labelClasses}>
              Contact Name
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

          {/* Company */}
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

          {/* Value + Stage row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deal-value" className={labelClasses}>
                Deal Value ($)
              </label>
              <input
                id="deal-value"
                type="number"
                min="0"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="10000"
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
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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
                      : 'border-gray-300 text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
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
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Create Deal
          </button>
        </form>
      </div>
    </div>
  );
}
