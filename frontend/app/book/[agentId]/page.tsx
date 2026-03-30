'use client';

import { useEffect, useState } from 'react';
import { getAvailability, bookAppointment, AvailabilitySlot } from '@/lib/api/calendar';

interface PageProps {
  params: { agentId: string };
}

type Step = 'slots' | 'form' | 'success';

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function BookingPage({ params }: PageProps) {
  const { agentId } = params;

  const [step, setStep] = useState<Step>('slots');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation details
  const [confirmedSlot, setConfirmedSlot] = useState<AvailabilitySlot | null>(null);

  useEffect(() => {
    getAvailability(agentId)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setIsLoadingSlots(false));
  }, [agentId]);

  // Group slots by date
  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  for (const slot of slots) {
    const dateKey = slot.start.slice(0, 10);
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await bookAppointment({
        agent_id: agentId,
        contact_name: name,
        contact_email: email,
        contact_phone: phone || undefined,
        start: selectedSlot.start,
        end: selectedSlot.end,
        notes: notes || undefined,
      });
      setConfirmedSlot(selectedSlot);
      setStep('success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Book a Call</h1>
          <p className="mt-1 text-sm text-gray-500">Select a time that works for you</p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          {/* Step: Select slot */}
          {step === 'slots' && (
            <div className="p-6">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Available Times</h2>

              {isLoadingSlots && (
                <p className="text-sm text-gray-500">Loading available times…</p>
              )}

              {!isLoadingSlots && slots.length === 0 && (
                <p className="text-sm text-gray-500">No available times found. Please check back later.</p>
              )}

              {!isLoadingSlots && Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
                <div key={dateKey} className="mb-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {formatDateHeader(daySlots[0].start)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {daySlots.map((slot) => {
                      const isSelected = selectedSlot?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                          }`}
                        >
                          {new Date(slot.start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-6 flex justify-end">
                <button
                  disabled={!selectedSlot}
                  onClick={() => setStep('form')}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step: Fill form */}
          {step === 'form' && selectedSlot && (
            <div className="p-6">
              {/* Selected slot summary */}
              <div className="mb-6 flex items-center gap-3 rounded-lg bg-indigo-50 px-4 py-3">
                <svg className="h-5 w-5 flex-shrink-0 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-indigo-900">{formatSlot(selectedSlot.start)}</p>
                  <p className="text-xs text-indigo-600">30 minutes</p>
                </div>
                <button
                  onClick={() => setStep('slots')}
                  className="ml-auto text-xs text-indigo-600 underline hover:text-indigo-800"
                >
                  Change
                </button>
              </div>

              <h2 className="mb-4 text-base font-semibold text-gray-900">Your Details</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you'd like us to know before the call…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('slots')}
                    className="text-sm text-gray-500 underline hover:text-gray-700"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Booking…' : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && confirmedSlot && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-gray-900">You're booked!</h2>
              <p className="mb-4 text-sm text-gray-500">
                Your call is booked! You'll receive a confirmation email.
              </p>
              <div className="mx-auto inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3">
                <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-indigo-900">{formatSlot(confirmedSlot.start)}</p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by <span className="font-semibold text-indigo-600">LeadSpot.ai</span>
        </p>
      </div>
    </div>
  );
}
