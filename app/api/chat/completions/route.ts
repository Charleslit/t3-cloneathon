import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

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

    if (modelProvider === 'openai') {
      // Create a chat completion stream
      const stream = await openai.chat.completions.create({
        model: modelName, // Use modelName from request
        messages: messages,
        stream: true,
      });

      // Convert the stream to a StreamingTextResponse
      const readableStream = OpenAIStream(stream);
      return new StreamingTextResponse(readableStream);

    } else if (modelProvider === 'gemini') {
      const transformGeminiMessages = (msgs: any[]) => {
        let currentRole = "user"; // Gemini alternates user/model roles
        const history = msgs.map(msg => {
          if (msg.role === 'system') return null;
          const role = msg.role === 'assistant' ? 'model' : 'user';
          if (role === currentRole && role === "user") {
            currentRole = "model";
            return [{ role: "model", parts: [{ text: "Okay."}] },
                    { role: "user", parts: [{ text: msg.content }] }];
          } else if (role === currentRole && role === "model") {
            currentRole = "user";
            return [{ role: "user", parts: [{ text: "Understood."}] },
                    { role: "model", parts: [{ text: msg.content }] }];
          }
          currentRole = role;
          return { role, parts: [{ text: msg.content }] };
        }).flat().filter(Boolean);

        if (!history.length || history[0]?.role !== 'user') {
            const userMessages = msgs.filter(m => m.role === 'user');
            const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length -1].content : "Hello";
            return [{role: "user", parts: [{text: lastUserMessage}]}];
        }
        return history;
      };

      const currentGeminiContent = transformGeminiMessages(messages);

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ];

      const geminiModel = genAI.getGenerativeModel({ model: modelName, safetySettings });
      const streamResult = await geminiModel.generateContentStream({
        contents: currentGeminiContent,
      });

      const geminiStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            }
          } catch (err) {
            console.error("Error in Gemini stream: ", err);
            controller.error(err);
          }
          controller.close();
        }
      });
      return new StreamingTextResponse(geminiStream);

    } else {
      return NextResponse.json({ message: 'Invalid modelProvider' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in chat completions API:', error);
    if (error instanceof OpenAI.APIError) { // Keep OpenAI specific error handling if needed
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status || 500 });
    }
    // Add more specific error handling for Gemini if available, or generic
    return NextResponse.json({ message: 'Error processing chat completion' }, { status: 500 });
  }
}
