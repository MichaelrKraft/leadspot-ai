'use client';

interface ProgressTrackerProps {
  currentProgress: number; // 0-100
  totalLessons: number;
}

export default function ProgressTracker({ currentProgress, totalLessons: _totalLessons }: ProgressTrackerProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-[#a0a0a0]">Progress</span>
        <span className="text-[#00D9FF] font-medium">{currentProgress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] transition-all duration-300 ease-out"
          style={{ width: `${currentProgress}%` }}
        />
      </div>

      {/* Completed Badge */}
      {currentProgress === 100 && (
        <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Course Completed!</span>
        </div>
      )}
    </div>
  );
}
