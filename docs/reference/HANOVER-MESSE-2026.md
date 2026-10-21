# Hanover Messe 2026 — IMX Showcase Reference

This document consolidates information from Gaia-X community resources, the IMX showcase meeting notes, and reference materials for the HM26 demonstrator.

## Files in this directory

| File | Description |
|------|-------------|
| `DataspaceBlueprint_Paper.pdf` | Michael Spiegel's paper on building and deploying dataspaces with EDC and Gaia-X (FHV). Covers MVD architecture, control/data plane separation, deployment strategies. |
| `HM26-List of all Showcase components.xlsx` | **TODO: copy from local** — List of all showcase components for Hanover Messe 2026 |
| `Gaia-X Basic Compliance Engine_Introduction_(251112)_rr.pptx` | **TODO: copy from local** — Introduction to the Gaia-X Basic Compliance Engine |
| `IMXC-Showcase-HM2026 (1).pptx` | **TODO: copy from local** — IMX Showcase presentation for HM2026 |

To copy the missing files from your local machine:

```bash
scp ~/Downloads/HM26-List\ of\ all\ Showcase\ components.xlsx rising-wind:~/hanover-demonstrator/docs/reference/
scp ~/Downloads/Gaia-X\ Basic\ Compliance\ Engine_Introduction_\(251112\)_rr.pptx rising-wind:~/hanover-demonstrator/docs/reference/
scp ~/Downloads/IMXC-Showcase-HM2026\ \(1\).pptx rising-wind:~/hanover-demonstrator/docs/reference/
```

---

## 1. IMX Extension — Compliance Service

The **IMX extension** is a Gaia-X compliance service extension that adds additional credential types specific to the Industrial Metaverse (IMX) showcase. It can be used **without local setup** via the hosted instance, or self-hosted with your own signing keys.

### Hosted Endpoints

| Resource | URL |
|----------|-----|
| **VC-JWT Playground** | https://vc-jwt.io/imx-playground |
| **IMX Compliance Swagger** | https://imx-extension.lab.gaia-x.eu/development/docs |
| **Validate & Sign VP** | `POST https://imx-extension.lab.gaia-x.eu/development/validateAndSignVcFromVp` |
| **DID Document** | https://imx-extension.lab.gaia-x.eu/development/did.json |
| **X.509 Certificate** | https://imx-extension.lab.gaia-x.eu/development/x509CertificateChain.pem |
| **RDF Ontology** | https://imx-extension.lab.gaia-x.eu/development/rdf/ontology |
| **SHACL Shapes** | https://imx-extension.lab.gaia-x.eu/development/rdf/shapes |
| **Source Code** | https://gitlab.com/gaia-x/gaia-x-community/vc-jwt.io |

### IMX Compliance API

The main endpoint is:

```
POST /development/validateAndSignVcFromVp
Content-Type: application/vp+jwt
Body: <VP-JWT string>
```

This validates a Verifiable Presentation JWT and, if compliant, returns a signed compliance credential. This is the same pattern our bridge uses with the standard `gx-compliance` service, but the IMX extension validates **additional** IMX-specific credential types.

### Self-Hosting

