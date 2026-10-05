---
inclusion: fileMatch
fileMatchPattern: ["src/art/**", "src/ui/**", "src/styles.css"]
---
# Visual implementation routing

Read the relevant DESIGN.md sections before visual/interaction changes; it owns
Nutshell identity, palette roles, people/rooms, drag/depth, sound, compact staging
and surface coverage. Use src/ui/tokens.css and existing styles as the shared
implementation; keep authored art authoritative over generic web design systems.

Preserve APNG timing, repaired alpha, posters and registry geometry. Compare
visible base size with Pip, scale uniformly and stage 1–4 employees per room.
Keep readable stable mood bubbles on sprite anchors; prevent flicker/occlusion.
Do not solve compact layouts by hiding people, furniture and main actions.

Decoration uses one transform, original grab offset and pointer capture; prevent
text/native-image dragging. Keep full catalog-tile targets, deterministic overlap
selection, cancel rollback and surface/anchor/depth invariants. A temporary visual
lift must not overwrite committed ordering. Follow DESIGN.md's clean preview
contract; remove editor-like cursor graphics, instructions, arrows and guides.

Differentiate room composition/materials/light/activity/ambience with existing
assets and leave meaningful space for purchased decorations. Give one-on-one
visits real staging and minigames usable boards with immediate input.
Use zooworkers-playtest for actual rendered inspection before acceptance.
