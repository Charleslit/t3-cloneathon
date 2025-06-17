import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client'; // Import the Role enum from Prisma
import { createApiResponse, createErrorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { content, role, sessionId: requestedSessionId } = await request.json(); // Expect sessionId in request

    if (!content || !role) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Missing content or role'), { status: 400 });
    }

    // Validate role
    if (role !== Role.USER && role !== Role.ASSISTANT) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Invalid role specified'), { status: 400 });
    }

    let currentSessionId = requestedSessionId;

    // If no sessionId is provided, or if it's explicitly 'new', create a new session.
    if (!currentSessionId || currentSessionId === 'new') {
      const newChatSession = await prisma.chatSession.create({
        data: {
          userId,
          // title: `Chat started on ${new Date().toLocaleString()}` // Or a title based on first message
        }
      });
      currentSessionId = newChatSession.id;
    } else {
      // Verify existing session belongs to the user
      const chatSession = await prisma.chatSession.findUnique({
        where: { id: currentSessionId },
      });
      if (!chatSession || chatSession.userId !== userId) {
        return NextResponse.json(createErrorResponse('FORBIDDEN', 'Invalid or unauthorized sessionId'), { status: 403 });
      }
    }

    const newMessage = await prisma.chatMessage.create({
      data: {
        content,
        role,
        userId,
        sessionId: currentSessionId, // Associate message with the session
      },
    });

    // Return the newMessage, which now includes the sessionId it was saved with.
    return NextResponse.json(createApiResponse(newMessage), { status: 201 });
  } catch (error) {
    logger.error('Error saving chat message:', error);
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error saving message'), { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }

  const userId = (session.user as any).id;
  const { searchParams } = new URL(request.url);

  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json(createErrorResponse('BAD_REQUEST', 'sessionId is required'), { status: 400 });
  }

  // Verify the session belongs to the user before fetching messages
  const chatSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!chatSession || chatSession.userId !== userId) {
    // If session doesn't exist or doesn't belong to user, return empty or error
    // For security, could also return 404 or an empty list as if session has no messages
    return NextResponse.json(createErrorResponse('FORBIDDEN', 'Invalid or unauthorized sessionId'), { status: 403 });
  }

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  const take = pageSize;
  const skip = (page - 1) * pageSize;

  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        userId, // Ensure user consistency, though session check should cover this
        sessionId, // Filter by the provided sessionId
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take,
    });

    const totalMessages = await prisma.chatMessage.count({
      where: {
        userId,
        sessionId,
      },
    });

    const totalPages = Math.ceil(totalMessages / pageSize);

    return NextResponse.json(createApiResponse({
      messages,
      currentPage: page,
      totalPages,
    }), { status: 200 });
  } catch (error) {
    logger.error('Error fetching chat history:', error);
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error fetching messages'), { status: 500 });
  }
}
