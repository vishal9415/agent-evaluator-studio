import { describe, expect, it } from "vitest";
import { isLocalOllamaModel, taskModel } from "./ollama-models";

describe("local Ollama model routing", () => {
  it("recognizes explicitly prefixed local model IDs", () => {
    expect(isLocalOllamaModel("ollama/qwen3:4b")).toBe(true);
    expect(isLocalOllamaModel("ollama/llama3.2:3b")).toBe(true);
    expect(isLocalOllamaModel("google/gemini-2.5-flash")).toBe(false);
  });

  it("keeps auxiliary tasks local when a local model is selected", () => {
    expect(taskModel("ollama/qwen3:4b", "google/gemini-2.5-flash")).toBe("ollama/qwen3:4b");
  });

  it("preserves the existing hosted model fallback for hosted selections", () => {
    expect(taskModel("google/gemini-2.5-flash", "google/gemini-2.5-pro")).toBe("google/gemini-2.5-pro");
  });
});
