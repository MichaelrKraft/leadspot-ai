'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface Community {
  id: string;
  name: string;
  description: string;
  slug: string;
  _count: {
    members: number;
    posts: number;
    courses: number;
    events: number;
  };
}

interface CommunityLayoutProps {
  children: ReactNode;
  community: Community | null;
}

export default function CommunityLayout({ children, community }: CommunityLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Main Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Community Content */}
        <div className="flex-1">
          {children}
        </div>

        {/* Right Sidebar - Community Info */}
        <aside className="w-80 bg-bg-secondary border-l border-border-subtle p-6 hidden xl:block overflow-y-auto">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
              />
              <svg
                className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Community Stats */}
          {community && (
            <div className="bg-bg-tertiary rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Community Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">Members</span>
                  <span className="text-text-primary font-medium">{community._count.members.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">Posts</span>
                  <span className="text-text-primary font-medium">{community._count.posts.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">Active Today</span>
                  <span className="text-accent-green font-medium">24</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href={`/community/${community?.slug || ''}/guidelines`}
                className="flex items-center gap-2 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Community Guidelines
              </Link>
              <Link
                href={`/community/${community?.slug || ''}/members`}
                className="flex items-center gap-2 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Members
              </Link>
              <Link
                href={`/community/${community?.slug || ''}/settings`}
                className="flex items-center gap-2 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
            </div>
          </div>

          {/* Popular Tags */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {['automation', 'email-marketing', 'campaigns', 'segments', 'tips', 'troubleshooting'].map((tag) => (
                <button
                  key={tag}
                  className="px-3 py-1 bg-bg-tertiary text-text-secondary text-xs rounded-full hover:bg-accent-cyan/10 hover:text-accent-cyan transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Top Contributors */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Top Contributors</h3>
            <div className="space-y-3">
              {[
                { name: 'Sarah Johnson', posts: 45, avatar: 'SJ' },
                { name: 'Mike Chen', posts: 38, avatar: 'MC' },
                { name: 'Emily Davis', posts: 32, avatar: 'ED' },
              ].map((contributor, index) => (
                <div key={contributor.name} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan text-xs font-semibold">
                      {contributor.avatar}
                    </div>
                    <div>
                      <p className="text-text-primary text-sm font-medium">{contributor.name}</p>
                      <p className="text-text-muted text-xs">{contributor.posts} posts</p>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="text-accent-yellow">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
