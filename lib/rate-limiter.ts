import { RateLimiter } from 'limiter';

// Create separate limiters for each provider to manage their own quotas
const openAILimiter = new RateLimiter({
  tokensPerInterval: 50, // Adjust based on your OpenAI tier
  interval: 'minute'
});

const geminiLimiter = new RateLimiter({
  tokensPerInterval: 60, // Adjust based on your Gemini tier
  interval: 'minute'
});

export async function checkRateLimit(provider: 'openai' | 'gemini'): Promise<boolean> {
  const limiter = provider === 'openai' ? openAILimiter : geminiLimiter;
  const remainingTokens = await limiter.removeTokens(1);
  return remainingTokens >= 0;
}
