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
    return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections), aiGenerated: false };
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
    if (!text) return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections), aiGenerated: false };
    return { summary: text, aiGenerated: true };
  } catch {
    // Any API/network failure — still deliver a usable draft rather than blocking report generation.
    return { summary: fallbackNarrative(clientName, periodStart, periodEnd, sections), aiGenerated: false };
  }
}

function fallbackNarrative(
  clientName: string,
  periodStart: string,
  periodEnd: string,
  sections: ReportSectionData[]
): string {
  const lines = [`Progress report for ${clientName}, ${periodStart} to ${periodEnd}.`, ""];
  sections.forEach((s) => {
    const parts = Object.entries(s.data)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (parts.length > 0) lines.push(`${s.label} — ${parts.join(", ")}`);
  });
  lines.push("", "(AI-written summaries are off — set ANTHROPIC_API_KEY to enable them.)");
  return lines.join("\n");
}
