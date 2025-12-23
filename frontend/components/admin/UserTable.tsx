'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, UserRole, UserStatus } from '@/types/admin';
import { MoreVertical, Mail, Edit, Trash2 } from 'lucide-react';

interface UserTableProps {
  users: User[];
}

export default function UserTable({ users }: UserTableProps) {
  const [sortColumn, setSortColumn] = useState<'name' | 'email' | 'role' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'user':
        return 'bg-blue-100 text-blue-700';
      case 'viewer':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'inactive':
        return 'bg-gray-100 text-gray-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort('name')}
                className="font-medium text-sm text-gray-700 hover:text-gray-900"
              >
                Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort('email')}
                className="font-medium text-sm text-gray-700 hover:text-gray-900"
              >
                Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort('role')}
                className="font-medium text-sm text-gray-700 hover:text-gray-900"
              >
                Role {sortColumn === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort('status')}
                className="font-medium text-sm text-gray-700 hover:text-gray-900"
              >
                Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="text-left py-3 px-4 font-medium text-sm text-gray-700">
              Last Active
            </th>
            <th className="text-right py-3 px-4 font-medium text-sm text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr
              key={user.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                    {user.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {user.name}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-600">{user.email}</span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                    user.status
                  )}`}
                >
                  {user.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-600">
                  {user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
                    title="Edit user"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
                    title="More actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No users found</p>
        </div>
      )}
    </div>
  );
}
