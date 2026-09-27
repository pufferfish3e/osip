# Project rules

- Reread this AGENTS.md at the start of every turn and check compliance before finishing.
- Consult official Revolut design-system documentation or current Revolut interface references before designing or changing UI; ground layout, typography, spacing, controls, and motion in those references.
- Use stock images when needed and available; verify usage rights and keep offline-critical assets local.
- Add animations with GSAP; respect reduced-motion preferences.
- Use the project-scoped `design-taste-frontend` skill at `.agents/skills/design-taste-frontend/SKILL.md` to remove generic styling when creating or revising UI.
- Build mobile-first and preserve PWA installation, offline access, and touch-friendly navigation.
- Prefer guided, multi-step flows with one decision at a time over long forms; preserve entered values when users go Back.
