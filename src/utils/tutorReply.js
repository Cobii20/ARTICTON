export function formatTutorReply(data) {
  const reply = data?.reply || "I could not find an answer for that step.";

  if (
    import.meta.env.VITE_SHOW_TUTOR_SETUP_HINTS !== "true" ||
    !data?.setupIssue
  ) {
    return reply;
  }

  const setupMessages = {
    "missing-gemini-key":
      "Gemini is not active because GEMINI_API_KEY is missing or still uses the placeholder value.",
    "gemini-request-failed":
      "Gemini rejected the tutor request. Check the deployed function logs, API key, enabled Gemini API, and model name.",
    "gemini-network-error":
      "The Firebase Function could not reach Gemini. Check the function network/logs and try again.",
    "gemini-credits-depleted":
      "Gemini is connected, but the API key's AI Studio prepayment credits are depleted. Add credits/billing in AI Studio or use a key from a project with available quota.",
  };

  return [
    reply,
    "",
    `Dev setup: ${setupMessages[data.setupIssue] || data.setupIssue}`,
  ].join("\n");
}
