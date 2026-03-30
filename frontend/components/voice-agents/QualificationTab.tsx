'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MessageSquare,
  List,
  ToggleLeft,
  Hash,
} from 'lucide-react';
import type { QualificationStep } from '@/lib/voice-agent-templates';
import { makeId } from '@/lib/voice-agent-templates';

interface QualificationTabProps {
  steps: QualificationStep[];
  onChange: (steps: QualificationStep[]) => void;
}

const ANSWER_TYPE_LABELS: Record<QualificationStep['answerType'], string> = {
  free_text: 'Free Text',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes / No',
  number_range: 'Number Range',
};

const ANSWER_TYPE_ICONS: Record<
  QualificationStep['answerType'],
  typeof MessageSquare
> = {
  free_text: MessageSquare,
  multiple_choice: List,
  yes_no: ToggleLeft,
  number_range: Hash,
};

function AnswerTypeBadge({ type }: { type: QualificationStep['answerType'] }) {
  const Icon = ANSWER_TYPE_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <Icon className="h-3 w-3" />
      {ANSWER_TYPE_LABELS[type]}
    </span>
  );
}

function StepCard({
  step,
  index,
  total,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: QualificationStep;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<QualificationStep>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Collapsed header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-4"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-300" />
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {step.question || 'New question...'}
          </p>
        </div>
        <AnswerTypeBadge type={step.answerType} />
        {step.required && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
            Required
          </span>
        )}
        <span className="text-xs text-slate-400">Wt: {step.scoreWeight}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={index === 0}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={index === total - 1}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Question
            </label>
            <textarea
              value={step.question}
              onChange={(e) => onUpdate({ question: e.target.value })}
              rows={2}
              placeholder="What question should the agent ask?"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Answer Type
              </label>
              <select
                value={step.answerType}
                onChange={(e) =>
                  onUpdate({
                    answerType: e.target.value as QualificationStep['answerType'],
                  })
                }
                className={inputClass}
              >
                <option value="free_text">Free Text</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="yes_no">Yes / No</option>
                <option value="number_range">Number Range</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Required
              </label>
              <button
                type="button"
                onClick={() => onUpdate({ required: !step.required })}
                className={`relative mt-1 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  step.required ? 'bg-indigo-500' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={step.required}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    step.required ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Score Weight ({step.scoreWeight})
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={step.scoreWeight}
                onChange={(e) =>
                  onUpdate({ scoreWeight: parseInt(e.target.value, 10) })
                }
                className="mt-2 w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>0</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {step.answerType === 'multiple_choice' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Options (one per line)
              </label>
              <textarea
                value={(step.options || []).join('\n')}
                onChange={(e) =>
                  onUpdate({
                    options: e.target.value
                      .split('\n')
                      .filter((o) => o.trim() !== ''),
                  })
                }
                rows={4}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QualificationTab({
  steps,
  onChange,
}: QualificationTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    const newStep: QualificationStep = {
      id: makeId(),
      question: '',
      answerType: 'free_text',
      required: true,
      scoreWeight: 5,
    };
    onChange([...steps, newStep]);
    setExpandedId(newStep.id);
  };

  const handleUpdate = (id: string, updates: Partial<QualificationStep>) => {
    onChange(
      steps.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleDelete = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [
      newSteps[targetIndex],
      newSteps[index],
    ];
    onChange(newSteps);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-700">
            Qualification Steps
          </h3>
          <p className="text-xs text-slate-400">
            Define the questions your agent will ask to qualify leads.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Add Step
        </button>
      </div>

      {steps.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            No qualification steps yet. Click &quot;Add Step&quot; to create your
            first question.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            expanded={expandedId === step.id}
            onToggle={() =>
              setExpandedId(expandedId === step.id ? null : step.id)
            }
            onUpdate={(updates) => handleUpdate(step.id, updates)}
            onDelete={() => handleDelete(step.id)}
            onMoveUp={() => handleMove(index, 'up')}
            onMoveDown={() => handleMove(index, 'down')}
          />
        ))}
      </div>
    </div>
  );
}
