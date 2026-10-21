# SkiMaintenance — Signing Reference

How to produce the signed artifacts for each participant. Follows the exact same pattern as the Nestfield examples in `ralph/Nestfield.*.json`, `ralph/Nestfield.ComplianceCredential.json`, and `ralph/Nestfield.vp.jwt`.

## 1. Sign each VC

For each `SkiMaintenance.<Participant>.{Provider,Application,Connector,Service}.json`, sign the JSON payload via [vc-jwt.io IMX playground](https://vc-jwt.io/imx-playground) or the IMX extension API:

```
POST https://imx-extension.lab.gaia-x.eu/development/validateAndSignVcFromVp
```

Keep the resulting `vc+jwt` strings — you need them for steps 2 and 3.

JWT header shape (from Nestfield):

```json
{
  "alg": "PS256",
  "cty": "vc",
  "iss": "did:web:imx.vactory-projects.com",
  "kid": "did:web:imx.vactory-projects.com#X509-JWK",
  "typ": "vc+jwt"
}
```

## 2. Build the Verifiable Presentation (VP)

Bundle all signed VC-JWTs for one participant into a VP JWT. The VP payload wraps each VC as an `EnvelopedVerifiableCredential` with a `data:` URI:

### Atomic VP payload (4 VCs — no device)

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "type": "VerifiablePresentation",
  "verifiableCredential": [
    {"id": "data:application/vc+jwt,<signed Application VC-JWT>"},
    {"id": "data:application/vc+jwt,<signed Connector VC-JWT>"},
    {"id": "data:application/vc+jwt,<signed Provider VC-JWT>"},
    {"id": "data:application/vc+jwt,<signed Service VC-JWT>"}
  ]
}
```

### Wintersteiger VP payload (4 VCs — no device)

Same structure, different VCs.

VP JWT header shape (from Nestfield):

```json
{
  "alg": "PS256",
  "cty": "vp",
  "iss": "did:web:imx.vactory-projects.com",
  "kid": "did:web:imx.vactory-projects.com#X509-JWK",
  "typ": "vp+jwt"
}
```

Save the raw VP JWT string (no JSON wrapper) into `SkiMaintenance.<Participant>.vp.jwt`.

## 3. Submit VP for compliance → get LabelCredential

Submit the VP JWT to the compliance service:

```bash
curl -X POST \
  'http://gx-compliance:3000/api/credential-offers/standard-compliance?vcid=https%3A%2F%2Fimx.vactory-projects.com%2F.well-known%2Fcompliance%2Fski-maintenance%2F<participant>-label' \
  -H 'Content-Type: application/vp+jwt' \
  --data-raw '<VP-JWT string>'
```

Or via the IMX extension:

```bash
curl -X POST https://imx-extension.lab.gaia-x.eu/development/validateAndSignVcFromVp \
  -H 'Content-Type: application/vp+jwt' \
  --data-raw '<VP-JWT string>'
```

The response body is a raw VC-JWT string (`Content-Type: application/vc+jwt`). Its decoded payload will look like:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/gaia-x/development#"
  ],
  "type": ["VerifiableCredential", "gx:LabelCredential"],
  "id": "https://imx.vactory-projects.com/.well-known/compliance/ski-maintenance/<participant>-label",
  "issuer": "did:web:compliance.imx.vactory-projects.com",
  "validFrom": "<issued timestamp>",
  "validUntil": "<expiry timestamp>",
  "credentialSubject": {
    "id": "https://imx.vactory-projects.com/.well-known/compliance/ski-maintenance/<participant>-label#cs",
    "gx:engineVersion": "1.0.0",
    "gx:compliantCredentials": [
      {
        "type": "gx:ComplianceEvidence",
        "gx:digestSRI": "sha256-<digest of signed Application VC-JWT>",
        "id": "<Application credential id>"
      },
      {
        "type": "gx:ComplianceEvidence",
        "gx:digestSRI": "sha256-<digest of signed Connector VC-JWT>",
        "id": "<Connector credential id>"
      },
      {
        "type": "gx:ComplianceEvidence",
        "gx:digestSRI": "sha256-<digest of signed Provider VC-JWT>",
        "id": "<Provider credential id>"
      },
      {
        "type": "gx:ComplianceEvidence",
        "gx:digestSRI": "sha256-<digest of signed Service VC-JWT>",
        "id": "<Service credential id>"
      }
    ]
  }
}
```

Save the raw VC-JWT string into the JSON wrapper:

```json
{"signedComplianceCredentialJwt":"eyJhbGciOiJQ..."}
```

That's `SkiMaintenance.<Participant>.ComplianceCredential.json`.

## Current unsigned payload digests (for reference only — will change after signing)

| Credential | SHA-256 of unsigned JSON |
|------------|------------------------|
| Atomic.Provider | `sha256-df9719ee2689c0eb3af4dcee4adb3c5ef06022546f9c36d6f5f87c355d5b4ab9` |
| Atomic.Application | `sha256-43d98a3a122bab9737928749d70a283b523ec188f1a763b51a5310a48c5f30f3` |
| Atomic.Connector | `sha256-dfe0976fded2f519654e2c28aa8d502da6b26b74db1508d7b4c1bcd1c5300079` |
| Atomic.Service | `sha256-89904e18a95ac3ae8eeeafa07f1e4480f6c28f6797c016ee25fb976ed24de242` |
| Wintersteiger.Provider | `sha256-774d8263c135e79d1cd96ecac0f85a960dc0da1bdd8f8a70c108482e376024c9` |
| Wintersteiger.Application | `sha256-3b06ba131de7894e0b86220c42e1183ee884192b7af753f010913e395c4eb553` |
| Wintersteiger.Connector | `sha256-e9e707e52c18b0e26790d6fa463d4a683b4bcea05d5ac648f4a5d9b8002f4a3a` |
| Wintersteiger.Service | `sha256-9cb2f1ff8213b1d7d30274fe6b1441917190f5f686531b1f4a650668c89a8154` |

**Note:** The `gx:digestSRI` in the compliance credential uses the digest of the **signed VC-JWT string**, not the unsigned JSON. These will differ.
