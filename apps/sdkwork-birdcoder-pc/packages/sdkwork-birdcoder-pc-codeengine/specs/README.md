# BirdCoder PC Code Engine Component

This package owns the application-side runtime adapters that project Codex, Claude Code, Gemini, and OpenCode execution into canonical BirdCoder coding-session events.

The machine-readable contract is [component.spec.json](./component.spec.json). Root SDKWork standards remain authoritative.

Provider-specific payloads must stop at the runtime boundary. Consumers integrate through the package exports declared in the component manifest, and transcript UI consumes canonical events rather than provider JSON.
