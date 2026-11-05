# FGAI-2026-001 — Decisions Log

| Date | Decision | By | Notes |
|---|---|---|---|
| 2026-11-05 | **SCOPE gate approved** with default answers: B1 founder signs SCOPE/DESIGN/UAT, QA and Security get an independent read-only agent review plus a human reviewer still to be named. B2 ScamShield is rules only, with the AI explainer off. B3 the 30-family pilot is a proposal document. A1–A10 accepted. | Product Owner (founder), in chat: "อนุมัติ ทำต่อได้เลย เร่งหน่อย เพิ่ม agent" | Recorded by the lead agent from the owner's chat message |
| 2026-11-05 | Owner asked to speed up and add agents. **Design, architecture and implementation now run in parallel at the owner's direction.** DESIGN and ARCH are *not* signed yet. Clickable screens and the independent security review are being produced alongside the code, and both gates must still be signed before QA. | Product Owner | Deviation from the strict gate order, accepted by the owner. Risk: rework if design or security reviews require changes |
| 2026-11-05 | Stack as installed: Next 16.4, React 19.3, Fastify 5.12, Drizzle 0.45, pg-boss 12, zod 4, Postgres 17 (Docker, port 5433), pnpm 12, Node 24 (nvm). | Lead agent | ADR-001…008 still apply. The architecture doc said "Next 15" and is superseded by 16 |
