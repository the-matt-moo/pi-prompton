import type { Context, Message } from "@earendil-works/pi-ai";
import { buildStrategyInstructions } from "../contracts.js";
import { buildSentinelReminder } from "../parser.js";
import { buildSharedContextSections, buildSharedSystemPrompt } from "./shared.js";
import type { PromptonContextPayload } from "../types.js";

export function buildStrategyRequest(context: PromptonContextPayload): Context {
  const userMessage: Message = {
    role: "user",
    timestamp: Date.now(),
    content: [
      {
        type: "text",
        text: [
          ...buildStrategyInstructions(context),
          buildSharedContextSections(context),
          buildSentinelReminder(),
        ].join("\n\n"),
      },
    ],
  };

  return {
    systemPrompt: buildSharedSystemPrompt(),
    messages: [userMessage],
  };
}
