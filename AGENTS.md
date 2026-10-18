# Architecture
- Paired comparisons use authenticated server functions and owner-scoped RLS in a separate comparisons table; existing standalone evaluations remain independent.
- Comparison runs advance one scenario pair per request with validated persisted progress and strictly increasing compare-and-set lease timestamps, so results survive navigation and duplicate requests cannot share a lease.
- Both comparison variants receive identical scripted user turns and expected behavior, with a common evaluator, to keep comparisons controlled.