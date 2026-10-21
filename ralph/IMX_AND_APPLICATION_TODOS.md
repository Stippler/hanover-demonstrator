# IMX (SkiMaintenance showcase) and application — remaining work

This file lists **open tasks** for the **IMX / Verifiable Credential** handoff and related **application** gaps. It does not track generic product backlog.

**Draft credential JSON (unsigned)** lives in [`ski-maintenance-draft/`](ski-maintenance-draft/): two participant bundles (**Atomic** digital passport / DPP, **Wintersteiger Machine** repair) × (Provider, Application, Connector, Service), plus per-participant **compliance** handoff files.

| Participant | Files |
|---------------|--------|
| Atomic | `SkiMaintenance.Atomic.{Provider,Application,Connector,Service,ComplianceCredential}.json` |
| Wintersteiger Machine | `SkiMaintenance.Wintersteiger.{Provider,Application,Connector,Service,ComplianceCredential}.json` |

There is **no** separate IMX Device credential in this demonstrator (no dedicated physical device / gateway in scope).

### Signing checklist (after placeholders are filled)

1. Replace every `REPLACE_*` string in the JSON files (registration numbers, digests, JWT placeholders).
2. Align credential `id` URIs with URLs where you will host the JSON (if the importer fetches by `id`).
3. Open [vc-jwt.io IMX playground](https://vc-jwt.io/imx-playground), paste each credential JSON, sign, and store `vc+jwt` outputs as agreed (e.g. Teams).
4. Build the Gaia-X **label** credential that lists **`gx:compliantCredentials`** (each entry: `gx:ComplianceEvidence` with `gx:digestSRI` + `id`) for each signed artifact — only after payloads are final. Reference: decoded payload in `ralph/Nestfield.ComplianceCredential.json` (Nestfield) and `unsignedLabelCredentialTemplate` inside each `SkiMaintenance.*.ComplianceCredential.json`.
5. Optionally assemble a Verifiable Presentation JWT if required (`ralph/Nestfield.vp.jwt`).
6. Re-validate property names and use-case IRIs against the [IMX ontology](https://imx-extension.lab.gaia-x.eu/development/rdf/ontology).

---

## IMX credentials and process

1. **Replace placeholders** in `ralph/ski-maintenance-draft/SkiMaintenance.*.json`: registration fields on both Provider credentials, digest placeholders in `unsignedLabelCredentialTemplate`, and `signedComplianceCredentialJwt` after signing.

2. **Issuer DID and hosting**: If the issuer is `did:web:imx.vactory-projects.com`, ensure **`did.json`** (and any IMX-required well-known resources) are served at that host, consistent with the **EDC / Gaia-X** stack (`edc-dpp`, `edc-repair-shop` Caddy routes and compose `DIDWEB_DOMAIN`). Local **gx-compliance** signs label VCs with a DID derived from `BASE_URL` (`did:web:compliance.imx.vactory-projects.com` in `docker-compose.yml`).

3. **Ontology and playground validation**: Re-check all `imx:*` types and properties against the [IMX extension ontology](https://imx-extension.lab.gaia-x.eu/development/rdf/ontology) and sign in the [IMX vc-jwt playground](https://vc-jwt.io/imx-playground). Adjust **supported standards / use cases** if the showcase requires specific IRIs.

4. **Service credential semantics**: Atomic uses the **DPP API** base; Wintersteiger uses the **Repair API** base. **Confirm with showcase owners** whether they require OpenAPI/Swagger URL or accept a plain REST base.

5. **Connector endpoint shape**: Drafts use DSP roots behind Caddy (`…/dsp`). Confirm whether IMX expects the **DSP root only**, **management URL**, or another **canonical connector URL**.

6. **Compliance / label JWT**: After each VC payload is final, compute **digests** (SRI) and produce the **signed label VC-JWT**. Local path: `POST {GX_COMPLIANCE_URL}/api/credential-offers/standard-compliance` with `Content-Type: application/vp+jwt`; response body is the **raw VC-JWT** (`application/vc+jwt`), not a JSON wrapper — see `bridge/credentials.py` (`submit_to_compliance`). For Nestfield-style JSON, paste that string into `signedComplianceCredentialJwt` in `SkiMaintenance.*.ComplianceCredential.json`.

7. **Verifiable Presentation**: If required, bundle signed VCs into a VP JWT (pattern: `ralph/Nestfield.vp.jwt`).

8. **Compliance engine vs playground**: Decide whether **`gx-compliance`** (or IMX extension) emits VC-JWTs the **IMX importer** accepts; if not proven, use the **playground** for the demo path first.

9. **Teams / import**: Upload **final signed artifacts** (and source JSON if requested) to the shared location; verify the importer reads **endpoints** as expected.

10. **TLS and demo network**: Caddy in compose uses **HTTP on port 8100** with hostnames; production-style URLs in the drafts use **`https://…`**. On-site Wi‑Fi, confirm **actual scheme/host/port** and update `imx:endPoint` values so they resolve for importers.

---

## Gaia-X `participant.json` (EDC, not FastAPI)

This file is **not** served by the Repair or DPP APIs. Each **EDC control plane** (`edc-dpp…`, `edc-repair-shop…`) serves its own `/.well-known/participant.json` with `did:web:edc-<participant>.<domain>`. You should have **two** distinct self-descriptions for the **two legal/connectors roles**, with **real** registration and address fields when required by compliance or IMX. Optional fields are wired via `DIDWEB_*` environment variables on both connectors in `docker-compose.yml` (rebuild the EDC control-plane image after changing `did-web-extension`).

## Application and platform (related to showcase)

1. **Public URLs**: Ensure **repair UI**, **trace dashboard**, **DPP API**, **Repair API**, and **EDC** hostnames used in credentials match **what will be live** during the fair (DNS, TLS termination, firewall).

2. **OpenAPI / “service” documentation**: If the showcase expects a **Swagger/OpenAPI** link on the service credential, confirm **FastAPI** docs path (`/api/docs` vs disabled) and document the **canonical** URL in the service credential.

3. **No app code changes** are implied by these drafts alone. If organizers require **well-known** paths for participant JSON **on the same origin** as the app, add **routing/static** hosting (or document external hosting).

4. **Legal entity on Provider credential**: Fill **real** `gx:registrationNumber` (and display name) for **Atomic** and **Wintersteiger Machine** separately.

---

## Quick reference — draft endpoints (from Caddy layout)

| Role | Participant | Draft `imx:endPoint` |
|------|-------------|----------------------|
| Application | Atomic (trace / passport observability) | `https://traces.imx.vactory-projects.com/` |
| Application | Wintersteiger Machine (repair UI) | `https://repair.imx.vactory-projects.com/` |
| Service | Atomic (DPP API) | `https://dpp.imx.vactory-projects.com/api` |
| Service | Wintersteiger Machine (Repair API) | `https://repair.imx.vactory-projects.com/api` |
| Connector | Atomic | `https://edc-dpp.imx.vactory-projects.com/dsp` |
| Connector | Wintersteiger Machine | `https://edc-repair-shop.imx.vactory-projects.com/dsp` |

---

## Reference examples (Ralph / Nestfield)

Original templates and signed samples: `ralph/Nestfield.*.json`, `ralph/Nestfield.ComplianceCredential.json`, `ralph/Nestfield.vp.jwt`.
