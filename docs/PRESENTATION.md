# Hanover Ski Passport Demonstrator — Presentation Outline

Use this file as speaker notes and as a brief for slide design (PowerPoint, Keynote, Google Slides, or [Marp](https://marp.app/) with `---` between slides if you split it later).

---

## Slide 1 — Title & one-liner

**Headline:** Hanover Ski Passport Demonstrator  
**Subline:** Federated Digital Product Passport (DPP) — trust and data exchange without a shared API key

**Bullets (optional, max 2):**

- Repair shop scans a ski QR code → passport data from a separate DPP provider
- Built on **Eclipse EDC** + **Gaia-X** compliance in a realistic multi-connector setup

**How to design it**

- **Visual:** One strong hero image — ski / QR / passport metaphor, or the architecture overview SVG from `docs/images/architecture-overview.svg` faded as background at ~15–20% opacity.
- **Layout:** Large title, short subline; avoid clutter. One accent color (e.g. alpine white + deep blue or forest green) consistent with the rest of the deck.
- **Logo strip (small footer):** Gaia-X, Eclipse EDC, optional org logo — establishes credibility without dominating.

---

## Slide 2 — The story (why federated?)

**Headline:** Two organizations, two connectors — one controlled data path

**Bullets:**

- **Repair Shop** — Next.js UI + FastAPI; needs passport data to service the product
- **DPP provider** (“Digital Ski Passport”) — holds passport JSON; exposes it only through policy
- **No** single shared backend key: each side runs its **own** Control Plane + Data Plane (EDC)
- Trust at negotiation time: **Gaia-X** verifies presentations while the DPP connector evaluates policy

**How to design it**

- **Visual:** Simple **two-column or two-cloud diagram** — left “Repair”, right “DPP”, thin arrows labeled “catalog → negotiate → transfer → pull” (no need for all seven steps).
- **Contrast:** Use two distinct but harmonious colors for the two participants; keep text short (this slide is the “human” story).
- **Optional callout:** One short quote or callout box: *“Access is negotiated, not hard-coded.”*

---

## Slide 3 — What actually happens (technical flow)

**Headline:** From QR scan to passport JSON

**Bullets (tight sequence):**

1. User scans QR → Repair Web calls Repair API  
2. Repair API drives **Repair EDC** — catalog, contract negotiation, transfer, **EDR**  
3. **DSP** links Repair CP ↔ DPP CP; DPP side talks to **Gaia-X compliance** during policy  
4. Repair API performs **HttpData-PULL** with EDR → **DPP Data Plane** → DPP API → JSON back to UI  

**Optional second line:** Trace pipeline (repair-api, dpp-api, EDC) → trace dashboard for demos and debugging.

**How to design it**

- **Visual:** Prefer the **numbered flow** from the README (reuse `architecture-overview.svg` or a simplified copy with only 4–5 numbered steps). Horizontal left-to-right works well on 16:9.
- **Typography:** Numbers in circles (1–6) along a single path; one font size for steps, smaller for “DSP / Gaia-X / EDR” labels.
- **Density:** If it feels busy, split into “Negotiation” (steps 1–4) and “Data transfer” (5–6) on two builds/animations — not two slides unless you have time.

---

## Slide 4 — What we demonstrate & closing

**Headline:** Takeaways

**Bullets:**

- **EDC:** Federated catalog, contract negotiation, controlled transfer (e.g. HttpData-PULL + EDR)  
- **Gaia-X:** Policy-time compliance in the DPP control plane (verifiable presentations)  
- **Identity:** DID Web for connector identities (`/.well-known/did.json` via routing)  
- **Stack:** ~12 containers, Caddy routing, Supabase Postgres; trace observability for live demos  

**Closing line (footer or final build):** Demonstrator for **Gaia-X** and **Eclipse EDC** integration — reference architecture for federated DPP-style scenarios.

**How to design it**

- **Visual:** Three icons or columns for **EDC | Gaia-X | DID** with one word each underneath; optional fourth small tile “Trace / Ops”.
- **Layout:** Top = headline; middle = three pillars; bottom = one-line closing — **no** small appendix text.
- **Consistency:** Reuse the same fonts and accent color from Slide 1; end on the title slide colors for a “bookend” feel.

---

## General design checklist

| Area | Recommendation |
|------|----------------|
| **Slide count** | 4 slides as above; if you must use 3, merge Slide 2 + 3 into “Story + flow” with fewer bullets |
| **Text** | Max 5–7 bullets per slide; prefer phrases over sentences |
| **Demo** | If you live-demo, add a **Slide 0** or appendix: URLs (`repair.*`, `dpp.*`, `traces.*`) from README — or keep on speaker notes only |
| **Assets** | `docs/images/architecture-overview.svg`, README Mermaid (export as PNG if needed) |
| **Depth** | Deeper narrative: `docs/SUMMARY.md`, `docs/ARCHITECTURE.md` |

---

## Optional Marp front matter

If you use Marp, you can prepend:

```yaml
---
marp: true
theme: default
paginate: true
---
```

Then place `---` between each slide’s content block.
