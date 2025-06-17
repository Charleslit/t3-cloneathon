import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const maxDuration = 30;

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const MessagesSchema = z.object({
  messages: z.array(MessageSchema),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = MessagesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(createErrorResponse('BAD_REQUEST', 'Invalid messages payload', parseResult.error.format()), { status: 400 });
    }
    const { messages } = parseResult.data;

    // Basic streaming chat (no tools, no multistep)
    const result = streamText({
      model: openai('gpt-4o'),
      system: 'You are a helpful assistant.',
      messages,
    });
    return result.toDataStreamResponse();
  } catch (error) {
    logger.error('Streaming chat error:', error);
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error processing streaming chat'), { status: 500 });
  }
}

// For advanced/multistep/tooling, see AI SDK docs. You can add a tools/multistep version here as needed. 