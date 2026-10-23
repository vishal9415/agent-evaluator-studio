/** Local Ollama model identifiers use an explicit prefix so hosted and local
 * inference can coexist in the same model selector.
 */
export function isLocalOllamaModel(model: string): boolean {
  return model.startsWith("ollama/");
}

/** Keep evaluation helper calls on-device whenever the selected model is local. */
export function taskModel(selected: string, hostedFallback: string): string {
  return isLocalOllamaModel(selected) ? selected : hostedFallback;
}
