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
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('query');
  if (!query || query.trim().length === 0) {
    return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Search query is required'), { status: 400 });
  }

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  const take = pageSize;
  const skip = (page - 1) * pageSize;

  try {
    const whereClause = {
      userId: userId,
      content: {
        contains: query,
        mode: 'insensitive' as const, // Case-insensitive search
      },
    };

    const matchingMessages = await prisma.chatMessage.findMany({
      where: whereClause,
      include: {
        session: { // Include details of the chat session for context
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc', // Most recent matching messages first
      },
      skip: skip,
      take: take,
    });

    const totalResults = await prisma.chatMessage.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalResults / pageSize);

    return NextResponse.json(createApiResponse({
      messages: matchingMessages,
      currentPage: page,
      totalPages: totalPages,
      totalResults: totalResults,
    }), { status: 200 });

  } catch (error) {
    logger.error('Error searching chat messages:', error);
    // Log the actual error for server-side debugging
    // Consider more specific error messages for client if appropriate
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error searching messages'), { status: 500 });
  }
}
