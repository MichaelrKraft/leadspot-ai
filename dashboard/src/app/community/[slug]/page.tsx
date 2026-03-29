'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CommunityFeed from '@/components/community/CommunityFeed';
import CommunityLayout from '@/components/community/CommunityLayout';

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

export default function CommunityPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommunity() {
      try {
        const res = await fetch(`/api/community/${slug}`);
        if (!res.ok) {
          throw new Error('Community not found');
        }
        const data = await res.json();
        setCommunity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load community');
      } finally {
        setLoading(false);
      }
    }

    fetchCommunity();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Community not found</h1>
          <p className="text-gray-600">{error || 'This community does not exist'}</p>
        </div>
      </div>
    );
  }

  return (
    <CommunityLayout community={community}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Community Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{community.name}</h1>
          <p className="text-gray-600 mb-4">{community.description}</p>

          {/* Community Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{community._count.members}</div>
              <div className="text-sm text-gray-600">Members</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{community._count.posts}</div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{community._count.courses}</div>
              <div className="text-sm text-gray-600">Courses</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{community._count.events}</div>
              <div className="text-sm text-gray-600">Events</div>
            </div>
          </div>
        </div>

        {/* Community Feed */}
        <CommunityFeed communityId={community.id} communitySlug={slug} />
      </div>
    </CommunityLayout>
  );
}
