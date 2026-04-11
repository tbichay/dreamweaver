/**
 * Centralized AI client configuration.
 *
 * Supports Cloudflare AI Gateway as proxy for all providers.
 * Set environment variables to route through gateway:
 *
 * ELEVENLABS_BASE_URL = https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/elevenlabs/v1
 * ANTHROPIC_BASE_URL  = https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic
 * OPENAI_BASE_URL     = https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai
 *
 * Without these vars, direct provider URLs are used (default behavior).
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Create an Anthropic client, optionally routed through Cloudflare AI Gateway.
 */
export function createAnthropicClient(): Anthropic {
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  if (baseURL) {
    return new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL,
    });
  }
  return new Anthropic();
}

/**
 * Create an OpenAI client, optionally routed through Cloudflare AI Gateway.
 */
export function createOpenAIClient(): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL;
  if (baseURL) {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL,
    });
  }
  return new OpenAI();
}
