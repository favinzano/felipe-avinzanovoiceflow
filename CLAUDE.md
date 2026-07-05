# CLAUDE.md

## Arquitectura (felipe-avinzano VoiceFlow)

- **Core:** app Electron 39+, Node.js, `esbuild` bundlea el frontend Vanilla JS (`src/renderer.js` → `dist/renderer.js`).
- **Filosofía estricta:** 100% offline. Cero dependencias de APIs en la nube. Privacidad absoluta.
- **Motor local de IA:** `@huggingface/transformers` + `onnxruntime-node`, desempaquetado de ASAR (`asarUnpack` en `package.json`) para que el binario nativo funcione en la app empaquetada.
- **UI:** `index.html` (ventana principal) y `overlay.html` (interfaz flotante).

## Reglas de Desarrollo

1. Nunca sugerir ni introducir llamadas a OpenAI, Anthropic, Firebase u otros servicios en la nube. Todo proceso (IA, autenticación, búsqueda) debe ser estrictamente local a la máquina.
2. Mantener intacta la suite de tests (`src/*.test.cjs`) — correr `npm test` antes de dar por cerrado un cambio.
3. Modularizar `src/main.cjs`: es el punto de entrada y ha ido creciendo; extraer responsabilidades a módulos propios en vez de dejarlo crecer como archivo monolítico (siguiendo el límite de ~800 líneas por archivo de las reglas comunes del usuario).

## gstack

This machine has [gstack](https://github.com/garrytan/gstack) installed at `~/.claude/skills/gstack`. Use the `/browse` skill from gstack for all web browsing — never use `mcp__claude-in-chrome__*` tools directly. gstack provides the following slash-command skills for Claude Code:

- `/office-hours` — product interrogation / discovery
- `/plan-ceo-review` — strategic review of a feature idea
- `/plan-eng-review` — engineering review of a plan
- `/plan-design-review` — design review of a plan
- `/design-consultation` — design consultation
- `/design-shotgun` — rapid design exploration
- `/design-html` — HTML design prototyping
- `/review` — code review of a branch
- `/ship` — release a branch/PR
- `/land-and-deploy` — land and deploy
- `/canary` — canary release workflow
- `/benchmark` — benchmarking
- `/browse` — web browsing
- `/connect-chrome` — connect to Chrome
- `/qa` — QA a staging URL
- `/qa-only` — QA without other steps
- `/design-review` — review existing design
- `/setup-browser-cookies` — browser cookie setup
- `/setup-deploy` — deployment setup
- `/setup-gbrain` — gbrain setup
- `/retro` — engineering retrospective
- `/investigate` — root-cause investigation
- `/document-release` — release documentation
- `/document-generate` — generate documentation
- `/codex` — Codex integration
- `/cso` — security audit (OWASP + STRIDE)
- `/autoplan` — autonomous planning
- `/plan-devex-review` — DevEx review of a plan
- `/devex-review` — DevEx review
- `/careful` — careful/cautious mode
- `/freeze` — freeze workflow
- `/guard` — guard workflow
- `/unfreeze` — unfreeze workflow
- `/gstack-upgrade` — upgrade gstack
- `/learn` — learning workflow
