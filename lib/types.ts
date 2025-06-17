export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'FUNCTION';

export interface ThinkingState {
  type: 'loading' | 'thinking' | 'generating' | 'error';
  message?: string;
}

export interface StreamingMessage {
  id: string;
  content: string;
  role: MessageRole;
  createdAt?: Date;
  thinking?: ThinkingState;
}

export interface ChatCompletionResponse {
  message: StreamingMessage;
  thinking?: ThinkingState;
}
