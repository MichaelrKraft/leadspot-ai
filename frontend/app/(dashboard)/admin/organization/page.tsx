'use client';

import { useState } from 'react';
import { useOrganization } from '@/hooks/useAdmin';
import { Building2, Upload, CreditCard, Database } from 'lucide-react';

export default function OrganizationPage() {
  const { organization, loading } = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: organization?.name || '',
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!organization) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement organization update API call
    console.log('Updating organization:', formData);
    setIsEditing(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // TODO: Implement logo upload
      console.log('Uploading logo:', file);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'bg-gray-100 text-gray-700';
      case 'starter':
        return 'bg-blue-100 text-blue-700';
      case 'professional':
        return 'bg-purple-100 text-purple-700';
      case 'enterprise':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
        <p className="mt-2 text-gray-600">Manage your organization details and subscription</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Organization Details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>
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
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-2xl font-bold text-white">
                    {organization.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{organization.name}</h3>
                    <p className="text-sm text-gray-500">
                      Created on{' '}
                      {new Date(organization.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logo Upload */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Organization Logo</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100">
                {organization.logo ? (
                  <img
                    src={organization.logo}
                    alt="Organization logo"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700">
                  <Upload className="h-4 w-4" />
                  Upload Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500">Recommended: 256x256px, PNG or JPG</p>
              </div>
            </div>
          </div>

          {/* Connected Sources */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Connected Data Sources</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Document Storage</div>
                    <div className="text-xs text-gray-500">1,847 documents indexed</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-600">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Subscription</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm text-gray-500">Current Plan</div>
                <div
                  className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold ${getPlanColor(
                    organization.plan
                  )}`}
                >
                  {organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1)}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="mb-2 text-sm text-gray-500">Usage Limits</div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-600">Users</span>
                      <span className="font-medium text-gray-900">
                        125 / {organization.maxUsers}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{ width: `${(125 / organization.maxUsers) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-600">Documents</span>
                      <span className="font-medium text-gray-900">
                        1,847 / {organization.maxDocuments}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-purple-600"
                        style={{
                          width: `${(1847 / organization.maxDocuments) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700">
                <CreditCard className="h-4 w-4" />
                Upgrade Plan
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-blue-900">Need more?</h3>
            <p className="mb-3 text-sm text-blue-700">
              Upgrade to Enterprise for unlimited users, documents, and priority support.
            </p>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Contact Sales →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
