# P(DOOM) — interview decision record

The current consolidated build brief is [mvp-spec.md](mvp-spec.md). This record preserves the interview decisions and the important changes in scope. All twelve product questions have answers; implementation has not started.

## Confirmed decisions

| Question | User decision |
| --- | --- |
| Q1: player | Eliezer-inspired safety researcher with a worried HUD face |
| Q2: tone | Affectionate satire of the whole AI scene |
| Q3: duration | Normal-length Doom level, with roughly 80% of the core jokes/concept in the first minute and deeper Easter eggs later |
| Q4: art | A classic Doom × B frontier lab hybrid, especially B's paperclip creature; C can provide occasional details |
| Q5: arsenal | Pistol → System Prompt; shotgun → RLHF; plasma → Mechanistic Interpretability; BFG → Big Fucking Shutdown Button. Recreate missing assets without insisting on authenticity |
| Q6: enemies | Three risk creatures: deceptive alignment, sycophancy, paperclip/specification gaming; plus Sam |
| Q7: boss | Sam is the required finale |
| Q8: story | P(DOOM), containment breach before a training run, all you have is a system prompt and Bayes' rule, defeat Sam and hit shutdown; victory delays deployment by 48 hours |
| Q9: difficulty | Five p(doom) settings: 1%, 10%, 50%, 90%, 99%; default 10% |
| Q10: resources | Health = Touch Grass; armor = Guardrails; ammunition = Training Data |
| Q11: browser scope | Desktop Chrome/Edge first; Firefox and Safari later |
| Q12: technology | Three.js with convincing Doom-inspired gameplay; exact original Doom mechanics may be approximated |

## Scope changes that supersede earlier proposals

- The initial WASM-only requirement was explicitly reopened by the user, researched, and replaced by the Three.js choice. Do not start a Doom-port integration based on the original request.
- The initial recommendation of a 60–90-second complete run was rejected. Preserve a normal-length level and concentrate recognizable jokes early.
- The visual direction is a genuine A/B blend, not merely A with a few incidental lab labels.
- The BFG name is Big Fucking Shutdown Button, replacing the earlier Big Fucking Guardrail candidate.
- Full original registered-Doom artwork is not required. The user permits recreated missing art, and the Three.js choice also relaxes exact mechanics.
- Five difficulties now require authored tuning rather than passing flags to Doom. Keep the labels/default and the hardest setting's faster enemies and respawning.
- The first milestone targets Chrome/Edge rather than requiring a Firefox/Safari matrix.

## Explicit implementation proposals in the consolidated brief

The brief makes these routine design choices visible for final review: pistol at spawn, shotgun at the first fight, plasma early, Shutdown Button deeper; imp-like deception, rushing sycophancy, floating paperclips, rocket-volley Sam; three small optional research/rationalist discoveries; distinct ammunition pools; a practical desktop viewport baseline and measured frame-time target.

## Artifacts

- [Consolidated MVP specification and acceptance criteria](mvp-spec.md)
- [A: classic Doom](concepts/a-1993-total-conversion.png)
- [B: frontier lab](concepts/b-frontier-lab.png)
- [C: cursed meme WAD](concepts/c-cursed-meme-wad.png)
- [Exact built-in image-generation prompts](concepts/prompts.md)
- [Three.js versus Doom tradeoffs](../research/threejs-vs-doom.md)
- [Archived Doom WASM feasibility research](../research/doom-wasm-options.md)

The concept images remain direction studies. Portrait likenesses, animation frames, and production art are not complete.
