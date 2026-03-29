import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

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
  console.log('🌱 Starting seed...\n');

  // Pre-hash the shared test password once (bcrypt is slow by design)
  const hashedPassword = bcrypt.hashSync('changeme123', 12);

  // Clean database
  console.log('🧹 Cleaning existing data...');
  await prisma.notification.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.eventAttendee.deleteMany();
  await prisma.event.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.courseLesson.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.course.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.community.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Database cleaned\n');

  // Create test users
  console.log('👥 Creating test users...');
  const users = await Promise.all([
    // Demo user for testing (hardcoded ID for development)
    prisma.user.create({
      data: {
        id: 'demo-user-001', // Fixed ID for development/testing
        email: 'demo@mautic.test',
        hashedPassword,
        name: 'Demo User',
        avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=00D9FF&color=fff',
        bio: 'Demo account for testing the platform',
        role: 'user',
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@mautic.test',
        hashedPassword,
        name: 'Admin User',
        avatar: 'https://ui-avatars.com/api/?name=Admin+User',
        bio: 'Platform administrator and community manager',
        role: 'admin',
      },
    }),
    prisma.user.create({
      data: {
        email: 'instructor@mautic.test',
        hashedPassword,
        name: 'Sarah Johnson',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson',
        bio: 'Marketing automation expert and course instructor',
        role: 'user',
      },
    }),
    prisma.user.create({
      data: {
        email: 'member1@mautic.test',
        hashedPassword,
        name: 'John Smith',
        avatar: 'https://ui-avatars.com/api/?name=John+Smith',
        bio: 'Digital marketer passionate about automation',
        role: 'user',
      },
    }),
    prisma.user.create({
      data: {
        email: 'member2@mautic.test',
        hashedPassword,
        name: 'Emily Chen',
        avatar: 'https://ui-avatars.com/api/?name=Emily+Chen',
        bio: 'Email marketing specialist',
        role: 'user',
      },
    }),
    prisma.user.create({
      data: {
        email: 'member3@mautic.test',
        hashedPassword,
        name: 'Michael Brown',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Brown',
        bio: 'Learning about marketing automation',
        role: 'user',
      },
    }),
  ]);
  console.log(`✅ Created ${users.length} test users\n`);

  const [demoUser, admin, instructor, member1, member2, member3] = users;

  // Create community
  console.log('🏘️  Creating test community...');
  const community = await prisma.community.create({
    data: {
      name: 'Mautic Masters',
      slug: 'mautic-masters',
      description: 'A community for Mautic users to learn, share, and grow together',
      settings: {
        allowPublicPosts: true,
        requireApproval: false,
        pointsPerPost: 10,
        pointsPerComment: 5,
      },
    },
  });
  console.log(`✅ Created community: ${community.name}\n`);

  // Add members to community
  console.log('👫 Adding members to community...');
  const members = await Promise.all([
    // Demo user as member
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: demoUser.id,
        role: 'member',
        points: 25,
        level: 1,
      },
    }),
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: admin.id,
        role: 'owner',
        points: 500,
        level: 5,
      },
    }),
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: instructor.id,
        role: 'moderator',
        points: 350,
        level: 4,
      },
    }),
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: member1.id,
        role: 'member',
        points: 120,
        level: 2,
      },
    }),
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: member2.id,
        role: 'member',
        points: 85,
        level: 1,
      },
    }),
    prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: member3.id,
        role: 'member',
        points: 45,
        level: 1,
      },
    }),
  ]);
  console.log(`✅ Added ${members.length} members to community\n`);

  // Create posts
  console.log('📝 Creating sample posts...');
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        communityId: community.id,
        authorId: admin.id,
        title: 'Welcome to Mautic Masters! 🎉',
        content: `Welcome to our community! This is a place for Mautic users to connect, learn, and grow together.

Here are some community guidelines:
1. Be respectful and kind
2. Share your knowledge generously
3. Ask questions - there are no stupid questions!
4. Help others when you can

Looking forward to seeing this community thrive!`,
        type: 'announcement',
        isPinned: true,
      },
    }),
    prisma.post.create({
      data: {
        communityId: community.id,
        authorId: instructor.id,
        title: 'Best practices for email segmentation?',
        content: `I've been working with Mautic for 6 months now and want to improve my email segmentation strategy.

What are your favorite techniques for segmenting contacts? I'm currently using:
- Behavior-based segments (opened emails, clicked links)
- Tag-based segments
- Custom field filters

What am I missing? Would love to hear your approaches!`,
        type: 'question',
        isPinned: false,
      },
    }),
    prisma.post.create({
      data: {
        communityId: community.id,
        authorId: member1.id,
        title: 'My automation workflow for lead nurturing',
        content: `Just wanted to share a workflow that's been working great for me!

**The 5-Day Lead Nurture Campaign:**

Day 1: Welcome email + value delivery
Day 2: Case study or success story
Day 3: Educational content (blog post/video)
Day 4: Social proof (testimonials)
Day 5: Soft CTA for demo/consultation

This simple sequence increased my conversion rate by 40%! Feel free to use it as a template.`,
        type: 'discussion',
        isPinned: false,
      },
    }),
  ]);
  console.log(`✅ Created ${posts.length} sample posts\n`);

  const [welcomePost, segmentationPost, nurturingPost] = posts;

  // Create comments
  console.log('💬 Creating comments...');
  const comments = await Promise.all([
    // Comments on segmentation post
    prisma.comment.create({
      data: {
        postId: segmentationPost.id,
        authorId: member1.id,
        content: 'Great question! I also use RFM segmentation (Recency, Frequency, Monetary value) for our contacts. It helps identify our most engaged and valuable customers.',
      },
    }),
    prisma.comment.create({
      data: {
        postId: segmentationPost.id,
        authorId: member2.id,
        content: 'One thing that worked well for us is progressive profiling. We segment based on the information contacts provide over time through forms.',
      },
    }),
    // Comments on nurturing post
    prisma.comment.create({
      data: {
        postId: nurturingPost.id,
        authorId: instructor.id,
        content: 'Excellent workflow! I love how you built in social proof and education before the CTA. This is exactly the kind of value-first approach that works.',
      },
    }),
    prisma.comment.create({
      data: {
        postId: nurturingPost.id,
        authorId: member2.id,
        content: 'This is so helpful! Do you use any specific conditions to determine when someone enters this workflow?',
      },
    }),
  ]);
  console.log(`✅ Created ${comments.length} comments\n`);

  // Create reactions
  console.log('❤️  Creating reactions...');
  await Promise.all([
    prisma.reaction.create({
      data: {
        reactableType: 'post',
        reactableId: welcomePost.id,
        userId: member1.id,
        reactionType: 'love',
      },
    }),
    prisma.reaction.create({
      data: {
        reactableType: 'post',
        reactableId: welcomePost.id,
        userId: member2.id,
        reactionType: 'celebrate',
      },
    }),
    prisma.reaction.create({
      data: {
        reactableType: 'post',
        reactableId: segmentationPost.id,
        userId: instructor.id,
        reactionType: 'like',
      },
    }),
    prisma.reaction.create({
      data: {
        reactableType: 'post',
        reactableId: nurturingPost.id,
        userId: instructor.id,
        reactionType: 'insightful',
      },
    }),
    prisma.reaction.create({
      data: {
        reactableType: 'post',
        reactableId: nurturingPost.id,
        userId: member2.id,
        reactionType: 'like',
      },
    }),
  ]);
  console.log('✅ Created reactions\n');

  // Create courses (for Week 2)
  console.log('📚 Creating sample courses...');
  const course = await prisma.course.create({
    data: {
      communityId: community.id,
      instructorId: instructor.id,
      title: 'Mautic Fundamentals: Getting Started',
      description: `Master the basics of Mautic in this comprehensive beginner course.

You'll learn:
- Setting up your Mautic instance
- Creating and managing contacts
- Building your first campaign
- Email marketing basics
- Understanding segments and tags

Perfect for newcomers to marketing automation!`,
      level: 'beginner',
      price: 0,
      isFree: true,
      isPublished: true,
      coverImage: null, // Placeholder images cause timeout issues
    },
  });

  // Create course modules
  const module1 = await prisma.courseModule.create({
    data: {
      courseId: course.id,
      title: 'Introduction & Setup',
      description: 'Get started with Mautic and set up your environment',
      order: 1,
    },
  });

  const module2 = await prisma.courseModule.create({
    data: {
      courseId: course.id,
      title: 'Contacts & Segments',
      description: 'Learn how to manage contacts and create powerful segments',
      order: 2,
    },
  });

  // Create lessons for module 1
  // Using Google's public sample videos for testing
  await Promise.all([
    prisma.courseLesson.create({
      data: {
        moduleId: module1.id,
        title: 'Welcome to the Course',
        content: `<h2>Welcome to Mautic Fundamentals!</h2>
<p>In this comprehensive course, you'll learn everything you need to get started with Mautic - the powerful open-source marketing automation platform.</p>

<h3>What You'll Learn:</h3>
<ul>
  <li>How to navigate the Mautic dashboard</li>
  <li>Setting up your first campaigns</li>
  <li>Managing contacts effectively</li>
  <li>Creating powerful segments</li>
</ul>

<p>Let's get started on your marketing automation journey!</p>`,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        videoDuration: 596, // Big Buck Bunny is ~9:56
        order: 1,
      },
    }),
    prisma.courseLesson.create({
      data: {
        moduleId: module1.id,
        title: 'Installing Mautic',
        content: `<h2>Installing Mautic on Your Server</h2>
<p>This lesson covers the complete installation process for Mautic.</p>

<h3>Prerequisites:</h3>
<ul>
  <li>A web server (Apache or Nginx)</li>
  <li>PHP 8.0 or higher</li>
  <li>MySQL 5.7+ or MariaDB 10.3+</li>
  <li>Composer installed</li>
</ul>

<h3>Installation Steps:</h3>
<ol>
  <li>Download Mautic from the official website</li>
  <li>Upload files to your server</li>
  <li>Create a database</li>
  <li>Run the installation wizard</li>
  <li>Configure your settings</li>
</ol>

<p>Follow along with the video for a complete walkthrough!</p>`,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        videoDuration: 653, // Elephants Dream is ~10:53
        order: 2,
      },
    }),
  ]);

  // Create lessons for module 2
  await Promise.all([
    prisma.courseLesson.create({
      data: {
        moduleId: module2.id,
        title: 'Understanding Contacts',
        content: `<h2>The Heart of Mautic: Contacts</h2>
<p>Contacts are the foundation of everything you do in Mautic. Understanding how to manage them effectively is crucial for success.</p>

<h3>Key Concepts:</h3>
<ul>
  <li><strong>Contact Lifecycle:</strong> From anonymous visitor to qualified lead</li>
  <li><strong>Contact Fields:</strong> Standard and custom fields</li>
  <li><strong>Contact Timeline:</strong> Track every interaction</li>
  <li><strong>Tags:</strong> Organize and categorize contacts</li>
</ul>

<h3>Best Practices:</h3>
<p>Keep your contact data clean and up-to-date. Regularly remove bounced emails and inactive contacts to maintain good deliverability.</p>`,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        videoDuration: 15, // For Bigger Blazes is ~15 seconds
        order: 1,
      },
    }),
    prisma.courseLesson.create({
      data: {
        moduleId: module2.id,
        title: 'Creating Segments',
        content: `<h2>Powerful Segmentation in Mautic</h2>
<p>Segments allow you to group contacts based on shared characteristics for targeted marketing.</p>

<h3>Types of Segments:</h3>
<ul>
  <li><strong>Dynamic Segments:</strong> Automatically update based on criteria</li>
  <li><strong>Static Segments:</strong> Manually managed lists</li>
</ul>

<h3>Segmentation Criteria:</h3>
<ul>
  <li>Demographics (location, company size)</li>
  <li>Behavior (email opens, page visits)</li>
  <li>Engagement level (points, stage)</li>
  <li>Custom field values</li>
</ul>

<h3>Pro Tip:</h3>
<p>Start with broad segments and progressively refine them. This helps you understand your audience before creating highly targeted campaigns.</p>`,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        videoDuration: 15, // For Bigger Escapes is ~15 seconds
        order: 2,
      },
    }),
  ]);

  console.log(`✅ Created course: ${course.title}\n`);

  // Create enrollments
  console.log('📝 Creating course enrollments...');
  await Promise.all([
    prisma.courseEnrollment.create({
      data: {
        courseId: course.id,
        userId: member1.id,
        progressPercent: 50,
        isCompleted: false,
      },
    }),
    prisma.courseEnrollment.create({
      data: {
        courseId: course.id,
        userId: member3.id,
        progressPercent: 0,
        isCompleted: false,
      },
    }),
  ]);
  console.log('✅ Created course enrollments\n');

  // Create events
  console.log('📅 Creating sample events...');
  const event = await prisma.event.create({
    data: {
      communityId: community.id,
      hostId: instructor.id,
      title: 'Monthly Mautic Masterclass: Email Automation',
      description: 'Join us for our monthly masterclass where we dive deep into email automation strategies.',
      type: 'webinar',
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
      meetingUrl: 'https://zoom.us/j/example',
      maxAttendees: 100,
    },
  });

  await Promise.all([
    prisma.eventAttendee.create({
      data: {
        eventId: event.id,
        userId: member1.id,
        status: 'registered',
      },
    }),
    prisma.eventAttendee.create({
      data: {
        eventId: event.id,
        userId: member2.id,
        status: 'registered',
      },
    }),
  ]);
  console.log(`✅ Created event: ${event.title}\n`);

  // Create achievements
  console.log('🏆 Creating achievements...');
  await Promise.all([
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'First Post',
        description: 'Created your first post in the community',
        criteria: { type: 'post_count', value: 1 },
        pointsValue: 10,
        icon: '📝',
      },
    }),
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: '10 Posts',
        description: 'Created 10 posts in the community',
        criteria: { type: 'post_count', value: 10 },
        pointsValue: 50,
        icon: '✍️',
      },
    }),
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'Course Completionist',
        description: 'Completed your first course',
        criteria: { type: 'course_completion', value: 1 },
        pointsValue: 100,
        icon: '🎓',
      },
    }),
    prisma.achievement.create({
      data: {
        communityId: community.id,
        name: 'Event Enthusiast',
        description: 'Attended 5 community events',
        criteria: { type: 'event_attendance', value: 5 },
        pointsValue: 75,
        icon: '🎪',
      },
    }),
  ]);
  console.log('✅ Created achievements\n');

  // Create point transactions
  console.log('💰 Creating point transactions...');
  await Promise.all([
    prisma.pointTransaction.create({
      data: {
        userId: admin.id,
        points: 10,
        reason: 'Created welcome post',
        sourceType: 'post',
        sourceId: welcomePost.id,
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: instructor.id,
        points: 10,
        reason: 'Created post about segmentation',
        sourceType: 'post',
        sourceId: segmentationPost.id,
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: member1.id,
        points: 10,
        reason: 'Created post about nurturing',
        sourceType: 'post',
        sourceId: nurturingPost.id,
      },
    }),
  ]);
  console.log('✅ Created point transactions\n');

  console.log('✨ Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - ${users.length} users created`);
  console.log(`   - 1 community created`);
  console.log(`   - ${members.length} community memberships`);
  console.log(`   - ${posts.length} posts created`);
  console.log(`   - ${comments.length} comments created`);
  console.log('   - 5 reactions created');
  console.log('   - 1 course with 2 modules and 4 lessons');
  console.log('   - 2 course enrollments');
  console.log('   - 1 event with 2 attendees');
  console.log('   - 4 achievements created');
  console.log('   - 3 point transactions\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
