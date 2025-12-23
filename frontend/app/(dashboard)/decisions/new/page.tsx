/**
 * New Decision Page - Create a new decision with AI-powered analysis
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
  Calendar,
  Tag,
  FileText,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { DecisionCategory } from '@/types/decision';

interface FormData {
  title: string;
  description: string;
  category: DecisionCategory | '';
  decision_date: string;
  context: string;
}

interface FormErrors {
  title?: string;
  description?: string;
}

export default function NewDecisionPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    decision_date: new Date().toISOString().split('T')[0],
    context: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>('');

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      setAiProcessing(true);
      setAiStatus('Creating decision...');

      // Prepare request data
      const requestData: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
      };

      if (formData.category) {
        requestData.category = formData.category;
      }

      if (formData.decision_date) {
        requestData.decision_date = formData.decision_date;
      }

      if (formData.context.trim()) {
        requestData.context = { notes: formData.context.trim() };
      }

      // Submit to API
      setAiStatus('Extracting entities with AI...');
      const response = await api.decisions.create(requestData);

      setAiStatus('Analyzing decision factors...');
      // Small delay to show the status
      await new Promise((resolve) => setTimeout(resolve, 500));

      setAiStatus('Populating knowledge graph...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      setAiStatus('Complete!');

      // Redirect to the new decision
      const newDecision = response.data as { id: string };
      router.push(`/decisions/${newDecision.id}`);
    } catch (err: unknown) {
      console.error('Error creating decision:', err);
      const error = err as { message?: string };
      setSubmitError(error.message || 'Failed to create decision. Please try again.');
      setAiProcessing(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8">
      {/* Back Button */}
      <Link
        href="/decisions"
        className="mb-6 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Decisions</span>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-white">New Decision</h1>
        <p className="text-gray-400">
          Record a decision and let AI analyze the factors and relationships
        </p>
      </div>

      {/* AI Processing Overlay */}
      {aiProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-md rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 animate-pulse text-purple-400" />
            <h2 className="mb-2 text-xl font-semibold text-white">AI Processing</h2>
            <p className="mb-4 text-gray-400">{aiStatus}</p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {submitError && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <span className="text-red-400">{submitError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-300">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Decision Title <span className="text-red-400">*</span>
            </div>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Migrate to microservices architecture"
            className={`w-full rounded-lg border bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-300">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description <span className="text-red-400">*</span>
            </div>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="Describe the decision, its rationale, and expected outcomes..."
            className={`w-full resize-none rounded-lg border bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.description && <p className="mt-1 text-sm text-red-400">{errors.description}</p>}
          <p className="mt-1 text-xs text-gray-500">
            AI will extract entities, people, and projects from this description
          </p>
        </div>

        {/* Category and Date Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Category */}
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-300">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Category
              </div>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category</option>
              <option value="strategic">Strategic</option>
              <option value="technical">Technical</option>
              <option value="financial">Financial</option>
              <option value="operational">Operational</option>
              <option value="tactical">Tactical</option>
            </select>
          </div>

          {/* Decision Date */}
          <div>
            <label htmlFor="decision_date" className="mb-2 block text-sm font-medium text-gray-300">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Decision Date
              </div>
            </label>
            <input
              type="date"
              id="decision_date"
              name="decision_date"
              value={formData.decision_date}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Additional Context */}
        <div>
          <label htmlFor="context" className="mb-2 block text-sm font-medium text-gray-300">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Context (Optional)
            </div>
          </label>
          <textarea
            id="context"
            name="context"
            value={formData.context}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional notes, stakeholders involved, or relevant background..."
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* AI Info Box */}
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-purple-400" />
            <div>
              <h3 className="mb-1 font-medium text-purple-400">AI-Powered Analysis</h3>
              <p className="text-sm text-gray-400">
                When you save this decision, our AI will automatically:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                  Extract people, projects, and key entities
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                  Analyze factors that influenced this decision
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                  Connect to related decisions in your knowledge graph
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/decisions"
            className="px-6 py-3 text-gray-400 transition-colors hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Create Decision</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
