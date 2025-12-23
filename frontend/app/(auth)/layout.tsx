import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 transition-colors duration-300 dark:bg-background">
      {/* Background gradient effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/10"></div>
        <div className="absolute -right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl dark:bg-purple-500/10"></div>
      </div>

      {/* Auth card container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo and branding */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            InnoSynth<span className="text-blue-500">.ai</span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enterprise Knowledge Synthesis Platform
          </p>
        </div>

        {/* Glass morphism card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-white/5 dark:shadow-2xl">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>© 2025 InnoSynth.ai. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
