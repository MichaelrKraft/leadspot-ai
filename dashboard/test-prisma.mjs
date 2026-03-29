import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DIRECT_DATABASE_URL;
console.log('Database URL:', connectionString);

try {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
    adapter,
  });

  console.log('\n🔍 Testing Prisma connection...');

  const communities = await prisma.community.findMany({
    include: {
      _count: {
        select: {
          members: true,
          posts: true,
          courses: true,
          events: true,
        },
      },
    },
  });

  console.log('\n✅ Successfully connected!');
  console.log(`Found ${communities.length} communities:`);
  communities.forEach(c => {
    console.log(`  - ${c.name} (${c.slug})`);
    console.log(`    Members: ${c._count.members}, Posts: ${c._count.posts}`);
  });

  await prisma.$disconnect();
  await pool.end();

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
