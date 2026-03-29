/**
 * LiveKit Client Library
 * 
 * Provides server-side utilities for:
 * - Creating access tokens for agents and users
 * - Managing LiveKit rooms
 * - Verifying webhooks
 */

import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';

// Configuration from environment
const livekitUrl = process.env.LIVEKIT_URL || '';
const apiKey = process.env.LIVEKIT_API_KEY || '';
const apiSecret = process.env.LIVEKIT_API_SECRET || '';

// Validate configuration
function validateConfig() {
  if (!livekitUrl || !apiKey || !apiSecret) {
    console.warn('LiveKit configuration incomplete. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.');
    return false;
  }
  return true;
}

// Room service client (lazy initialization)
let _roomService: RoomServiceClient | null = null;

export function getRoomService(): RoomServiceClient {
  if (!_roomService) {
    if (!validateConfig()) {
      throw new Error('LiveKit not configured');
    }
    _roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  }
  return _roomService;
}

// Webhook receiver (lazy initialization)
let _webhookReceiver: WebhookReceiver | null = null;

export function getWebhookReceiver(): WebhookReceiver {
  if (!_webhookReceiver) {
    if (!validateConfig()) {
      throw new Error('LiveKit not configured');
    }
    _webhookReceiver = new WebhookReceiver(apiKey, apiSecret);
  }
  return _webhookReceiver;
}

/**
 * Create an access token for a voice agent to join a room
 */
export async function createAgentToken(roomName: string, agentId: string): Promise<string> {
  if (!validateConfig()) {
    throw new Error('LiveKit not configured');
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: `agent-${agentId}`,
    name: 'Ploink Voice Agent',
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await token.toJwt();
}

/**
 * Create an access token for a user to join a room (for monitoring/testing)
 */
export async function createUserToken(roomName: string, userId: string, userName: string): Promise<string> {
  if (!validateConfig()) {
    throw new Error('LiveKit not configured');
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: userName,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return await token.toJwt();
}

/**
 * Create a new LiveKit room for a voice call
 */
export async function createRoom(
  name: string,
  metadata?: Record<string, string>
): Promise<{ name: string; sid: string }> {
  const roomService = getRoomService();

  const room = await roomService.createRoom({
    name,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    emptyTimeout: 300, // 5 minutes
    maxParticipants: 2,
  });

  return {
    name: room.name,
    sid: room.sid,
  };
}

/**
 * List all active rooms
 */
export async function listRooms(): Promise<Array<{ name: string; sid: string; numParticipants: number }>> {
  const roomService = getRoomService();
  const rooms = await roomService.listRooms();

  return rooms.map(room => ({
    name: room.name,
    sid: room.sid,
    numParticipants: room.numParticipants,
  }));
}

/**
 * Delete a room by name
 */
export async function deleteRoom(name: string): Promise<void> {
  const roomService = getRoomService();
  await roomService.deleteRoom(name);
}

/**
 * Verify and parse a webhook from LiveKit
 */
export async function verifyWebhook(body: string, authorization: string | undefined) {
  const receiver = getWebhookReceiver();
  return receiver.receive(body, authorization);
}

/**
 * Get LiveKit configuration status
 */
export function getConfigStatus() {
  return {
    configured: validateConfig(),
    url: livekitUrl ? livekitUrl.replace(/wss?:\/\//, '').split('.')[0] + '...' : 'not set',
  };
}
