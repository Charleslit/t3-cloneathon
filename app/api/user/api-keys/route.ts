import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { createApiResponse, createErrorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }
  const userId = (session.user as any).id;
  try {
    const keys = await prisma.userApiKey.findMany({
      where: { userId },
      select: { provider: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(createApiResponse(keys));
  } catch (error) {
    logger.error('Failed to fetch API keys', { error });
    return NextResponse.json(createErrorResponse('SERVER_ERROR', 'Failed to fetch API keys'), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }
  const userId = (session.user as any).id;
  try {
    const { provider, apiKey } = await request.json();
    if (!provider || !apiKey) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Provider and apiKey are required'), { status: 400 });
    }
    const encryptedKey = encrypt(apiKey);
    const upserted = await prisma.userApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: { apiKey: encryptedKey },
      create: { userId, provider, apiKey: encryptedKey },
    });
    return NextResponse.json(createApiResponse({ provider: upserted.provider }));
  } catch (error) {
    logger.error('Failed to save API key', { error });
    return NextResponse.json(createErrorResponse('SERVER_ERROR', 'Failed to save API key'), { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }
  const userId = (session.user as any).id;
  try {
    const { provider } = await request.json();
    if (!provider) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Provider is required'), { status: 400 });
    }
    await prisma.userApiKey.delete({
      where: { userId_provider: { userId, provider } },
    });
    return NextResponse.json(createApiResponse({ provider }));
  } catch (error) {
    logger.error('Failed to delete API key', { error });
    return NextResponse.json(createErrorResponse('SERVER_ERROR', 'Failed to delete API key'), { status: 500 });
  }
} 