import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';
export const maxDuration = 30; // Or a more appropriate value

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages, modelProvider, modelName } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ message: 'Messages are required' }, { status: 400 });
    }
    if (!modelProvider || typeof modelProvider !== 'string') {
      return NextResponse.json({ message: 'modelProvider is required' }, { status: 400 });
    }
    if (!modelName || typeof modelName !== 'string') {
      return NextResponse.json({ message: 'modelName is required' }, { status: 400 });
    }

    let result;
    if (modelProvider === 'openai') {
      result = await streamText({
        model: openai(modelName), // Pass modelName string directly
        messages: messages, // Use original messages, streamText should handle formatting
      });
    } else if (modelProvider === 'gemini') {
      result = await streamText({
        model: google(modelName), // Pass modelName string directly
        messages: messages, // Use original messages, streamText should handle formatting
        // Optional: Add safetySettings here if streamText or the provider supports it directly in this call
        // safetySettings: [{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }]
      });
    } else {
      return NextResponse.json({ message: 'Invalid modelProvider' }, { status: 400 });
    }
    return result.toDataStreamResponse();

  } catch (error: any) { // More generic error type
    console.error('Error in chat completions API:', error);
    // Consider using error.message or a more structured error from the AI SDK
    return NextResponse.json(
      { message: error.message || 'Error processing chat completion' },
      { status: error.status || error.statusCode || 500 } // Use status from error if available
    );
  }
}
