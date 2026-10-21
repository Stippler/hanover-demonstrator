# Hanover Demonstrator — TODO

## Core demo (Repair ↔ DPP)

Cross-participant passport lookup **already** goes through EDC (catalog, negotiation with Gaia-X, HttpData-PULL). Possible improvements:

- **Trace fidelity** — See [IMPLEMENTATION_STEP1.md](./IMPLEMENTATION_STEP1.md): more lifecycle events attributed to EDC runtimes (not only `repair_api`).
- **Tests** — Add or align automated tests with the slim `docker-compose.yml` (root Playwright config still targets legacy app hostnames by default; see [e2e/README.md](../e2e/README.md)).

## Legacy stack (`docker-compose.legacy.yml`)

The items below apply to the **vendor / vault / service / bridge** scenario, not the default Repair + DPP compose file.

### EDC-mediated workflows (legacy participants)

- [ ] Ownership transfer fully orchestrated via EDC (today may still use direct DB paths in legacy APIs).
- [ ] Passport reads via provider EDC where the narrative requires it.
- [ ] Service shop access mediated by owner connector where applicable.

### Person attribution (legacy apps)

- [ ] Propagate `actor_username` (or equivalent) through events and admin views across vendor/vault/service APIs.

### Shared UI package (`@hanover/ui`)

- [ ] Consolidate layout primitives and migrate legacy apps to shared components (see historical notes in git history for long checklists).

### Admin dashboard (legacy)

- [ ] Surface EDC negotiation and transfer IDs in the admin UI when running the legacy stack.

---

For architecture and service inventory, use [ARCHITECTURE.md](./ARCHITECTURE.md) and the root [README.md](../README.md).
