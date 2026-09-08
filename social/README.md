# Orbitus Robotica social campaign

This folder turns the public ROB archive into reviewable Facebook drafts for the
run-up to Maker Faire Bay Area 2026. The campaign is designed for the Orbitus
Robotica profile and its existing informal, enthusiastic voice.

## Campaign guardrails

- Draft first. Do not publish, comment, message, upload, or schedule a Facebook
  post without a human reviewing the exact copy and media.
- Use only claims supported by `source-map.md`, the website, or the ROB books.
- Describe experimental work as experimental. Do not turn a commanded motion,
  a photograph, or a prototype into a verified capability claim.
- Prefer photographs without identifiable children or bystanders. Confirm
  permission before using a recognizable person in promotional material.
- Never expose credentials, pairing data, private logs, precise storage
  locations, network details, or unpublished safety information.
- Use "ROB" in conversational copy. "R.O.B." remains acceptable when quoting a
  historical title or the Maker Faire project name.
- The 2026 event is the campaign target. Do not claim that ROB's appearance or
  schedule is confirmed unless the team has confirmed it for that post.

## Files

- `source-map.md`: approved facts and representative media.
- `content-calendar-2026-09.md`: the daily editorial sequence.
- `drafts/maker-faire-2026-ramp-up.md`: the first ready-to-review post batch.
- `automation/daily-draft-task.md`: a recurring Codex/ChatGPT task prompt.
- `automation/question-triage-task.md`: a recurring, draft-only comment check.
- `reels/2019-rob-learned-to-move/`: the first reel and its build notes.

Run `scripts/build-social-reel-2019.sh` from the repository root to rebuild the
2019 reel from the existing gallery video files.
