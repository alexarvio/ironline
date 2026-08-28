import Anthropic from "@anthropic-ai/sdk";

// Writes the narrative summary for a generated client report from the
// computed section data (see computeReportSections in queries.ts). Falls
// back to a plain templated summary (no AI) when ANTHROPIC_API_KEY isn't
// set, so the report feature is fully usable/testable without it — set
// the key (locally in .env, on Railway as a service variable) to get real
// AI-written narratives instead.
export type ReportSectionData = {
  type: string;
  label: string;
  data: Record<string, unknown>;
};

export async function writeReportNarrative(
  clientName: string,
  periodStart: string,
  periodEnd: string,
  sections: ReportSectionData[]
): Promise<{ summary: string; aiGenerated: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections, "ANTHROPIC_API_KEY is not set"), aiGenerated: false };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "medium" },
      system:
        "You write short, warm, specific progress reports from a personal trainer to their client, " +
        "based on real logged data the coach provides. Write in second person, addressed to the client. " +
        "2-4 short paragraphs. Reference actual numbers given — never invent data not provided. " +
        "If a section has no data, skip it rather than mentioning its absence at length. No headers, no bullet points, plain prose.",
      messages: [
        {
          role: "user",
          content:
            `Client: ${clientName}\nPeriod: ${periodStart} to ${periodEnd}\n\n` +
            `Data by section:\n${JSON.stringify(sections, null, 2)}`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      console.error("[reportAi] Claude response had no text block:", JSON.stringify(response));
      return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections, "Claude returned no text"), aiGenerated: false };
    }
    return { summary: text, aiGenerated: true };
  } catch (err) {
    // Most-specific-first so the logged reason is actually useful, not just
    // "something failed" — an invalid key and a network blip need different
    // fixes, and both previously got the exact same silent "no key" message.
    let reason = "unknown error";
    if (err instanceof Anthropic.AuthenticationError) reason = "invalid API key (401)";
    else if (err instanceof Anthropic.PermissionDeniedError) reason = "API key lacks permission (403)";
    else if (err instanceof Anthropic.RateLimitError) reason = "rate limited (429)";
    else if (err instanceof Anthropic.APIConnectionError) reason = "could not reach the Anthropic API (network)";
    else if (err instanceof Anthropic.APIError) reason = `API error ${err.status}: ${err.message}`;
    else if (err instanceof Error) reason = err.message;
    console.error("[reportAi] writeReportNarrative failed:", reason, err);
    return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections, reason), aiGenerated: false };
  }
}

function fallbackNarrative(
  clientName: string,
  periodStart: string,
  periodEnd: string,
  sections: ReportSectionData[],
  reason: string
): string {
  const lines = [`Progress report for ${clientName}, ${periodStart} to ${periodEnd}.`, ""];
  sections.forEach((s) => {
    const parts = Object.entries(s.data)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (parts.length > 0) lines.push(`${s.label} — ${parts.join(", ")}`);
  });
  lines.push("", `(AI-written summary unavailable: ${reason}.)`);
  return lines.join("\n");
}
