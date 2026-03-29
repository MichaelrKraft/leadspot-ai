import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding course data...');

  // Create a test community
  const community = await prisma.community.upsert({
    where: { slug: 'marketing-masters' },
    update: {},
    create: {
      name: 'Marketing Masters',
      slug: 'marketing-masters',
      description: 'Learn marketing automation with Mautic',
    },
  });

  console.log('✓ Created community:', community.slug);

  // Create an instructor
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@mautic.com' },
    update: {},
    create: {
      email: 'instructor@mautic.com',
      hashedPassword: 'hashed_password', // In production, hash this properly
      name: 'Sarah Johnson',
      bio: 'Marketing automation expert with 10+ years of experience',
      role: 'admin',
    },
  });

  console.log('✓ Created instructor:', instructor.name);

  // Create a test user
  const student = await prisma.user.upsert({
    where: { email: 'student@mautic.com' },
    update: {},
    create: {
      email: 'student@mautic.com',
      hashedPassword: 'hashed_password',
      name: 'John Smith',
      role: 'user',
    },
  });

  console.log('✓ Created student:', student.name);

  // Create community memberships
  await prisma.communityMember.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: instructor.id,
      },
    },
    update: {},
    create: {
      communityId: community.id,
      userId: instructor.id,
      role: 'admin',
      points: 1000,
      level: 5,
    },
  });

  await prisma.communityMember.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: student.id,
      },
    },
    update: {},
    create: {
      communityId: community.id,
      userId: student.id,
      role: 'member',
      points: 100,
      level: 1,
    },
  });

  console.log('✓ Created community memberships');

  // Course 1: Beginner Course
  const course1 = await prisma.course.create({
    data: {
      communityId: community.id,
      instructorId: instructor.id,
      title: 'Introduction to Marketing Automation',
      description: 'Learn the fundamentals of marketing automation and how to get started with Mautic. Perfect for beginners looking to automate their marketing workflows.',
      level: 'beginner',
      isFree: true,
      isPublished: true,
      coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
    },
  });

  console.log('✓ Created course:', course1.title);

  // Add modules to course 1
  const module1 = await prisma.courseModule.create({
    data: {
      courseId: course1.id,
      title: 'Getting Started',
      description: 'Introduction to marketing automation concepts and Mautic platform',
      order: 1,
    },
  });

  await prisma.courseLesson.createMany({
    data: [
      {
        moduleId: module1.id,
        title: 'What is Marketing Automation?',
        content: '<h2>Welcome to Marketing Automation</h2><p>Marketing automation streamlines repetitive marketing tasks...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        videoDuration: 596, // 9:56
        order: 1,
      },
      {
        moduleId: module1.id,
        title: 'Understanding Mautic',
        content: '<h2>Mautic Overview</h2><p>Mautic is an open-source marketing automation platform...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        videoDuration: 653, // 10:53
        order: 2,
      },
      {
        moduleId: module1.id,
        title: 'Setting Up Your First Campaign',
        content: '<h2>Campaign Basics</h2><p>Learn how to create your first automated campaign...</p>',
        order: 3,
      },
    ],
  });

  const module2 = await prisma.courseModule.create({
    data: {
      courseId: course1.id,
      title: 'Email Marketing Essentials',
      description: 'Master email marketing with Mautic',
      order: 2,
    },
  });

  await prisma.courseLesson.createMany({
    data: [
      {
        moduleId: module2.id,
        title: 'Creating Effective Email Templates',
        content: '<h2>Email Templates</h2><p>Design engaging email templates that convert...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        videoDuration: 15,
        order: 1,
      },
      {
        moduleId: module2.id,
        title: 'Segmentation Strategies',
        content: '<h2>Audience Segmentation</h2><p>Target the right people with the right message...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        videoDuration: 15,
        order: 2,
      },
    ],
  });

  console.log('✓ Added modules and lessons to course 1');

  // Course 2: Intermediate Course
  const course2 = await prisma.course.create({
    data: {
      communityId: community.id,
      instructorId: instructor.id,
      title: 'Advanced Campaign Building',
      description: 'Take your marketing automation to the next level with advanced campaign strategies, complex workflows, and data-driven optimization.',
      level: 'intermediate',
      isFree: true,
      isPublished: true,
      coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop',
    },
  });

  console.log('✓ Created course:', course2.title);

  const module3 = await prisma.courseModule.create({
    data: {
      courseId: course2.id,
      title: 'Complex Campaign Workflows',
      description: 'Build sophisticated automation workflows',
      order: 1,
    },
  });

  await prisma.courseLesson.createMany({
    data: [
      {
        moduleId: module3.id,
        title: 'Decision Trees and Conditions',
        content: '<h2>Advanced Logic</h2><p>Create complex decision trees in your campaigns...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        videoDuration: 60,
        order: 1,
      },
      {
        moduleId: module3.id,
        title: 'Multi-Channel Campaigns',
        content: '<h2>Omnichannel Marketing</h2><p>Coordinate campaigns across email, SMS, and social...</p>',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        videoDuration: 15,
        order: 2,
      },
    ],
  });

  console.log('✓ Added modules and lessons to course 2');

  // Course 3: Advanced Course
  const course3 = await prisma.course.create({
    data: {
      communityId: community.id,
      instructorId: instructor.id,
      title: 'Mautic API & Integration Mastery',
      description: 'Master Mautic API integration, webhooks, and custom development. Build powerful integrations with third-party tools and create custom solutions.',
      level: 'advanced',
      isFree: true,
      isPublished: true,
      coverImage: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&h=400&fit=crop',
    },
  });

  console.log('✓ Created course:', course3.title);

  const module4 = await prisma.courseModule.create({
    data: {
      courseId: course3.id,
      title: 'API Fundamentals',
      description: 'Learn to work with Mautic REST API',
      order: 1,
    },
  });

  await prisma.courseLesson.createMany({
    data: [
      {
        moduleId: module4.id,
        title: 'Authentication & OAuth',
        content: '<h2>API Authentication</h2><p>Secure your API connections with OAuth 2.0...</p>',
        order: 1,
      },
      {
        moduleId: module4.id,
        title: 'Working with Contacts API',
        content: '<h2>Contact Management</h2><p>CRUD operations on contacts via API...</p>',
        order: 2,
      },
      {
        moduleId: module4.id,
        title: 'Webhooks and Real-time Events',
        content: '<h2>Event-Driven Architecture</h2><p>Listen to Mautic events in real-time...</p>',
        order: 3,
      },
    ],
  });

  console.log('✓ Added modules and lessons to course 3');

  // Enroll student in course 1
  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId: course1.id,
      userId: student.id,
      progressPercent: 40,
    },
  });

  console.log('✓ Enrolled student in course 1');

  // Add some lesson progress
  const lessons = await prisma.courseLesson.findMany({
    where: { moduleId: module1.id },
    orderBy: { order: 'asc' },
    take: 2,
  });

  if (lessons.length > 0) {
    await prisma.lessonProgress.create({
      data: {
        enrollmentId: enrollment.id,
        lessonId: lessons[0].id,
        userId: student.id,
        isCompleted: true,
        watchedSeconds: 596,
        completedAt: new Date(),
      },
    });

    if (lessons.length > 1) {
      await prisma.lessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: lessons[1].id,
          userId: student.id,
          isCompleted: false,
          watchedSeconds: 320,
        },
      });
    }

    console.log('✓ Added lesson progress');
  }

  // Add point transactions
  await prisma.pointTransaction.createMany({
    data: [
      {
        userId: student.id,
        points: 10,
        reason: 'Enrolled in a course',
        sourceType: 'course_enrollment',
        sourceId: course1.id,
      },
      {
        userId: student.id,
        points: 25,
        reason: 'Completed a lesson',
        sourceType: 'lesson_completion',
        sourceId: lessons[0]?.id || '',
      },
    ],
  });

  console.log('✓ Added point transactions');

  console.log('\n✅ Seed completed successfully!');
  console.log('\nTest Accounts:');
  console.log('Instructor: instructor@mautic.com');
  console.log('Student: student@mautic.com');
  console.log('\nCourses Created:');
  console.log('1. Introduction to Marketing Automation (Beginner)');
  console.log('2. Advanced Campaign Building (Intermediate)');
  console.log('3. Mautic API & Integration Mastery (Advanced)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
