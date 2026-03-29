import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Authentication helper utilities for API routes
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * Get user ID from request headers
 * In production, this should validate a JWT token or session
 * For now, we use a simple x-user-id header
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  // Try to get from header (for testing/development)
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId) {
    return headerUserId;
  }

  // TODO: In production, implement proper JWT validation
  // const token = request.headers.get('authorization')?.replace('Bearer ', '');
  // if (token) {
  //   const decoded = verifyJWT(token);
  //   return decoded.userId;
  // }

  return null;
}

/**
 * Get full user object from request
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return user;
}

/**
 * Check if user is a member of a community
 */
export async function isCommunityMember(
  userId: string,
  communityId: string
): Promise<boolean> {
  const membership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId,
      },
    },
  });

  return !!membership;
}

/**
 * Check if user is a moderator or admin in a community
 */
export async function isCommunityModerator(
  userId: string,
  communityId: string
): Promise<boolean> {
  const membership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId,
      },
    },
  });

  return membership ? ['moderator', 'admin', 'owner'].includes(membership.role) : false;
}

/**
 * Get user's role in a community
 */
export async function getUserCommunityRole(
  userId: string,
  communityId: string
): Promise<string | null> {
  const membership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  return membership?.role || null;
}

/**
 * Verify user owns a resource or is a moderator
 */
export async function canModifyResource(
  userId: string,
  resourceOwnerId: string,
  communityId: string
): Promise<boolean> {
  // User owns the resource
  if (userId === resourceOwnerId) {
    return true;
  }

  // User is a moderator in the community
  return isCommunityModerator(userId, communityId);
}
