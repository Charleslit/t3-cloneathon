import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if necessary
import prisma from '@/lib/prisma';
import { createApiResponse, createErrorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const chatSessions = await prisma.chatSession.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: 'desc', // Most recent sessions first
      },
    });

    return NextResponse.json(createApiResponse(chatSessions), { status: 200 });
  } catch (error) {
    logger.error('Error fetching chat sessions:', error);
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error fetching chat sessions'), { status: 500 });
  }
}