The [vc-jwt.io](https://gitlab.com/gaia-x/gaia-x-community/vc-jwt.io) repo provides both a **backend** (DID + signing) and **frontend** (playground UI). To self-host:

```bash
git clone https://gitlab.com/gaia-x/gaia-x-community/vc-jwt.io.git
cd vc-jwt.io/backend
npm run generate-env   # generates .env with openssl command for keys
# Run the openssl command, paste cert into .env
docker compose up -d --build
```

Key backend env vars:

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Domain for the DID document (e.g. `vc-jwt.io`) |
| `PRIVATE_KEY` | PEM private key for signing VCs |
| `PRIVATE_KEY_ALGORITHM` | `ES256` or `RS256` |
| `PUBLIC_KEY` | Derived from private key, used in DID doc |
| `CERTIFICATE` | X.509 cert for `x5u` in DID doc |
| `JWKS_KEY_NAME` | ID of the assertionMethod (default: `X509-JWK2020`) |

---

## 2. IMX Ontology — Credential Types

The IMX extension defines an OWL ontology extending Gaia-X core with these credential/entity types:

### Participant Credentials

- **`imx:Participant`** — extends `gx:Participant`. Properties: `schema:name`, `gx:registrationNumber` (→ `gx:CompanyRegistration`).
- **`gx:CompanyRegistration`** — official registration data: `gx:countryCompanyNumber`, `gx:companyNumberQualifier`, `gx:countryCode` (ISO-3166-1 Alpha-2).

### Technical Asset Credentials

| Type | Description |
|------|-------------|
| `imx:ConnectorCredential` | Technical connector (e.g. EDC connector) |
| `imx:ApplicationCredential` | Application/software |
| `imx:DeviceCredential` | Physical device / edge device |
| `imx:ServiceCredential` | Service offering |
| `imx:ProviderCredential` | Provider entity |

### Common Properties for Assets

- **`imx:operatedBy`** → links to `imx:Participant`
- **`imx:endPoint`** → `xsd:anyURI` (technical endpoint)
- **`imx:supportedStandards`** → list of `imx:StandardSupportEntry`, each with:
  - `imx:supportedStandard` → one of: `imx:DSPStandard`, `imx:AASStandard`, `imx:DCPStandard`, `imx:OCPStandard`, `imx:SMPStandard`
  - `imx:supportedStandardEvidence` → `xsd:anyURI`
- **`imx:supportedUseCases`** → one of: `imx:BatteryPassportUseCase`, `imx:EdgeManagementUseCase`

### Standard Abbreviations

| Standard | Full Name |
|----------|-----------|
| DSP | Dataspace Protocol (IDSA) |
| AAS | Asset Administration Shell (Industrie 4.0) |
| DCP | Decentralized Claims Protocol |
| OCP | Open Credential Protocol |
| SMP | Service Metadata Publishing |

---

## 3. VC-JWT Playground — DID Document Structure

The hosted playground at `vc-jwt.io` serves a reference DID document at `/.well-known/did.json`:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:web:vc-jwt.io:api",
  "verificationMethod": [{
    "@context": "https://w3c-ccg.github.io/lds-jws2020/contexts/v1/",
    "id": "did:web:vc-jwt.io:api#X509-JWK2020",
    "type": "JsonWebKey2020",
    "controller": "did:web:vc-jwt.io:api",
    "publicKeyJwk": {
      "kty": "RSA",
      "n": "wg4RvIoV-71Zop46...",
      "e": "AQAB",
      "alg": "RS256",
      "x5u": "https://vc-jwt.io/api/.well-known/x509Certificate.pem"
    }
  }],
  "assertionMethod": ["did:web:vc-jwt.io:api#X509-JWK2020"]
}
```

This is the same structure our EDC connectors now serve at `/.well-known/did.json` via the `did-web-extension`.

---

## 4. Dataspace Blueprint Paper — Key Takeaways

From Michael Spiegel's paper (FHV, `DataspaceBlueprint_Paper.pdf`):

### Architecture (Figure 2)

The control plane handles:
1. **Catalog Request** — consumer CP queries provider CP's catalog
2. **Contract Negotiation** — consumer CP negotiates contract agreement with provider CP
3. **Transfer Process Management** — consumer CP initiates transfer process with provider CP
4. **Data Transfer** — actual data flows between data planes

### Component Roles

- **Control Plane**: publishes catalog, manages policy engine, handles contract negotiations and transfer management
- **Data Plane**: handles actual data transmission, registers with control plane, supports multiple wire protocols
- **Identity Hub**: stores and manages Verifiable Credentials (like a wallet), handles presentation and issuance
- **Catalog Server**: provides catalogs with assets and linked assets (references to control planes)

### Contract Negotiation Flow (detailed)

1. Consumer CP receives negotiation request
2. Stores negotiation record, transitions to "requesting" state
3. Sends request to provider CP via `/api/dsp/negotiations/request`
4. Provider acknowledges, stores own negotiation record
5. Provider processes request → "agreeing" state
6. Provider sends agreement to consumer at `/api/dsp/negotiations/{id}/agreement`
7. Consumer stores agreement, provider transitions to "verified"
8. Provider finalizes via `/api/dsp/negotiations/{id}/events`
9. Consumer verifies, both update records to "completed"

### Deployment

- **Simple**: Docker Compose — all components in one `docker-compose.yml` per participant
- **Flexible**: Kubernetes — each component has its own pipeline, supports rolling updates and scaling
- The MVD uses separate VMs for consumer and provider to simulate different organizations

---

## 5. Domain / Hosting Notes

From the email discussion:

- A domain purchase is being considered (previously using https://www.world4you.com/hosting/web-hosting)
- Jason is working on the EFRE project website — check with him about domain options
- The IMX compliance extension can be used **without local setup** via the hosted endpoints above
- A video recording of the compliance extension demo was mentioned but not yet available

---

## 6. Relevance to Our Demonstrator

### What we already have
- EDC connectors with Gaia-X compliance checks (gaiax-auth-extension)
- DID documents served from each connector (`did-web-extension`)
- `.well-known/participant.json` self-descriptions
- VC/VP generation and compliance submission flow
- Trace dashboard showing the full negotiation lifecycle

### What could be added for IMX
- **IMX credential types**: extend our VCs to include `imx:ConnectorCredential`, `imx:Participant` with registration numbers
- **IMX compliance validation**: submit VPs to the IMX extension endpoint instead of (or in addition to) the standard `gx-compliance`
- **Supported standards**: declare `imx:DSPStandard` support in our connector credentials
- **Use case tagging**: tag assets with `imx:BatteryPassportUseCase` (or a ski-passport equivalent)
- **Self-hosted vc-jwt.io**: could replace or complement our bridge's VC signing with the official Gaia-X playground tooling
