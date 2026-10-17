# Architecture
- Paired comparisons use authenticated server functions and owner-scoped RLS in a separate comparisons table; existing standalone evaluations remain independent.
- Comparison runs advance one scenario pair per request and persist snapshots and progress so completed results survive navigation.
- Both comparison variants receive identical scripted user turns and expected behavior, with a common evaluator, to keep comparisons controlled.