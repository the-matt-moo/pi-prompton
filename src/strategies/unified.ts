import type { Context, Message } from "@earendil-works/pi-ai";
import { buildStrategyInstructions } from "../contracts.js";
import { buildSharedContextSections, buildSharedSystemPrompt } from "./shared.js";
import type { PromptonContextPayload } from "../types.js";

export function buildStrategyRequest(context: PromptonContextPayload): Context {
  const userMessage: Message = {
    role: "user",
    timestamp: Date.now(),
    content: [
      {
        type: "text",
        text: [...buildStrategyInstructions(context), buildSharedContextSections(context)].join(
          "\n\n"
        ),
      },
    ],
  };

  return {
    systemPrompt: buildSharedSystemPrompt(),
    messages: [userMessage],
  };
}
