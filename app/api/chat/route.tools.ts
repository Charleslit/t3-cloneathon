import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, streamText, tool } from 'ai';
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

    return createDataStreamResponse({
      execute: async dataStream => {
        // Step 1: Weather tool call
        const result1 = streamText({
          model: openai('gpt-4o-mini', { structuredOutputs: true }),
          system: 'Extract the user goal from the conversation and call the weather tool if needed.',
          messages,
          toolChoice: 'auto',
          tools: {
            weather: tool({
              description: 'Get the weather in a location (fahrenheit)',
              parameters: z.object({
                location: z.string().describe('The location to get the weather for'),
              }),
              execute: async ({ location }) => {
                const temperature = Math.round(Math.random() * (90 - 32) + 32);
                return { location, temperature };
              },
            }),
            convertFahrenheitToCelsius: tool({
              description: 'Convert a temperature in fahrenheit to celsius',
              parameters: z.object({
                temperature: z.number().describe('The temperature in fahrenheit to convert'),
              }),
              execute: async ({ temperature }) => {
                const celsius = Math.round((temperature - 32) * (5 / 9));
                return { celsius };
              },
            }),
          },
        });

        // Forward the initial result to the client without the finish event
        result1.mergeIntoDataStream(dataStream, {
          experimental_sendFinish: false,
        });

        // Step 2: Continue the workflow with the results from the first step
        const result2 = streamText({
          model: openai('gpt-4o'),
          system: 'You are a helpful assistant. Use the weather and conversion tool results to answer the user.',
          messages: [
            ...messages,
            ...(await result1.response).messages,
          ],
        });

        // Forward the 2nd result to the client (incl. the finish event)
        result2.mergeIntoDataStream(dataStream, {
          experimental_sendStart: false,
        });
      },
    });
  } catch (error) {
    logger.error('Advanced streaming chat error:', error);
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Error processing advanced streaming chat'), { status: 500 });
  }
} 