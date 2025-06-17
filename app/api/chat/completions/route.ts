import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createErrorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // Increased timeout

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
    }

    const body = await request.json();
    const { messages } = body;
    
    if (!messages?.length) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Messages are required'), { status: 400 });
    }

    // Default to OpenAI if no provider specified
    const modelProvider = body.modelProvider || 'gemini';
    const modelName = body.modelName || 'gemini-pro';

    // Check rate limit before processing
    const isWithinLimit = await checkRateLimit(modelProvider);
    if (!isWithinLimit) {
      return NextResponse.json(
        createErrorResponse('RATE_LIMIT', `Rate limit exceeded for ${modelProvider}. Please try again later.`),
        { status: 429 }
      );
    }

    let result;
    if (modelProvider === 'openai') {
      interface ChatMessage {
        content: string;
        role: string;
      }

      const textStreamResult = await streamText({
        model: openai(modelName),
        messages: messages.map((m: ChatMessage) => ({
          content: m.content,
          role: m.role.toLowerCase()
        }))
      });

      return new Response(textStreamResult.textStream);

    } else if (modelProvider === 'gemini') {
      const textStreamResult = await streamText({
        model: google(modelName),
        messages: messages
      });

      return new Response(textStreamResult.textStream);
    } else {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Invalid model provider'), { status: 400 });
    }

  } catch (error) {
    logger.error('Chat completion error:', error);
    let errorMessage = 'Error processing chat completion';
    let statusCode = 500;
    if (typeof error === 'object' && error !== null) {
      if ('message' in error && typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
      }
      if ('status' in error && typeof (error as any).status === 'number') {
        statusCode = (error as any).status;
      } else if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
        statusCode = (error as any).statusCode;
      }
    }
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', errorMessage), { status: statusCode });
  }
}
