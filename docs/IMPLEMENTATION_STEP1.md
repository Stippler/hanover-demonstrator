# Implementation Step 1 — Make the Trace Reflect the Real EDC Flow

## Goal

The user's observation is correct: steps 8–12 in the trace (agreement, transfer, EDR,
data plane fetch) all show as `repair_api` events, giving the false impression that
the Repair API handles the dataspace protocol. In reality, the EDC connectors do all
the heavy lifting. The trace should reflect that.

## What Needs to Change

### Problem 1: repair_api acts as orchestrator but traces itself as the actor

Currently `repair_api` makes Management API calls to `repair-edc-cp` and emits trace
events as if **it** performed the catalog, negotiation, transfer, and data fetch. The
EDC connectors (which actually execute the DSP protocol) emit nothing.

### Problem 2: The data plane proxy hop is invisible

When `repair_api` calls the data plane (`dpp-edc-dp:9291/api/public`), the data plane
validates the JWT, proxies the request to `dpp-api`, and returns the response. This
entire proxy step is invisible — there are no trace events from the data plane.

### Problem 3: Provider-side events only cover Gaia-X

`dpp-edc-cp` only emits Gaia-X events (via the Java extension). It does not emit events
for receiving the negotiation, accepting the contract, or provisioning the transfer.

---

## Proposed Changes

### Change A: Add trace emission to the EDC Java extension for all negotiation lifecycle events

The `gaiax-auth-extension` already has access to the `EventRouter`. Subscribe to additional
EDC events and emit trace events for each:

| EDC Event | Trace event to emit | Source |
|---|---|---|
| `ContractNegotiationRequested` (provider) | `edc_negotiation_received` | `dpp_edc` |
| `ContractNegotiationAgreed` | `edc_contract_agreed` | `dpp_edc` |
| `ContractNegotiationFinalized` | `edc_contract_finalized` | `repair_edc` or `dpp_edc` |
| `TransferProcessRequested` | `edc_transfer_requested` | `dpp_edc` |
| `TransferProcessStarted` | `edc_transfer_provisioned` | `dpp_edc` |

**Implementation:**

1. Expand `GaiaxNegotiationListener` (or create a new `EdcLifecycleTracer` class) to listen
   for more event types:

```java
eventRouter.register(ContractNegotiationRequested.class, listener);
eventRouter.register(ContractNegotiationAgreed.class, listener);
eventRouter.register(ContractNegotiationFinalized.class, listener);
eventRouter.register(TransferProcessRequested.class, listener);
eventRouter.register(TransferProcessStarted.class, listener);
```

2. In the `on()` method, emit trace events with source `repair_edc` or `dpp_edc`
   (based on `localParticipantId`), not `edc_gaiax_extension`.

3. The trace ID correlation uses the existing `lookupPendingTraceId()` mechanism.

**Files to change:**
- `GaiaxAuthExtension.java` — register more event types
- `GaiaxNegotiationListener.java` → rename to `EdcLifecycleTracer.java`, handle multiple events
- `GaiaxComplianceClient.java` — add an `emitTrace` overload that accepts a custom source name

### Change B: Re-attribute repair_api trace events

Change the `source` field for EDC-orchestration events in `repair_api` from `repair_api`
to `repair_edc` to make it clear these are EDC operations, not application logic.

The only events that should keep `source: repair_api` are:
- `qr_scanned` (user action)
- `dpp_data_returned` (application receives result)

All others (`edc_catalog_query`, `edc_catalog_received`, `edc_contract_negotiation`,
`edc_agreement_reached`, `edc_transfer_started`, `edc_edr_received`, `edc_data_plane_fetch`)
should use `source: repair_edc`.

**Files to change:**
- `backend/repair_api/main.py` — change `_emit_trace` calls to use `repair_edc` source
  for EDC-related steps

### Change C: Add data plane tracing

The data plane proxy (step 12) is a black box. To make it visible, we have two options:

**Option C1 (recommended): Emit a trace event from dpp_api that acknowledges the data plane origin**

`dpp_api` already emits `data_request_received`. Enhance its payload to include the
data plane endpoint it was called from (inspect request headers for EDC-specific headers).
Change the source from `dpp_api` to `dpp_edc_dp` for data-plane-originated requests.

