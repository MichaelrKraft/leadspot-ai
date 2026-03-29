import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7.x with adapter pattern for direct PostgreSQL connections
const connectionString = process.env.DIRECT_DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  adapter,
});

async function main() {
  console.log('🌱 Creating LeadSpot community...\n');

  // Check if LeadSpot community already exists
  const existing = await prisma.community.findUnique({
    where: { slug: 'leadspot' },
  });

  if (existing) {
    console.log('✅ LeadSpot community already exists!');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Slug: ${existing.slug}`);
    return;
  }

  // Create LeadSpot community
  const community = await prisma.community.create({
    data: {
      name: 'LeadSpot Community',
      slug: 'leadspot',
      description: 'The official LeadSpot community - connect, learn, and grow your lead generation skills together',
      settings: {
        allowPublicPosts: true,
        requireApproval: false,
        pointsPerPost: 10,
        pointsPerComment: 5,
        brandColor: '#00D9FF',
        welcomeMessage: 'Welcome to LeadSpot! Start engaging with the community.',
      },
    },
  });
  console.log(`✅ Created community: ${community.name}`);
  console.log(`   ID: ${community.id}`);
  console.log(`   Slug: ${community.slug}\n`);

  // Find demo user to add as member
  const demoUser = await prisma.user.findFirst({
    where: { email: 'demo@mautic.test' },
  });

  if (demoUser) {
    // Add demo user as community owner
    await prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: demoUser.id,
        role: 'owner',
        points: 100,
        level: 1,
      },
    });
    console.log(`✅ Added ${demoUser.name} as community owner`);
  }

  // Find admin user to add as member
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@mautic.test' },
  });

  if (adminUser) {
    await prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: adminUser.id,
        role: 'admin',
        points: 500,
        level: 5,
      },
    });
    console.log(`✅ Added ${adminUser.name} as community admin`);
  }

  // Create welcome post
  if (adminUser) {
    await prisma.post.create({
      data: {
        communityId: community.id,
        authorId: adminUser.id,
        title: 'Welcome to LeadSpot Community! 🎉',
        content: `Welcome to the official LeadSpot community!

This is your space to:
- 📚 Learn about lead generation and marketing automation
- 💬 Connect with other LeadSpot users
- 🚀 Share your successes and get help with challenges
- 📈 Stay updated on new features and best practices

**Community Guidelines:**
1. Be respectful and supportive
2. Share your knowledge generously
3. Ask questions - no question is too basic!
4. Help others when you can

Let's grow together! 🌱`,
        type: 'announcement',
        isPinned: true,
      },
    });
    console.log('✅ Created welcome post\n');
  }

  // Create basic achievements for LeadSpot
  await Promise.all([
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'First Steps',
        description: 'Created your first post in LeadSpot',
        criteria: { type: 'post_count', value: 1 },
        pointsValue: 10,
        icon: '🚀',
      },
    }),
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'Contributor',
        description: 'Created 10 posts in the community',
        criteria: { type: 'post_count', value: 10 },
        pointsValue: 50,
        icon: '✍️',
      },
    }),
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'Lead Master',
        description: 'Completed your first LeadSpot course',
        criteria: { type: 'course_completion', value: 1 },
        pointsValue: 100,
        icon: '🎓',
      },
    }),
  ]);
  console.log('✅ Created achievements\n');

  console.log('✨ LeadSpot community setup complete!\n');
  console.log('📍 Access at: http://localhost:3005/community/leadspot');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
