import { Suspense } from 'react';
import Leaderboard from '@/components/gamification/Leaderboard';
import PointsDisplay from '@/components/gamification/PointsDisplay';
import AchievementBadge from '@/components/gamification/AchievementBadge';

// Mock current user for demo - replace with actual auth
const CURRENT_USER_ID = 'user_2pk2Nx1t3dMaRI6LIyoV8hvD6Sv';

interface PageProps {
  params: {
    slug: string;
  };
}

// Loading component
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-bg-tertiary rounded w-1/4 mb-2"></div>
        <div className="h-4 bg-bg-tertiary rounded w-1/2"></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl"></div>
        </div>
        <div>
          <div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

// Achievements section
async function AchievementsSection({ slug: _slug }: { slug: string }) {
  // In a real app, fetch achievements from API
  // For now, we'll use mock data that matches the seed data
  const mockAchievements = [
    {
      id: 'ach_welcome',
      name: 'Welcome Aboard',
      description: 'Joined the community',
      criteria: { description: 'Join the community' },
      pointsValue: 10,
      icon: '👋',
      isEarned: true,
      earnedAt: new Date('2025-01-10'),
    },
    {
      id: 'ach_first_post',
      name: 'First Post',
      description: 'Created your first post',
      criteria: { description: 'Create your first post in the community' },
      pointsValue: 25,
      icon: '📝',
      isEarned: true,
      earnedAt: new Date('2025-01-11'),
    },
    {
      id: 'ach_course_master',
      name: 'Course Master',
      description: 'Completed a course',
      criteria: { description: 'Complete any course from start to finish' },
      pointsValue: 100,
      icon: '🎓',
      isEarned: false,
      earnedAt: null,
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

  return (
    <div className="bg-bg-secondary border border-[#2a2a2a] rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-6">🏆 Achievements</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {mockAchievements.map((achievement) => (
          <div key={achievement.id} className="flex flex-col items-center gap-2">
            <AchievementBadge achievement={achievement} size="md" showTooltip={true} />
            <p className="text-xs text-center text-text-secondary line-clamp-2">
              {achievement.name}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Progress</span>
          <span className="text-white font-medium">
            {mockAchievements.filter((a) => a.isEarned).length} / {mockAchievements.length}
          </span>
        </div>
        <div className="mt-2 h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00D9FF] to-[#a855f7]"
            style={{
              width: `${(mockAchievements.filter((a) => a.isEarned).length / mockAchievements.length) * 100}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage({ params }: PageProps) {
  const { slug } = params;

  return (
    <div className="min-h-screen bg-bg-primary text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Leaderboard & Achievements
          </h1>
          <p className="text-text-secondary">
            Compete with community members and unlock achievements
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <Suspense fallback={<LoadingSkeleton />}>
              <Leaderboard currentUserId={CURRENT_USER_ID} />
            </Suspense>
          </div>

          {/* User Progress - Takes 1 column */}
          <div className="space-y-6">
            <Suspense fallback={<div className="h-96 bg-bg-secondary border border-[#2a2a2a] rounded-xl animate-pulse"></div>}>
              <PointsDisplay
                userId={CURRENT_USER_ID}
                showTransactions={true}
              />
            </Suspense>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="mt-6">
          <Suspense fallback={<div className="h-64 bg-bg-secondary border border-[#2a2a2a] rounded-xl animate-pulse"></div>}>
            <AchievementsSection slug={slug} />
          </Suspense>
        </div>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#00D9FF]/10 to-transparent border border-[#00D9FF]/20 rounded-xl p-6">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="text-lg font-semibold text-white mb-1">Earn Points</h3>
            <p className="text-sm text-text-secondary">
              Post content, comment, and engage to earn points and level up
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#a855f7]/10 to-transparent border border-[#a855f7]/20 rounded-xl p-6">
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="text-lg font-semibold text-white mb-1">Unlock Achievements</h3>
            <p className="text-sm text-text-secondary">
              Complete challenges to unlock badges and bonus points
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-6">
            <div className="text-3xl mb-2">🥇</div>
            <h3 className="text-lg font-semibold text-white mb-1">Climb the Ranks</h3>
            <p className="text-sm text-text-secondary">
              Compete for the top spot on the leaderboard each week
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
