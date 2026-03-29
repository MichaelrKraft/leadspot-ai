'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  title: string;
  description: string;
  howToUse: string;
  benefit: string;
  accentColor?: 'cyan' | 'purple' | 'green' | 'yellow';
}

// Color mappings for Tailwind JIT
const colorClasses = {
  cyan: {
    hover: 'hover:bg-accent-cyan/10',
    text: 'text-accent-cyan',
    headerBg: 'bg-accent-cyan/10',
    headerBorder: 'border-accent-cyan/20',
    benefitBg: 'bg-accent-cyan/5',
    benefitBorder: 'border-accent-cyan/20',
    iconBg: 'bg-accent-cyan/20',
    button: 'bg-accent-cyan',
  },
  purple: {
    hover: 'hover:bg-accent-purple/10',
    text: 'text-accent-purple',
    headerBg: 'bg-accent-purple/10',
    headerBorder: 'border-accent-purple/20',
    benefitBg: 'bg-accent-purple/5',
    benefitBorder: 'border-accent-purple/20',
    iconBg: 'bg-accent-purple/20',
    button: 'bg-accent-purple',
  },
  green: {
    hover: 'hover:bg-accent-green/10',
    text: 'text-accent-green',
    headerBg: 'bg-accent-green/10',
    headerBorder: 'border-accent-green/20',
    benefitBg: 'bg-accent-green/5',
    benefitBorder: 'border-accent-green/20',
    iconBg: 'bg-accent-green/20',
    button: 'bg-accent-green',
  },
  yellow: {
    hover: 'hover:bg-accent-yellow/10',
    text: 'text-accent-yellow',
    headerBg: 'bg-accent-yellow/10',
    headerBorder: 'border-accent-yellow/20',
    benefitBg: 'bg-accent-yellow/5',
    benefitBorder: 'border-accent-yellow/20',
    iconBg: 'bg-accent-yellow/20',
    button: 'bg-accent-yellow',
  },
};

export default function InfoTooltip({
  title,
  description,
  howToUse,
  benefit,
  accentColor = 'cyan',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const colors = colorClasses[accentColor];

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <>
      {/* Info Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1 rounded-md ${colors.hover} transition-colors group`}
        title="More info"
      >
        <svg
          className={`w-4 h-4 text-text-muted group-hover:${colors.text} transition-colors`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fadeIn"
          >
            {/* Header */}
            <div className={`${colors.headerBg} border-b ${colors.headerBorder} px-6 py-4`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {/* What is it */}
              <div>
                <h4 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-2">
                  What is it?
                </h4>
                <p className="text-text-primary leading-relaxed">{description}</p>
              </div>

              {/* How to use */}
              <div>
                <h4 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-2">
                  How to Use
                </h4>
                <p className="text-text-primary leading-relaxed">{howToUse}</p>
              </div>

              {/* Benefit */}
              <div className={`${colors.benefitBg} border ${colors.benefitBorder} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <svg
                      className={`w-4 h-4 ${colors.text}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-text-primary mb-1">Key Benefit</h4>
                    <p className="text-text-secondary text-sm">{benefit}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-bg-tertiary border-t border-border-subtle">
              <button
                onClick={() => setIsOpen(false)}
                className={`w-full py-2.5 rounded-lg ${colors.button} text-white font-medium hover:opacity-90 transition-opacity`}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
