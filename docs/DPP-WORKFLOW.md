# Digital Product Passport (DPP) — Architecture and What the Demonstrator Shows

## Current default demo (this repository)

The **default** [docker-compose.yml](../docker-compose.yml) runs the **Repair Shop** (web + API + EDC) and **Digital Product Passport provider** (API + EDC), with **Gaia-X compliance** and optional **trace** services. There is **no** separate passport “bridge” on that path: the **DPP API** holds passport data and **self-seeds** the provider connector; **Gaia-X** checks run inside the **DPP EDC control plane** against `gx-compliance`. Overview: [README.md](../README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

The sections below mix **target** federated concepts with descriptions that still mention a **bridge** and **multi-app** (Vendor, VaultA, …) flow. Treat those as **conceptual** or **legacy-compose** context unless you explicitly start [docker-compose.legacy.yml](../docker-compose.legacy.yml).

---

## 1. What the demonstrator is mainly about: Gaia-X between the APIs

The **main message** of the Hanover Demonstrator is:

- **Different participants** (Vendor, Owner A, Owner B, Service Shop) run **their own APIs and systems**.
- They do **not** communicate by all writing into one shared database. Instead, they **discover each other**, **ask questions**, **verify trust**, and **exchange data** through a **federated layer**:
  - **Eclipse EDC** (connectors) provides the protocol: catalog requests, contract negotiation, and data transfer (e.g. HttpData PULL).
  - **Gaia-X** provides the **trust and compliance layer**: before data is exchanged, participants are verified as Gaia-X compliant (self-descriptions, compliance checks, notary). The bridge orchestrates this: it checks that both seller and buyer are compliant before a transfer is allowed.
- So the “thing that lives **between** the different APIs” is **Gaia-X + EDC**: safe authentication, verified identity, and standardized communication so that one participant can **ask** another for data (e.g. “what skis do you have?” or “give me the passport for this ski”) and only get it after trust is established.

In a full deployment, each participant could have **their own database**. The demonstrator uses a **single shared database** for simplicity, but the **application logic** is already participant-scoped (each API only exposes what that participant is allowed to do), and the **data flow** for cross-participant actions (e.g. buying a ski) is designed to go through **EDC + Gaia-X** (catalog, negotiate, verify, transfer). So the takeaway is: **APIs communicate via Gaia-X/EDC; the DPP is resolved globally; lifecycle data can live in respective systems and be copied when ownership changes.**

---

## 2. Global DPP store vs. lifecycle data in respective systems

### The DPP should be stored globally in a separate thing

Conceptually, the **Digital Product Passport** (core product identity + current owner) belongs in a **global, separate store** — not in each participant’s private database. That way:

- Any actor (person scanning a QR, another participant, a service) can **resolve** “what is this product and who owns it?” by asking the **global DPP registry** (or a resolver that fronts it).
- There is **one canonical** “current owner” and one canonical product identity; no conflicting copies.

In the demonstrator:

- The **bridge** plays the role of this global layer: it exposes `/api/passport/lookup/<ski_id>` and the public page `/p/<ski_id>`, which return the product identity and **current owner**. The bridge reads from a central store (in the demo, the same Postgres schema used for simplicity; in a real deployment this could be a dedicated DPP registry or a separate service that only holds DPP records).
- So **“the DPP”** (identity + owner) is **resolved globally** via the bridge; participants’ APIs do not each hold the only copy of “who owns the DPP.”

### Subsequent interactions stored across the digital lifecycle in respective databases

**Lifecycle data** — events, service records, ownership transfer history, inventory — can live **in the respective participants’ systems** (or in distributed stores). Over the product’s life:

- The **vendor** stores manufacturing data and the initial issuance.
- **Owners** store their ownership period, incoming/outgoing transfers, and any data they receive when they buy (e.g. a copy of the passport history).
- The **service shop** stores service records; they may push a summary to the global DPP or to the current owner, or both.

When **ownership transfers**, a common pattern is that the **additional information** (passport history, service history, etc.) is **copied** (or referenced) so that the **new owner** has the full picture. So:

- The **global DPP** is updated: “current owner” changes to the buyer.
- The **lifecycle data** (events, services, transfer records) can be **exchanged via EDC** during the transfer: the seller’s connector provides the passport data; the buyer’s connector receives it and stores it in their own system. So the new owner’s database holds a **copy** of the enriched passport (or the relevant history), even though the canonical “who owns it” remains in the global store.

This keeps a clear separation:

- **Global:** “What is this product? Who owns it?” → DPP registry / bridge.
- **Distributed:** “What happened during its life?” → respective databases; copy-on-transfer so the new owner has the history.

---

## 3. How the demonstrator implements this (simplified for the demo)

To keep the demo deployable and understandable, the current implementation uses **one Postgres database** (hanover schema) for both:

- The **global DPP view** (e.g. `product_passports` + `skis`), which the **bridge** reads to answer “who owns this ski?”
- The **lifecycle data** (`passport_events`, `ownership_transfers`, `service_records`, `inventories`) that in a full architecture could live in each participant’s DB.

So in the demo:

- **Bridge** = the “global” DPP resolver: it exposes the canonical product identity and current owner; QR codes point to it.
- **Participant APIs** = each enforces **business rules** (vendor can create and sell; vaults can accept and resell; service can add service records). They all write into the same DB, but the **intended concept** is: “global DPP store” (bridge) + “lifecycle data that could be in respective DBs and copied on transfer.”
- **EDC + Gaia-X** = the layer that would, in a full setup, carry the actual **requests and data** between participants (catalog, negotiate, verify compliance, transfer). The demonstrator seeds EDC with assets and uses the bridge to **verify Gaia-X compliance** before transfers; the actual data flow can be extended so that passport/history data is requested and received via EDC instead of direct DB access.

---

## 4. Workflow summary: who does what, and where it is stored

| Step | Who acts | Global DPP (bridge / registry) | Lifecycle data (respective systems; in demo: same DB) |
|------|----------|--------------------------------|--------------------------------------------------------|
| Create ski | Vendor | New DPP registered: identity + owner = vendor | Vendor stores manufactured event, inventory |
| Sell to Owner A | Vendor + Owner A | DPP updated: owner = Owner A | Transfer record; optional: passport/history **copied** to Owner A’s side via EDC |
| Owner A sells to B | Owner A + B | DPP updated: owner = Owner B | Transfer record; optional: passport/history **copied** to Owner B’s side via EDC |
| Service | Service shop | (Optional: last-service summary on DPP) | Service shop stores service record; current owner can receive a copy or resolve it when needed |

At every step, **safe authentication and communication** are provided by **Gaia-X** (participant verification, compliance) and **EDC** (discovery, negotiation, transfer). The demonstrator shows that **the APIs talk to each other through this layer** — asking questions, verifying trust, then exchanging or updating data — rather than only by writing into one shared table.

---

## 5. References

- [Digitaler Produktpass (Wikipedia)](https://de.wikipedia.org/wiki/Digitaler_Produktpass) — EU Ökodesign, unique product identifier, weblink/QR, life-cycle data.
- Hanover README: “Digital Product Passport (DPP) design” and “Architecture” for technical layout and service roles.
- Bridge API: `/api/verify`, `/api/edc/catalog`, `/api/edc/negotiate`, `/api/edc/transfer` — the Gaia-X and EDC endpoints that sit **between** the participant APIs.
