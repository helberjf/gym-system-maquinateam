import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ServiceUnavailableError } from "@/lib/errors";
import { logger, serializeError } from "@/lib/observability/logger";
import {
  ANALYTICS_SYSTEM_PROMPT,
  ANALYTICS_TOOLS,
  executeAnalyticsTool,
} from "@/lib/ai/analytics-tools";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOOL_ROUNDS = 6;

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AnalyticsChatResult = {
  reply: string;
  toolsUsed: string[];
  toolResults: Array<{ tool: string; ok: boolean; error?: string }>;
};

let cachedClient: Anthropic | null = null;
function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "ANTHROPIC_API_KEY nao configurado neste ambiente.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

type AnthropicMessageParam = Parameters<
  Anthropic["messages"]["create"]
>[0]["messages"][number];

type AnthropicMessage = Anthropic.Messages.Message;
type ResponseContentBlock = AnthropicMessage["content"][number];

type ToolResultContentBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

function userMessage(text: string): AnthropicMessageParam {
  return { role: "user", content: text };
}

function previousTurns(history: ChatTurn[]): AnthropicMessageParam[] {
  return history.slice(-10).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
}

export async function runAnalyticsChat(input: {
  userMessage: string;
  history: ChatTurn[];
}): Promise<AnalyticsChatResult> {
  const client = getClient();

  const messages: AnthropicMessageParam[] = [
    ...previousTurns(input.history),
    userMessage(input.userMessage),
  ];

  const toolsUsed: string[] = [];
  const toolResults: AnalyticsChatResult["toolResults"] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = (await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: ANALYTICS_SYSTEM_PROMPT,
      tools: ANALYTICS_TOOLS as unknown as Parameters<
        Anthropic["messages"]["create"]
      >[0]["tools"],
      messages,
    })) as AnthropicMessage;

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (block): block is Extract<ResponseContentBlock, { type: "tool_use" }> =>
          block.type === "tool_use",
      );

      messages.push({
        role: "assistant",
        content: response.content as AnthropicMessageParam["content"],
      });

      const toolResultsBlocks: ToolResultContentBlock[] = [];
      for (const block of toolUses) {
        toolsUsed.push(block.name);
        const result = await executeAnalyticsTool(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
        );
        toolResults.push({
          tool: block.name,
          ok: result.ok,
          error: result.error,
        });
        toolResultsBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: !result.ok,
        });
      }

      messages.push({
        role: "user",
        content: toolResultsBlocks as AnthropicMessageParam["content"],
      });
      continue;
    }

    const reply = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter((text): text is string => text.length > 0)
      .join("\n")
      .trim();

    return {
      reply: reply || "Sem resposta.",
      toolsUsed,
      toolResults,
    };
  }

  logger.warn("ai.analytics_chat.max_tool_rounds_reached", {
    toolsUsed,
  });

  return {
    reply:
      "Nao consegui consolidar a resposta apos varias consultas. Refraseie a pergunta com um escopo mais especifico.",
    toolsUsed,
    toolResults,
  };
}

export async function safeRunAnalyticsChat(input: {
  userMessage: string;
  history: ChatTurn[];
}): Promise<AnalyticsChatResult> {
  try {
    return await runAnalyticsChat(input);
  } catch (error) {
    logger.error("ai.analytics_chat.failed", {
      error: serializeError(error),
    });
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    throw new ServiceUnavailableError(
      "Nao foi possivel processar a consulta agora.",
    );
  }
}
