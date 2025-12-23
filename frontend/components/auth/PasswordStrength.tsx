'use client';

import { useMemo } from 'react';

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

interface StrengthConfig {
  label: string;
  color: string;
  bgColor: string;
  width: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo((): { level: StrengthLevel; score: number } => {
    if (!password) return { level: 'weak', score: 0 };

    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Determine level
    if (score <= 2) return { level: 'weak', score };
    if (score <= 3) return { level: 'fair', score };
    if (score <= 4) return { level: 'good', score };
    return { level: 'strong', score };
  }, [password]);

  const config: Record<StrengthLevel, StrengthConfig> = {
    weak: {
      label: 'Weak',
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      width: 'w-1/4',
    },
    fair: {
      label: 'Fair',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500',
      width: 'w-2/4',
    },
    good: {
      label: 'Good',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      width: 'w-3/4',
    },
    strong: {
      label: 'Strong',
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      width: 'w-full',
    },
  };

  if (!password) return null;

  const currentConfig = config[strength.level];

  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${currentConfig.bgColor} transition-all duration-300 ${currentConfig.width}`}
          ></div>
        </div>
        <span className={`text-xs font-medium ${currentConfig.color}`}>
          {currentConfig.label}
        </span>
      </div>
      <ul className="text-xs text-gray-400 space-y-0.5 mt-2">
        <li className={password.length >= 8 ? 'text-green-500' : ''}>
          {password.length >= 8 ? '✓' : '○'} At least 8 characters
        </li>
        <li className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? 'text-green-500' : ''}>
          {/[A-Z]/.test(password) && /[a-z]/.test(password) ? '✓' : '○'} Upper & lowercase letters
        </li>
        <li className={/[0-9]/.test(password) ? 'text-green-500' : ''}>
          {/[0-9]/.test(password) ? '✓' : '○'} At least one number
        </li>
        <li className={/[^a-zA-Z0-9]/.test(password) ? 'text-green-500' : ''}>
          {/[^a-zA-Z0-9]/.test(password) ? '✓' : '○'} Special character
        </li>
      </ul>
    </div>
  );
}
