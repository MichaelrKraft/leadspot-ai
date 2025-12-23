'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useAdmin';
import { ArrowLeft, Mail, Calendar, Clock, Shield, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { UserRole, UserStatus } from '@/types/admin';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useUser(params.id);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ('user' as UserRole),
    status: user?.status || ('active' as UserStatus),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="py-12 text-center">
          <p className="text-gray-500">User not found</p>
          <Link href="/admin/users" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement user update API call
    console.log('Updating user:', formData);
    setIsEditing(false);
  };

  const handleDeactivate = async () => {
    if (confirm('Are you sure you want to deactivate this user?')) {
      // TODO: Implement deactivation API call
      console.log('Deactivating user:', user.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8">
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* User Profile */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as UserStatus,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg px-4 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-2xl font-bold text-white">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <div className="mb-1 text-sm font-medium text-gray-500">Role</div>
                    <div className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                      {user.role}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-medium text-gray-500">Status</div>
                    <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      {user.status}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity History */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Activity History</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50">
                <Clock className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">Logged in from new device</p>
                  <p className="mt-1 text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50">
                <Shield className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">Password changed</p>
                  <p className="mt-1 text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50">
                <Mail className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">Email verified</p>
                  <p className="mt-1 text-xs text-gray-500">3 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Information</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  Created
                </div>
                <div className="text-sm text-gray-900">{formatDate(user.createdAt)}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Last Active
                </div>
                <div className="text-sm text-gray-900">
                  {user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={handleDeactivate}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Deactivate User
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