**Option C2 (heavier): Build a data plane extension**

Create a new EDC data plane extension that intercepts proxy requests and emits trace events.
This requires a separate Gradle module and is significantly more work.

**Files to change (Option C1):**
- `backend/dpp_api/main.py` — detect data-plane origin and adjust trace source

### Change D: Separate Gaia-X events from EDC lifecycle events

Currently `edc_gaiax_extension` is the source for all events emitted from the Java
extension. Split it:

- `dpp_edc` — for negotiation/transfer lifecycle events
- `gaiax` — for VC generation, VP creation, compliance submission, verification result

This makes the trace dashboard clearly show three domains: the application APIs, the EDC
connectors, and the Gaia-X trust framework.

**Files to change:**
- `GaiaxComplianceClient.java` — use `gaiax` as source for Gaia-X-specific events
- New `EdcLifecycleTracer.java` — use `{participantId}_edc` as source for lifecycle events

---

## Expected Trace After Changes

```
 #  SOURCE        EVENT                              WHAT HAPPENS
 1  repair_api    qr_scanned                         User scans QR code
 2  repair_edc    edc_catalog_query                   repair-edc-cp sends DSP catalog request
 3  repair_edc    edc_catalog_received                repair-edc-cp receives catalog
 4  repair_edc    edc_contract_negotiation             repair-edc-cp sends negotiation request
 5  dpp_edc    edc_negotiation_received             dpp-edc-cp receives negotiation
 6  gaiax         gaiax_edc_policy_evaluation          Gaia-X constraint check triggered
 7  gaiax         gaiax_vc_generation                  VCs generated and signed
 8  gaiax         gaiax_vp_creation                    VP created wrapping 3 VCs
 9  gaiax         gaiax_compliance_submission          VP submitted to gx-compliance
10  gaiax         gaiax_compliance_verified            gx-compliance returns 201
11  dpp_edc    edc_contract_agreed                  dpp-edc-cp agrees to contract
12  repair_edc    edc_agreement_reached                repair-edc-cp detects FINALIZED
13  repair_edc    edc_transfer_started                 repair-edc-cp initiates HttpData-PULL
14  dpp_edc    edc_transfer_provisioned             dpp-edc-cp provisions data plane
15  repair_edc    edc_edr_received                     repair-edc-cp receives EDR token
16  repair_edc    edc_data_plane_fetch                 Request sent to DPP data plane
17  dpp_edc_dp data_request_received                dpp-edc-dp proxies to dpp_api
18  dpp_api    data_response_sent                   dpp_api returns passport data
19  repair_api    dpp_data_returned                 repair_api receives final data
```

This trace accurately shows:
- **repair_api** only appears at the start (user action) and end (receives data)
- **repair_edc** shows the consumer EDC doing catalog/negotiation/transfer orchestration
- **dpp_edc** shows the provider EDC receiving and processing the request
- **gaiax** shows the trust framework verification as a distinct concern
- **dpp_edc_dp** shows the data plane proxy hop
- **dpp_api** shows the actual data provider returning the passport

---

## Implementation Order

1. **Change B** (simplest, immediate improvement) — re-attribute repair_api sources
2. **Change D** — split `edc_gaiax_extension` into `gaiax` and `dpp_edc`
3. **Change A** — subscribe to more EDC events in the Java extension
4. **Change C1** — enhance dpp_api to detect data-plane origin
5. Update trace dashboard `SOURCE_COLORS` and `EVENT_LABELS` for the new sources
6. Rebuild EDC JARs, redeploy, re-seed, end-to-end test

## Estimated Effort

| Change | Effort | Risk |
|---|---|---|
| B: Re-attribute sources | ~15 min | Low — only string changes in repair_api |
| D: Split Gaia-X source | ~20 min | Low — string changes in Java extension |
| A: More EDC event subscriptions | ~45 min | Medium — need to import correct event types, handle trace ID correlation |
| C1: Data plane origin detection | ~15 min | Low — inspect request headers |
| Frontend updates | ~15 min | Low — add new source colors |
| Rebuild + test | ~10 min | Low |

**Total: ~2 hours**
