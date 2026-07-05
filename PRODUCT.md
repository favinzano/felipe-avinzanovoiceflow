# Product

## Register

product

## Users

Privacy-conscious Windows users who dictate instead of type: developers, writers, and anyone who wants fast, accurate speech-to-text without sending audio to the cloud. The primary user is also the developer/owner (felipe avinzano) dogfooding their own daily-driver tool. Context of use: a quick global-shortcut recording while working in another app, then an instant paste back into that app — the tool should stay out of the way and never steal focus.

## Product Purpose

felipe avinzano Voice (rebranding to felipe avinzano VoiceFlow) converts speech to text entirely on-device using locally-run Whisper models (Base for speed, Large v3 Turbo for accuracy). No cloud transcription, ever. Success looks like: press a shortcut, speak, get clean text pasted where the cursor is, with latency and accuracy the user can trust for real work — plus a floating overlay that shows status without taking focus.

## Brand Personality

Precise, private, understated. Confidence expressed through restraint and craft, not through SaaS flourish. The existing visual language (ink/bone/paper neutrals, a single copper accent, a hand-built "incision-mark" logo suggesting surgical precision, sharp corners, rotated elements, offset hard shadows, DM Serif Display reserved for a single wordmark segment) already embodies this — preserve and extend it rather than reinvent it.

## Anti-references

Do not read as a generic cloud transcription SaaS (Otter.ai and similar). Specifically avoid:
- Gradient hero sections or gradient text
- The cream/sand/beige "AI default" neutral palette — this app's neutrals are ink/bone/paper, not warm parchment tones
- Card-grid "dashboard-by-numbers" layouts with no point of view
- Rounded, soft, glassy SaaS chrome — this product's language is sharp corners, hard offset shadows, and precise angles

## Design Principles

- **Precision over decoration**: every visual choice (the incision-mark, the rotated elements, the offset shadows) should read as deliberate and exact, echoing the product's actual job — accurate transcription.
- **Local-first is a feature, show it**: privacy and on-device processing are differentiators; surface them in copy and UI (e.g. the privacy-strip on the recorder card), don't bury them in settings.
- **Stay out of the way**: the floating overlay and global shortcuts exist so the user never breaks flow. Any new UI must respect this — no focus-stealing, no interruptive modals during recording.
- **Restraint over flourish**: copper is a single accent, not a palette. One serif wordmark segment, not a decorative type system. Quiet confidence, not SaaS loudness.
- **Practice what you preach**: the app dogfoods its own dictation for its own settings/history copy — the UI should feel like it was actually used to write itself.

## Accessibility & Inclusion

Standard WCAG AA: sufficient color contrast (body text ≥4.5:1, especially given the light bone/paper backgrounds), full keyboard navigation for all controls (recording, history, settings), and `prefers-reduced-motion` alternatives for the recording pulse/waveform animations and panel reveal transitions.
