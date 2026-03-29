import { Suspense } from 'react';
import Image from 'next/image';
import PointsDisplay from '@/components/gamification/PointsDisplay';
import AchievementBadge from '@/components/gamification/AchievementBadge';

interface PageProps {
  params: {
    slug: string;
    userId: string;
  };
}

// Mock user data - replace with actual API call
async function getUserProfile(userId: string) {
  // Simulated API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    id: userId,
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    avatar: null,
    bio: 'Marketing automation enthusiast. Love helping businesses grow with Mautic!',
    role: 'member',
    createdAt: new Date('2024-12-01'),
    stats: {
      posts: 12,
      comments: 45,
      coursesCompleted: 2,
      eventsAttended: 5,
    },
  };
}

// Mock achievements - replace with API call
async function getUserAchievements(_userId: string) {
  await new Promise((resolve) => setTimeout(resolve, 100));

  return [
    {
      id: 'ach_welcome',
      name: 'Welcome Aboard',
      description: 'Joined the community',
      criteria: { description: 'Join the community' },
      pointsValue: 10,
      icon: '👋',
      isEarned: true,
      earnedAt: new Date('2024-12-01'),
    },
    {
      id: 'ach_first_post',
      name: 'First Post',
      description: 'Created your first post',
      criteria: { description: 'Create your first post in the community' },
      pointsValue: 25,
      icon: '📝',
      isEarned: true,
      earnedAt: new Date('2024-12-02'),
    },
    {
      id: 'ach_course_master',
      name: 'Course Master',
      description: 'Completed a course',
      criteria: { description: 'Complete any course from start to finish' },
      pointsValue: 100,
      icon: '🎓',
      isEarned: true,
      earnedAt: new Date('2024-12-15'),
    },
    {
      id: 'ach_community_star',
      name: 'Community Star',
      description: 'Reached 500 points',
      criteria: { description: 'Accumulate 500 total points' },
      pointsValue: 50,
      icon: '⭐',
      isEarned: false,
      earnedAt: null,
    },
  ];
}

// User Header Component
async function UserHeader({ userId }: { userId: string }) {
  const user = await getUserProfile(userId);

  return (
    <div className="bg-bg-secondary border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Cover Image */}
      <div className="h-32 bg-gradient-to-r from-[#00D9FF] to-[#a855f7]"></div>

      {/* Profile Info */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="flex items-start gap-6 -mt-16 mb-6">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name || 'User'}
              width={120}
              height={120}
              className="rounded-full border-4 border-bg-secondary"
            />
          ) : (
            <div className="w-30 h-30 rounded-full border-4 border-bg-secondary bg-gradient-to-br from-[#00D9FF] to-[#a855f7] flex items-center justify-center text-white font-bold text-4xl">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </div>
          )}

          <div className="flex-1 pt-16">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{user.name}</h1>
              {user.role === 'moderator' && (
                <span className="px-3 py-1 bg-[#00D9FF]/20 text-[#00D9FF] text-sm font-medium rounded-full">
                  Moderator
                </span>
              )}
            </div>
            <p className="text-text-secondary mb-4">{user.email}</p>
            {user.bio && (
              <p className="text-white max-w-2xl">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-tertiary rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#00D9FF] mb-1">{user.stats.posts}</p>
            <p className="text-sm text-text-secondary">Posts</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#00D9FF] mb-1">{user.stats.comments}</p>
            <p className="text-sm text-text-secondary">Comments</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#00D9FF] mb-1">{user.stats.coursesCompleted}</p>
            <p className="text-sm text-text-secondary">Courses</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#00D9FF] mb-1">{user.stats.eventsAttended}</p>
            <p className="text-sm text-text-secondary">Events</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Achievements Component
async function UserAchievements({ userId }: { userId: string }) {
  const achievements = await getUserAchievements(userId);
  const earnedCount = achievements.filter((a) => a.isEarned).length;

  return (
    <div className="bg-bg-secondary border border-[#2a2a2a] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">🏆 Achievements</h2>
        <span className="text-sm text-text-secondary">
          {earnedCount} / {achievements.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {achievements.map((achievement) => (
          <div key={achievement.id} className="flex flex-col items-center gap-2">
            <AchievementBadge achievement={achievement} size="md" showTooltip={true} />
            <p className="text-xs text-center text-text-secondary line-clamp-2">
              {achievement.name}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-text-secondary">Progress</span>
          <span className="text-white font-medium">
            {Math.round((earnedCount / achievements.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00D9FF] to-[#a855f7]"
            style={{ width: `${(earnedCount / achievements.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage({ params }: PageProps) {
  const { slug, userId } = params;

  return (
    <div className="min-h-screen bg-bg-primary text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <a
          href={`/community/${slug}`}
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Community
        </a>

        {/* User Header */}
        <Suspense
          fallback={
            <div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl animate-pulse"></div>
          }
        >
          <UserHeader userId={userId} />
        </Suspense>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Achievements */}
          <div className="lg:col-span-2">
            <Suspense
              fallback={
                <div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl animate-pulse"></div>
              }
            >
              <UserAchievements userId={userId} />
            </Suspense>
          </div>

          {/* Right Column - Points & Level */}
          <div>
            <Suspense
              fallback={
                <div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl animate-pulse"></div>
              }
            >
              <PointsDisplay userId={userId} showTransactions={true} />
            </Suspense>
          </div>
        </div>

        {/* Recent Activity - Placeholder */}
        <div className="bg-bg-secondary border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">📝 Recent Activity</h2>
          <p className="text-text-secondary text-center py-8">
            Activity feed coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}
