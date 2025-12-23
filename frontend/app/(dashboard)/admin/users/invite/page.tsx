'use client';

import InviteUserForm from '@/components/admin/InviteUserForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function InviteUserPage() {
  return (
    <div className="p-8">
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invite User</h1>
        <p className="mt-2 text-gray-600">Send an invitation to join your organization</p>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <InviteUserForm />
        </div>

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-900">What happens next?</h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• The user will receive an email invitation</li>
            <li>• They can set up their account using the invitation link</li>
            <li>• Their role and permissions will be set based on your selection</li>
            <li>• You can manage their access anytime from the Users page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
