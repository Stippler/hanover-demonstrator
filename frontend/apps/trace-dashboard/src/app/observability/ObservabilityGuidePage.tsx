"use client";

import { useState } from "react";
import { BookOpen, X, ArrowRight, ArrowDown, ChevronRight } from "lucide-react";

const DOMAIN = "imx.vactory-projects.com";
const RED = "#E30613";
const BLUE = "#3b82f6";
const GREEN = "#059669";
const ORANGE = "#ea580c";
const CYAN = "#0891b2";
const VIOLET = "#7c3aed";
const TEAL = "#14b8a6";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-4 mt-10 flex items-center gap-2 border-t border-line pt-6 text-lg font-extrabold text-on-page first:mt-0 first:border-0 first:pt-0">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-bold text-on-page">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-muted">{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs text-on-surface">{children}</code>;
}

function Callout({ color = RED, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-r-lg border-l-4 bg-subtle/60 px-4 py-3 text-sm leading-relaxed text-muted" style={{ borderLeftColor: color }}>
      {children}
    </div>
  );
}

function Card({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-bold text-on-page">{title}</span>
      </div>
      <div className="text-xs leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line bg-subtle/50">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-ghost">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line-subtle last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-muted">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Interactive Diagrams (HTML/Tailwind) ── */

type NodeId =
  | "repair-ui"
  | "repair-api"
  | "consumer-cp"
  | "consumer-dp"
  | "provider-cp"
  | "provider-dp"
  | "dpp-api"
  | "aas"
  | "gaiax"
  | null;

const NODE_DETAILS: Record<Exclude<NodeId, null>, {
  title: string; service: string; receives: string[]; sends: string[]; tech: string; notes?: string;
}> = {
  "repair-ui":    { title: "Repair UI", service: "repair-ui (Next.js)", tech: "Next.js 14, React, Tailwind",
                    receives: ["Passport JSON from repair-api", "Product images via repair-api proxy"],
                    sends: ["Serial number / QR code to repair-api", "Maintenance reports to repair-api"] },
  "repair-api":   { title: "repair-api", service: "repair-api (FastAPI)", tech: "Python 3.12, FastAPI, httpx",
                    receives: ["QR lookup requests from UI", "EDC callbacks (negotiation + transfer)", "EDR token from Consumer CP", "Passport JSON from Provider Data Plane"],
                    sends: ["Catalog query to Consumer CP (Management API)", "Contract negotiation to Consumer CP", "Transfer request to Consumer CP", "HTTPS GET with EDR token to Provider Data Plane (not to Consumer DP)"],
                    notes: "Orchestrates catalog → negotiation → transfer. Receives the EDR from its control plane, then calls the provider data plane directly. Consumer data plane is not on this path for HttpData-PULL." },
  "consumer-cp":  { title: "Consumer Control Plane", service: "repair-edc-cp", tech: "Eclipse EDC 0.12.0, Java",
                    receives: ["Management API calls from repair-api", "DSP messages from Provider CP"],
                    sends: ["DSP negotiation to Provider CP", "Callbacks to repair-api (negotiation done, transfer started)", "EDR (Endpoint Data Reference) to repair-api"],
                    notes: "Trust and contracts only: catalog, negotiation, transfer process, issuing the EDR. Does not proxy passport bytes." },
  "consumer-dp":  { title: "Consumer Data Plane", service: "repair-edc-dp", tech: "Eclipse EDC 0.12.0, Java",
                    receives: ["Would accept proxied requests if Wintersteiger published assets for others to pull"],
                    sends: ["Would validate EDR and forward to a local backend in provider-style flows"],
                    notes: "Part of the consumer connector, but not used for DPP lookup. HttpData-PULL means the consumer application (repair-api) calls the provider data plane with the EDR — there is no data-plane-to-data-plane tunnel between connectors for this asset." },
  "provider-cp":  { title: "Provider Control Plane", service: "dpp-edc-cp", tech: "Eclipse EDC 0.12.0, Java, gaiax-auth-extension",
                    receives: ["DSP negotiation from Consumer CP", "Transfer requests from Consumer CP", "PASS from gx-compliance after VP-JWT verification"],
                    sends: ["VP-JWT built from consumer DID + credentials to gx-compliance", "Contract agreement to Consumer CP", "Signed EDR JWT for the provider data plane"],
                    notes: "During negotiation, policy (Gaia-X) is enforced here: build verifiable presentation, call gx-compliance, then finalize agreement and authorize the data plane to accept EDR-backed requests." },
  "provider-dp":  { title: "Provider Data Plane", service: "dpp-edc-dp", tech: "Eclipse EDC 0.12.0, Java",
                    receives: ["HTTPS GET from repair-api with EDR token (Authorization header)", "Path: /api/public/skis/{serial}/passport"],
                    sends: ["Validated + proxied HTTP request to DPP API", "Passport JSON response back to repair-api"],
                    notes: "Data path gate: verifies the short-lived EDR JWT (signature vs provider CP public key), then proxies to dpp-api. External callers never hit dpp-api without a valid EDR." },
  "dpp-api":      { title: "DPP API", service: "dpp-api (FastAPI)", tech: "Python 3.12, FastAPI, httpx",
                    receives: ["Proxied HTTP requests from Provider Data Plane", "Path: /skis/{serial}/passport, /products/{id}/image"],
                    sends: ["AAS getSkiServiceData request", "AAS Shells/Submodels GET requests", "Assembled passport JSON back through Data Plane"],
                    notes: "Only service that talks to the external AAS. Seeds EDC catalog on startup." },
  "aas":          { title: "AAS / PASSAT", service: "External (Salzburg Research)", tech: "BaSyx AAS, REST API",
                    receives: ["POST getSkiServiceData (grinding params)", "GET Shell submodels (ProductModel, Item)"],
                    sends: ["Grinding parameters (side/base edge angles)", "Product data (brand, name, dimensions)", "Product model (season, EAN, image URL)", "Item data (factory, dates, order #)"] },
  "gaiax":        { title: "Gaia-X Compliance", service: "gx-compliance + Memgraph", tech: "Node.js, Memgraph graph DB",
                    receives: ["VP-JWT from Provider CP (consumer identity + legal participant claims)"],
                    sends: ["Verification result (PASS/FAIL) back to Provider CP"],
                    notes: "Acts as the trust verifier in this demo: DID resolution (did:web), x5u X.509 chain, VP-JWT signature and policy-aligned checks. It is separate from EDC but called from the provider control plane during negotiation." },
};

function DiagramNode({ id, label, sub, color, selected, onClick }: {
  id: NodeId; label: string; sub: string; color: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center rounded-xl border-2 px-3 py-2.5 text-center transition-all hover:shadow-md"
      style={{
        borderColor: selected ? color : `${color}40`,
        backgroundColor: selected ? `${color}12` : `${color}06`,
        boxShadow: selected ? `0 0 0 3px ${color}20` : undefined,
      }}
    >
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
      <span className="mt-0.5 text-[10px] text-muted">{sub}</span>
      {selected && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}

function HArrow({ label, color = "#8c7c76", dashed, bold }: { label: string; color?: string; dashed?: boolean; bold?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-1">
      <span className="whitespace-nowrap text-[9px] font-semibold" style={{ color }}>{label}</span>
      <div className="flex items-center" style={{ color }}>
        <div className="h-0.5 w-6 sm:w-8" style={{ backgroundColor: color, opacity: dashed ? 0.4 : 1, backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)` : undefined, backgroundSize: dashed ? "8px 100%" : undefined, height: bold ? 3 : 2 }} />
        <ChevronRight className="h-3 w-3 -ml-0.5" />
      </div>
    </div>
  );
}

function VArrow({ label, color = "#8c7c76", dashed }: { label: string; color?: string; dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      {dashed ? (
        <div className="h-4 w-0 border-l-2 border-dashed" style={{ borderColor: color, opacity: 0.65 }} />
      ) : (
        <div className="h-4 w-0.5" style={{ backgroundColor: color }} />
      )}
      <ArrowDown className="h-3 w-3 -mt-0.5" style={{ color, opacity: dashed ? 0.65 : 1 }} />
      <span className="mt-0.5 whitespace-nowrap text-[9px] font-semibold" style={{ color, opacity: dashed ? 0.85 : 1 }}>{label}</span>
    </div>
  );
}

function NodeDetailPanel({ id, onClose }: { id: Exclude<NodeId, null>; onClose: () => void }) {
  const d = NODE_DETAILS[id];
  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-bold text-on-page">{d.title}</h4>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{d.service}</p>
          <p className="text-[10px] text-ghost">{d.tech}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-muted transition hover:bg-subtle hover:text-on-page">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ghost">Receives</p>
          <ul className="space-y-1">
            {d.receives.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ghost">Sends</p>
          <ul className="space-y-1">
            {d.sends.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {d.notes && (
        <p className="mt-3 rounded-lg bg-subtle/50 px-3 py-2 text-xs text-muted"><strong className="text-on-surface">Note:</strong> {d.notes}</p>
      )}
    </div>
  );
}

/** Large horizontal overview — matches stakeholder “trusted communication” slides. */
function TrustedCommunicationSwimlane() {
  const lane = "rounded-lg border px-2 py-1.5 text-center shadow-sm";
  return (
    <div className="mb-6 rounded-2xl border-2 border-dashed p-4" style={{ borderColor: `${VIOLET}35`, backgroundColor: `${VIOLET}05` }}>
      <p className="mb-1 text-center text-[11px] font-extrabold uppercase tracking-widest text-on-page">
        Overview — trust vs data (how the connectors line up)
      </p>
      <p className="mb-4 text-center text-[10px] text-muted">
        Control planes talk <strong className="text-on-surface">DSP</strong> to negotiate; <strong className="text-on-surface">Gaia-X</strong> runs during that step. Only after agreement does <Mono>repair-api</Mono> call the <strong className="text-on-surface">provider data plane</strong> with the EDR.
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[760px] space-y-4">
          {/* Trust row */}
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: RED }}>Trust path — no passport bytes yet</p>
            <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap">
              <div className={`${lane} w-[88px] shrink-0`} style={{ borderColor: `${BLUE}45`, backgroundColor: `${BLUE}08` }}>
                <span className="text-[9px] font-bold" style={{ color: BLUE }}>repair-api</span>
                <p className="text-[8px] leading-tight text-muted">Mgmt API</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} w-[100px] shrink-0`} style={{ borderColor: `${VIOLET}45`, backgroundColor: `${VIOLET}08` }}>
                <span className="text-[9px] font-bold" style={{ color: VIOLET }}>Consumer CP</span>
                <p className="text-[8px] leading-tight text-muted">your connector</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`rounded-md px-2 py-1 text-[8px] font-bold shrink-0`} style={{ backgroundColor: `${RED}12`, color: RED }}>DSP</div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} w-[100px] shrink-0`} style={{ borderColor: `${VIOLET}45`, backgroundColor: `${VIOLET}08` }}>
                <span className="text-[9px] font-bold" style={{ color: VIOLET }}>Provider CP</span>
                <p className="text-[8px] leading-tight text-muted">+ Gaia-X policy</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} min-w-[120px] flex-1`} style={{ borderColor: `${ORANGE}50`, backgroundColor: `${ORANGE}10` }}>
                <span className="text-[9px] font-bold" style={{ color: ORANGE }}>gx-compliance</span>
                <p className="text-[8px] leading-tight text-muted">VP-JWT · DID · X.509</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} w-[100px] shrink-0`} style={{ borderColor: `${GREEN}45`, backgroundColor: `${GREEN}08` }}>
                <span className="text-[9px] font-bold" style={{ color: GREEN }}>Agreement</span>
                <p className="text-[8px] leading-tight text-muted">+ EDR issued</p>
              </div>
            </div>
          </div>

          {/* Data row */}
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>Data path — after trust</p>
            <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap">
              <div className={`${lane} w-[88px] shrink-0`} style={{ borderColor: `${BLUE}45`, backgroundColor: `${BLUE}08` }}>
                <span className="text-[9px] font-bold" style={{ color: BLUE }}>repair-api</span>
                <p className="text-[8px] leading-tight text-muted">HTTP client</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`rounded-md px-2 py-1 text-[8px] font-bold shrink-0`} style={{ backgroundColor: `${GREEN}14`, color: GREEN }}>HTTPS + EDR</div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} w-[110px] shrink-0`} style={{ borderColor: `${GREEN}50`, backgroundColor: `${GREEN}08` }}>
                <span className="text-[9px] font-bold" style={{ color: GREEN }}>Provider DP</span>
                <p className="text-[8px] leading-tight text-muted">validate JWT · proxy</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} w-[88px] shrink-0`} style={{ borderColor: `${RED}45`, backgroundColor: `${RED}08` }}>
                <span className="text-[9px] font-bold" style={{ color: RED }}>DPP API</span>
                <p className="text-[8px] leading-tight text-muted">FastAPI</p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-ghost" />
              <div className={`${lane} min-w-[100px] flex-1`} style={{ borderColor: `${CYAN}45`, backgroundColor: `${CYAN}08` }}>
                <span className="text-[9px] font-bold" style={{ color: CYAN }}>AAS / PASSAT</span>
                <p className="text-[8px] leading-tight text-muted">live product data</p>
              </div>
            </div>
            <p className="mt-2 text-center text-[9px] text-ghost">
              Consumer data plane does not sit on this arrow — see the interactive diagram below (Consumer DP is on the connector but idle for <Mono>HttpData-PULL</Mono>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustedConceptStrip() {
  return (
    <div className="mb-6 rounded-2xl border border-line bg-gradient-to-b from-subtle/40 to-surface p-4">
      <p className="mb-1 text-center text-xs font-extrabold text-on-page">Trusted communication through EDC and Gaia-X</p>
      <p className="mb-4 text-center text-[10px] leading-relaxed text-muted">
        Control planes establish <strong className="text-on-surface">who may access what</strong> (DSP negotiation + Gaia-X checks). Data planes enforce <strong className="text-on-surface">how bytes move</strong> (EDR token + HTTP proxy). In this demo, passport bytes flow over <strong className="text-on-surface">HTTPS from repair-api to the provider data plane</strong> — not through a tunnel between the two data planes.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface/80 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: BLUE }}>Consumer</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            UI calls <Mono>repair-api</Mono>. The API drives its <strong>control plane</strong> for catalog, negotiation, and transfer so it receives an <strong>EDR</strong> (URL + short-lived JWT). The API then performs the <strong>data pull</strong> itself.
          </p>
        </div>
        <div className="rounded-xl border-2 p-3" style={{ borderColor: `${VIOLET}35`, backgroundColor: `${VIOLET}06` }}>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-page">Each EDC connector</p>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted">
            <li><strong className="text-on-surface">Control plane:</strong> Management API toward your app; DSP toward the remote connector; policy and (here) Gaia-X hooks.</li>
            <li><strong className="text-on-surface">Data plane:</strong> Validates EDRs and proxies HTTP to a configured backend URL.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-surface/80 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: RED }}>Provider</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Provider <strong>control plane</strong> negotiates and, before agreeing, sends a <strong>VP-JWT</strong> to <Mono>gx-compliance</Mono> (Gaia-X-style verification). Provider <strong>data plane</strong> is the only public gate to <Mono>dpp-api</Mono> and the PASSAT AAS behind it.
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-line bg-subtle/40 px-3 py-2.5">
        <p className="text-[10px] font-bold text-on-page">
          <span className="mr-2 rounded-md px-1.5 py-0.5" style={{ backgroundColor: `${ORANGE}18`, color: ORANGE }}>Gaia-X</span>
          European dataspace trust framework: decentralized IDs (<Mono>did:web</Mono>), verifiable credentials, and compliance checks. <strong className="font-semibold text-on-surface">In this stack</strong>, Gaia-X rules are enforced when the <strong>provider control plane</strong> evaluates policy and calls <Mono>gx-compliance</Mono> — not inside the repair UI or repair-api business logic.
        </p>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  const [selected, setSelected] = useState<NodeId>(null);
  const toggle = (id: NodeId) => setSelected(selected === id ? null : id);

  return (
    <div className="my-6">
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-widest text-ghost">Click any component to see what it receives and sends</p>

      {/* Main layout */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* CONSUMER side */}
        <div className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: `${BLUE}30`, backgroundColor: `${BLUE}04` }}>
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: BLUE }}>Consumer — Wintersteiger</p>
          <div className="flex flex-col items-center gap-1">
            <DiagramNode id="repair-ui" label="Repair UI" sub="Next.js" color={BLUE} selected={selected === "repair-ui"} onClick={() => toggle("repair-ui")} />
            <VArrow label="lookup" color="#8c7c76" />
            <DiagramNode id="repair-api" label="repair-api" sub="FastAPI" color={BLUE} selected={selected === "repair-api"} onClick={() => toggle("repair-api")} />
            <div className="flex items-center gap-2 py-1">
              <VArrow label="Mgmt API" color={VIOLET} />
            </div>
            <DiagramNode id="consumer-cp" label="Consumer CP" sub="EDC Control Plane" color={VIOLET} selected={selected === "consumer-cp"} onClick={() => toggle("consumer-cp")} />
            <VArrow label="same connector" color="#8c7c76" dashed />
            <DiagramNode id="consumer-dp" label="Consumer DP" sub="EDC Data Plane (idle for DPP pull)" color={TEAL} selected={selected === "consumer-dp"} onClick={() => toggle("consumer-dp")} />
          </div>
        </div>

        {/* PROVIDER side */}
        <div className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: `${RED}30`, backgroundColor: `${RED}04` }}>
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: RED }}>Provider — Atomic (DPP)</p>
          <div className="flex flex-col items-center gap-1">
            <DiagramNode id="provider-cp" label="Provider CP" sub="EDC Control Plane + Gaia-X" color={VIOLET} selected={selected === "provider-cp"} onClick={() => toggle("provider-cp")} />
            <div className="grid w-full grid-cols-2 gap-2 mt-2">
              <div className="flex flex-col items-center gap-1">
                <VArrow label="issues EDR" color={VIOLET} />
                <DiagramNode id="provider-dp" label="Provider Data Plane" sub="Token validation + HTTP proxy" color={GREEN} selected={selected === "provider-dp"} onClick={() => toggle("provider-dp")} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-8" />
                <DiagramNode id="dpp-api" label="DPP API" sub="FastAPI" color={RED} selected={selected === "dpp-api"} onClick={() => toggle("dpp-api")} />
                <VArrow label="AAS calls" color={CYAN} />
                <DiagramNode id="aas" label="AAS / PASSAT" sub="Salzburg Research" color={CYAN} selected={selected === "aas"} onClick={() => toggle("aas")} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connections between sides */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2.5">
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${RED}10`, color: RED }}>TRUST</span>
          <span className="text-xs text-muted">Consumer CP</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted" />
          <span className="text-[10px] font-bold" style={{ color: VIOLET }}>DSP</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted" />
          <span className="text-xs text-muted">Provider CP</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted" />
          <span className="text-[10px] font-bold" style={{ color: ORANGE }}>VP-JWT → gx-compliance</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted" />
          <span className="text-[10px] font-semibold text-on-surface">agreement + EDR auth</span>
        </div>
        <p className="text-center text-[9px] leading-relaxed text-ghost">Connector-to-connector DSP runs between control planes. Gaia-X verification is invoked from the provider control plane during policy evaluation (see <a href="#gaiax" className="underline" style={{ color: ORANGE }}>Gaia-X compliance</a>).</p>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border-2 px-3 py-2.5" style={{ borderColor: `${GREEN}40`, backgroundColor: `${GREEN}06` }}>
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${GREEN}10`, color: GREEN }}>DATA</span>
          <span className="text-xs text-muted">repair-api</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: GREEN }} />
          <span className="text-[10px] font-bold" style={{ color: GREEN }}>HTTPS + EDR</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: GREEN }} />
          <span className="text-xs text-muted">Provider DP</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: RED }} />
          <span className="text-xs text-muted">DPP API</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: CYAN }} />
          <span className="text-xs text-muted">AAS</span>
        </div>
        <p className="text-center text-[9px] leading-relaxed text-ghost">
          The consumer control plane issues the EDR to <Mono>repair-api</Mono>; the app opens the HTTPS connection to the <strong>provider</strong> data plane. Consumer DP does not forward this traffic — there is no data-plane-to-data-plane link for <Mono>HttpData-PULL</Mono> here.
        </p>
      </div>

      {/* Gaia-X */}
      <div className="mt-3 flex flex-col items-center gap-2">
        <VArrow label="verify (during negotiation)" color={ORANGE} />
        <DiagramNode id="gaiax" label="gx-compliance (Gaia-X)" sub="DID, VP-JWT, X.509 chain" color={ORANGE} selected={selected === "gaiax"} onClick={() => toggle("gaiax")} />
      </div>

      {/* Detail panel */}
      {selected && <NodeDetailPanel id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FlowDiagram() {
  const steps = [
    { n: 1, label: "QR Scanned", sub: "Serial number entered", color: BLUE },
    { n: 2, label: "EDC Catalog", sub: "Discover DPP assets via DSP", color: VIOLET },
    { n: 3, label: "Negotiation", sub: "Agree on Gaia-X policy", color: VIOLET },
    { n: 4, label: "Gaia-X Check", sub: "VP-JWT verified", color: ORANGE },
    { n: 5, label: "Agreement", sub: "Contract finalized", color: GREEN },
    { n: 6, label: "Data Plane", sub: "EDR → Provider DP", color: GREEN },
    { n: 7, label: "AAS Fetch", sub: "DPP API → PASSAT", color: CYAN },
    { n: 8, label: "Delivered", sub: "Passport → UI", color: GREEN },
  ];

  return (
    <div className="my-6 overflow-x-auto">
      <div className="flex items-stretch gap-1" style={{ minWidth: 700 }}>
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className="flex h-full w-20 flex-col items-center rounded-xl border p-2" style={{ borderColor: `${s.color}40`, backgroundColor: `${s.color}08` }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: s.color }}>{s.n}</span>
              <span className="mt-1.5 text-center text-[10px] font-bold leading-tight" style={{ color: s.color }}>{s.label}</span>
              <span className="mt-0.5 text-center text-[9px] leading-tight text-muted">{s.sub}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 text-ghost" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataFlowDiagram() {
  const fields = [
    { label: "Product Data", detail: "Brand, Name, Length, Width" },
    { label: "Side Edge", detail: "Tip / Waist / Tail angles (°)" },
    { label: "Base Edge", detail: "Tip / Waist / Tail angles (°)" },
    { label: "Identification", detail: "Serial, Component, Count" },
    { label: "Product Model", detail: "Season, EAN, Image URL" },
    { label: "Item Data", detail: "Factory, Date, Order #" },
    { label: "Performance", detail: "Edge performance class" },
    { label: "Maintenance", detail: "Service, technician, date" },
  ];

  return (
    <div className="my-6 overflow-x-auto">
      <div className="flex items-start gap-2" style={{ minWidth: 640 }}>
        {/* AAS */}
        <div className="w-28 shrink-0 rounded-xl border p-2.5" style={{ borderColor: `${CYAN}40`, backgroundColor: `${CYAN}06` }}>
          <p className="text-[10px] font-bold" style={{ color: CYAN }}>AAS / PASSAT</p>
          <p className="mt-1 text-[9px] text-muted">getSkiServiceData</p>
          <p className="text-[9px] text-muted">Shells / Submodels</p>
        </div>
        <HArrow label="" color={CYAN} />
        {/* DPP API */}
        <div className="w-28 shrink-0 rounded-xl border p-2.5" style={{ borderColor: `${RED}40`, backgroundColor: `${RED}06` }}>
          <p className="text-[10px] font-bold" style={{ color: RED }}>DPP API</p>
          <p className="mt-1 text-[9px] text-muted">Assembles passport from AAS + maintenance</p>
        </div>
        <HArrow label="proxy" color={VIOLET} />
        {/* Data Plane */}
        <div className="w-28 shrink-0 rounded-xl border-2 p-2.5" style={{ borderColor: `${GREEN}60`, backgroundColor: `${GREEN}08` }}>
          <p className="text-[10px] font-bold" style={{ color: GREEN }}>Data Plane</p>
          <p className="mt-1 text-[9px] text-muted">Token validation, HTTP proxy, EDR auth</p>
        </div>
        <HArrow label="EDR" color={GREEN} bold />
        {/* Passport */}
        <div className="flex-1 rounded-xl border p-3" style={{ borderColor: `${GREEN}40`, backgroundColor: `${GREEN}04` }}>
          <p className="mb-2 text-[10px] font-extrabold" style={{ color: GREEN }}>Digital Product Passport</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {fields.map(f => (
              <div key={f.label} className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-on-surface">{f.label}</span>
                <span className="text-[9px] text-muted">{f.detail}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-ghost">→ repair-api → Wintersteiger Machine UI</p>
        </div>
      </div>
    </div>
  );
}

function SeqStep({ n, from, to, label, sub, color, highlight }: {
  n: number; from: string; to: string; label: string; sub?: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${highlight ? "border-2" : "border border-line-subtle"}`} style={highlight ? { borderColor: `${color}60`, backgroundColor: `${color}08` } : {}}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: color }}>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-on-surface">{from}</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color }} />
          <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-on-surface">{to}</span>
        </div>
        <p className="mt-0.5 text-xs font-semibold" style={{ color }}>{label}</p>
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function SequenceDiagram() {
  return (
    <div className="my-6 space-y-4">
      {/* Phase 1: Trust */}
      <div className="rounded-xl border-2 border-dashed p-3" style={{ borderColor: `${VIOLET}30` }}>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: VIOLET }}>Phase 1 — Trust (Control Planes)</p>
        <div className="space-y-1.5">
          <SeqStep n={1} from="repair-api" to="Consumer CP" label="Negotiate contract" sub="Management API call + register callback URL" color={VIOLET} />
          <SeqStep n={2} from="Consumer CP" to="Provider CP" label="DSP protocol negotiation" sub="Connector-to-connector communication" color={VIOLET} />
          <SeqStep n={3} from="Provider CP" to="Gaia-X" label="Verify consumer credentials (VP-JWT)" sub="DID resolution, x5u chain, credential validation" color={ORANGE} />
          <SeqStep n={4} from="Provider CP" to="Consumer CP" label="Contract agreement" sub="Policy accepted, agreement created" color={VIOLET} />
          <SeqStep n={5} from="Consumer CP" to="repair-api" label="Callback: negotiation done" sub="async callback to registered URL" color={GREEN} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="rounded-full bg-subtle px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ghost">Trust established</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* Phase 2: Data */}
      <div className="rounded-xl border-2 border-dashed p-3" style={{ borderColor: `${GREEN}30` }}>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: GREEN }}>Phase 2 — Data (Consumer pulls via Data Plane)</p>
        <div className="space-y-1.5">
          <SeqStep n={6} from="repair-api" to="Consumer CP" label="Start HttpData-PULL transfer" color={VIOLET} />
          <SeqStep n={7} from="Consumer CP" to="Provider CP" label="DSP: transfer request" color={VIOLET} />
          <SeqStep n={8} from="Provider CP" to="" label="Issue EDR token" sub="URL + short-lived JWT pointing to Provider Data Plane" color={VIOLET} />
          <SeqStep n={9} from="Consumer CP" to="repair-api" label="Callback → repair-api GETs EDR" sub="EDR contains: endpoint URL + auth token" color={GREEN} />
          <SeqStep n={10} from="repair-api" to="Provider DP" label="GET /skis/44444444/passport (EDR token)" sub="Direct HTTP call — skips both control planes entirely" color={GREEN} highlight />
          <SeqStep n={11} from="Provider DP" to="DPP API" label="Proxy (token validated)" sub="Data Plane validates JWT, forwards to backend" color={RED} />
          <SeqStep n={12} from="DPP API" to="AAS" label="Fetch live product data" sub="getSkiServiceData + Shells/Submodels" color={CYAN} />
          <SeqStep n={13} from="Provider DP" to="repair-api" label="Passport JSON returned" sub="Through data plane → repair-api → UI" color={GREEN} highlight />
        </div>
      </div>
    </div>
  );
}

export default function ObservabilityGuidePage() {
  return (
    <div className="animate-fade-in">
      <div className="border-b border-line bg-surface px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${RED}12` }}>
            <BookOpen className="h-5 w-5" style={{ color: RED }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-on-page">How this system works</h1>
            <p className="mt-0.5 text-sm text-muted">Architecture, EDC connectors, Gaia-X trust, AAS data flow, and trace observability</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">

        {/* TOC */}
        <nav className="mb-8 rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ghost">On this page</p>
          <ul className="columns-2 gap-x-6 text-xs">
            {[
              ["#architecture", "System architecture"],
              ["#participants", "Participants"],
              ["#flow", "Passport lookup flow"],
              ["#data", "Data transferred"],
              ["#edc", "Eclipse EDC explained"],
              ["#gaiax", "Gaia-X compliance"],
              ["#aas", "AAS / PASSAT integration"],
              ["#wellknown", "DID & well-known documents"],
              ["#traces", "Trace & observability system"],
              ["#events", "Event types catalog"],
              ["#docker", "Docker services & routing"],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:underline" style={{ color: RED }}>{label}</a></li>
            ))}
          </ul>
        </nav>

        {/* ── Architecture ── */}
        <Section id="architecture" title="System architecture">
          <TrustedConceptStrip />
          <TrustedCommunicationSwimlane />
          <P>The Hanover Demonstrator implements a <strong>Gaia-X aligned dataspace</strong> between two participants: a ski repair shop (consumer) and a digital product passport provider (Atomic). The repair web UI talks only to <Mono>repair-api</Mono>. That API uses its Eclipse EDC <strong>control plane</strong> over the Management API to discover assets, run contract negotiation against the provider connector (DSP), and start a transfer — which yields an <strong>EDR</strong> (endpoint URL plus a short-lived token). Passport JSON is then fetched with a normal <strong>HTTPS request from repair-api to the provider&rsquo;s data plane</strong>, which validates the token and proxies to <Mono>dpp-api</Mono> and the PASSAT AAS.</P>
          <P><strong>Gaia-X</strong> here means verifiable identity and compliance checks layered on that negotiation: the <strong>provider control plane</strong> builds a verifiable presentation (VP-JWT) and calls the <Mono>gx-compliance</Mono> service before finalizing the contract. It is not a separate hop from the browser; it is part of connector-side policy enforcement (details in <a href="#gaiax" className="underline" style={{ color: ORANGE }}>Gaia-X compliance</a>).</P>
          <ArchitectureDiagram />
          <P>All services emit structured trace events to a central collector. This dashboard visualizes those events as waterfalls, timelines, and statistics.</P>
        </Section>

        {/* ── Participants ── */}
        <Section id="participants" title="Participants">
          <P>The demonstrator has two dataspace participants. Each runs its own EDC connector (control plane + data plane) and a backend API.</P>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card color={BLUE} title="Wintersteiger — Repair Shop (consumer)">
              <p>Wants to look up a ski&rsquo;s Digital Product Passport. Runs <Mono>repair-api</Mono> (FastAPI) and <Mono>repair-edc-cp</Mono> / <Mono>repair-edc-dp</Mono>.</p>
              <p className="mt-1">Identity: <Mono>did:web:edc-repair-shop.{DOMAIN}</Mono></p>
              <p className="mt-1">Caddy host: <Mono>repair.{DOMAIN}</Mono> (UI + API), <Mono>edc-repair-shop.{DOMAIN}</Mono> (connector)</p>
            </Card>
            <Card color={RED} title="Atomic — Digital Ski Passport (provider)">
              <p>Publishes ski passport data as an EDC asset. Runs <Mono>dpp-api</Mono> (FastAPI) and <Mono>dpp-edc-cp</Mono> / <Mono>dpp-edc-dp</Mono>. Product data comes live from the <strong>PASSAT AAS</strong>.</p>
              <p className="mt-1">Identity: <Mono>did:web:edc-dpp.{DOMAIN}</Mono></p>
              <p className="mt-1">Caddy host: <Mono>dpp.{DOMAIN}</Mono> (API), <Mono>edc-dpp.{DOMAIN}</Mono> (connector)</p>
            </Card>
          </div>
          <P>Supporting services: <strong>gx-compliance</strong> (Gaia-X verification + Memgraph), <strong>trace-api</strong> (observability), <strong>Caddy</strong> (routing), <strong>Supabase Postgres</strong> (data).</P>
        </Section>

        {/* ── Flow ── */}
        <Section id="flow" title="Passport lookup flow">
          <P>When a user scans a QR code or enters a serial number in the Wintersteiger Repair Shop UI, the following 8-step sequence executes end-to-end. Every step is recorded as a trace event with full data payloads.</P>
          <FlowDiagram />

          <Sub title="Phase 1: Dataspace trust (EDC + Gaia-X)">
            <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted">
              <li><strong>QR Scanned</strong> — <Mono>repair-api</Mono> receives the serial number, carrier URL, machine type, and generates a trace ID.</li>
              <li><strong>Catalog query</strong> — <Mono>repair-api</Mono> asks its own EDC (Management API) to query the DPP provider&rsquo;s catalog via the DSP protocol.</li>
              <li><strong>Contract negotiation</strong> — Both connectors negotiate the Gaia-X policy. The DPP EDC&rsquo;s custom Java extension builds a <strong>Verifiable Presentation (VP-JWT)</strong> containing verifiable credentials.</li>
              <li><strong>Gaia-X compliance</strong> — The VP-JWT is POSTed to <Mono>gx-compliance:3000</Mono>. It resolves the issuer DID (<Mono>did:web:edc-dpp.{DOMAIN}</Mono>), validates X.509 certificate chain via <Mono>x5u</Mono>, and verifies the credentials. On success, the negotiation is finalized.</li>
            </ol>
          </Sub>

          <Sub title="Phase 2: Data transfer (Consumer Pull)">
            <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted" start={5}>
              <li><strong>Transfer started</strong> — <Mono>repair-api</Mono> initiates an <Mono>HttpData-PULL</Mono> transfer via its EDC control plane. The provider CP issues an <strong>EDR (Endpoint Data Reference)</strong> — a URL + short-lived token pointing to the provider&rsquo;s data plane.</li>
              <li><strong>EDR received via callback</strong> — The consumer CP calls back <Mono>repair-api</Mono> with the transfer state. <Mono>repair-api</Mono> retrieves the EDR, which contains the provider data plane endpoint and an auth token.</li>
              <li><strong>Consumer pulls data</strong> — <Mono>repair-api</Mono> makes a <strong>direct HTTP call</strong> to the provider&rsquo;s data plane (<Mono>dpp-edc-dp:9291/api/public</Mono>) using the EDR token. The data plane validates the token and proxies the request to <Mono>dpp-api</Mono>. The consumer data plane is <em>not involved</em> — this is how HttpData-PULL works.</li>
              <li><strong>DPP API calls AAS</strong> — <Mono>dpp-api</Mono> fetches live product data from the PASSAT AAS: grinding parameters, product model, and item data. This is the <em>only</em> service that communicates with the external AAS.</li>
            </ol>
          </Sub>

          <Sub title="Phase 3: Assembly & response">
            <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted" start={9}>
              <li><strong>Passport assembled</strong> — <Mono>dpp-api</Mono> assembles the full passport (AAS data + maintenance records from the shared Postgres) and returns it through the provider data plane back to <Mono>repair-api</Mono>, which forwards it to the UI.</li>
            </ol>
          </Sub>

          <Callout color={CYAN}>
            <strong>Key architecture principle:</strong> The repair shop <em>never</em> calls the AAS or any external API directly. All data flows through the EDC data planes after trust has been verified via Gaia-X. The DPP API is the sole gateway to the PASSAT AAS — access is controlled by the EDC contract and Gaia-X compliance.
          </Callout>
        </Section>

        {/* ── Data ── */}
        <Section id="data" title="Data transferred">
          <P>Each passport lookup transfers the following data from AAS to the repair shop. This data is now visible in the trace payloads.</P>
          <DataFlowDiagram />

          <Table
            headers={["Data group", "Fields", "Source"]}
            rows={[
              ["Product Data", "Brand, Manufacturer, Product Name, Length, Width (Tip/Waist/Tail)", "AAS getSkiServiceData"],
              ["Side Edge Angles", "Tip °, Waist °, Tail °", "AAS getSkiServiceData"],
              ["Base Edge Angles", "Tip °, Waist °, Tail °", "AAS getSkiServiceData"],
              ["Edge Performance", "Performance Class (e.g. R)", "AAS getSkiServiceData"],
              ["Identification", "Serial Number, Component Code, Set Code, Service Count", "AAS getSkiServiceData"],
              ["Product Model", "Season, Gender, EAN Code, SAP Article #, Image URL", "AAS Shell submodel"],
              ["Item Data", "Factory, Registration Date, Delivery Date, Order #, Pair Serial", "AAS Shell submodel"],
              ["Maintenance History", "Service type, message, technician, date", "Local PostgreSQL"],
            ]}
          />
        </Section>

        {/* ── EDC ── */}
        <Section id="edc" title="Eclipse EDC explained">
          <P><strong>Eclipse Dataspace Components (EDC)</strong> are software connectors that sit between a participant&rsquo;s backend and a federated dataspace. Instead of sharing credentials or calling APIs directly, each side exposes a connector that enforces contracts before any data moves.</P>

          <Sub title="The two components">
          <Table
            headers={["Component", "Role", "In this demo"]}
            rows={[
                [<strong key="cp">Control Plane (CP)</strong>, "Handles trust: catalog, contract negotiation, policy evaluation, Gaia-X verification. Exposes the Management API (for your app) and speaks DSP (connector-to-connector protocol).", <><Mono>repair-edc-cp</Mono>, <Mono>dpp-edc-cp</Mono></>],
                [<strong key="dp">Data Plane (DP)</strong>, "Handles data: validates EDR tokens, proxies HTTP requests to a backend URL. Only the provider needs a data plane for HttpData-PULL.", <><Mono>dpp-edc-dp</Mono> (provider only)</>],
              ]}
            />
          </Sub>

          <Sub title='Why does the repair-api call the data plane? — "Consumer Pull" model'>
            <Callout color={VIOLET}>
              <strong>Common misconception:</strong> &ldquo;The control plane fetches the data and gives it to me.&rdquo; This is <strong>not</strong> how EDC works. The control plane only establishes <em>trust</em> — it never touches the actual data. The consumer application must fetch the data itself.
            </Callout>

            <P>EDC uses a <strong>consumer-pull</strong> transfer model called <Mono>HttpData-PULL</Mono>. Here&rsquo;s how it works step by step:</P>

            <SequenceDiagram />

            <P>Key insight: <strong>steps 10-13 are a direct HTTP call</strong> from <Mono>repair-api</Mono> to the provider&rsquo;s data plane (<Mono>dpp-edc-dp</Mono>). The control planes are no longer involved. The EDR is essentially a &ldquo;ticket&rdquo; — the consumer earned it through the trust negotiation, and now uses it to access the provider&rsquo;s data plane directly.</P>

            <Callout color={GREEN}>
              <strong>Think of it like this:</strong> The control planes are the <em>bouncer checking IDs at the door</em>. Once you&rsquo;re in, you talk directly to the <em>bartender</em> (data plane) who serves you the data. The bouncer (control plane) doesn&rsquo;t serve drinks — it just decides who gets in.
          </Callout>

            <P>The consumer data plane (<Mono>repair-edc-dp</Mono>) is <strong>not involved</strong> in HttpData-PULL. It exists only for the reverse case — if the repair shop were a provider and someone pulled data from it. In this demo, only the provider&rsquo;s data plane (<Mono>dpp-edc-dp</Mono>) handles data requests.</P>
          </Sub>

          <Sub title="EDR — Endpoint Data Reference">
            <P>The EDR is the key to understanding why the consumer calls the data plane. It contains:</P>
            <ul className="ml-4 list-disc space-y-1 text-xs text-muted">
              <li><strong>endpoint</strong> — The URL of the provider&rsquo;s data plane public API (e.g. <Mono>http://dpp-edc-dp:9291/api/public</Mono>)</li>
              <li><strong>authKey</strong> — The HTTP header name for authentication (typically <Mono>Authorization</Mono>)</li>
              <li><strong>authCode</strong> — A short-lived JWT token signed by the provider&rsquo;s control plane</li>
            </ul>
            <P>The consumer app appends its requested path (e.g. <Mono>/skis/44444444/passport</Mono>) to the EDR endpoint and passes the token in the auth header. The provider&rsquo;s data plane validates the token (checking the signature against the control plane&rsquo;s public key), then proxies the request to the backend (<Mono>dpp-api</Mono>).</P>
          </Sub>

          <Sub title="Callback-driven flow (no polling)">
            <P>The flow is fully event-driven. EDC supports <Mono>callbackAddresses</Mono> on negotiations and transfers. When state changes, the connector POSTs to <Mono>repair-api</Mono>&rsquo;s callback endpoint — the app simply awaits the callback with an <Mono>asyncio.Future</Mono>. Total latency = Gaia-X crypto (~3s for first request) + network round-trips. Subsequent requests reuse the cached EDR (~0.3s).</P>
          </Sub>

          <Sub title="EDC catalog seeding">
            <P>On startup, <Mono>dpp-api</Mono> POSTs an asset (<Mono>dpp-ski-data</Mono>), an ODRL policy (<Mono>dpp-gaiax-policy</Mono> requiring <Mono>gaiaxCompliant=true</Mono>), and a contract definition to <Mono>dpp-edc-cp</Mono>. The EDC uses in-memory storage, so these are lost if the control plane restarts — <Mono>dpp-api</Mono> must also restart to re-seed.</P>
          </Sub>
        </Section>

        {/* ── Gaia-X ── */}
        <Section id="gaiax" title="Gaia-X compliance">
          <P><strong>Gaia-X</strong> adds a trust and compliance layer on top of EDC. When the DPP provider&rsquo;s policy requires <Mono>gaiaxCompliant</Mono>, the provider&rsquo;s control plane must verify the consumer before granting access.</P>

          <Sub title="What happens during negotiation">
            <P>On <Mono>dpp-edc-cp</Mono>, a custom Java extension (<Mono>gaiax-auth-extension</Mono>) hooks into the policy engine:</P>
            <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted">
              <li>Resolves the consumer&rsquo;s identity via <strong>DID Web</strong> — fetches <Mono>did.json</Mono> and <Mono>participant.json</Mono> from the repair connector&rsquo;s well-known URLs.</li>
              <li>Builds <strong>Verifiable Credentials (VCs)</strong> — participant name, country, legal person info.</li>
              <li>Creates a <strong>Verifiable Presentation (VP-JWT)</strong> — wraps the VCs into a JWT signed with the EDC&rsquo;s private key.</li>
              <li>POSTs the VP to <Mono>gx-compliance:3000</Mono> — the service resolves the issuer DID (<Mono>did:web:edc-dpp.{DOMAIN}</Mono>), checks the <Mono>x5u</Mono> certificate chain, and verifies the credentials.</li>
              <li>If verification succeeds, the negotiation proceeds and a contract agreement is created.</li>
            </ol>
          </Sub>

          <Sub title="Trace visibility">
            <P>The trace now shows: <Mono>gaiax_compliance_submission</Mono> (with issuer DID, subject DID, and verifier endpoint) followed by <Mono>gaiax_compliance_verified</Mono> (with result: PASS, compliant: true). If verification fails, <Mono>gaiax_compliance_rejected</Mono> is recorded with the reason.</P>
          </Sub>

          <Callout color={ORANGE}>
            There is no separate &ldquo;Gaia-X bridge&rdquo; in the default compose path. Compliance is triggered <strong>inside the DPP control plane</strong> during policy evaluation. The trace dashboard shows each Gaia-X step with full credential details.
          </Callout>

          <Sub title="Credential caching & re-verification">
            <P>The provider (Atomic) and consumer (Wintersteiger) behave differently with regard to when Gaia-X verification occurs:</P>
            <Table
              headers={["Participant", "Verification behavior", "Caching"]}
              rows={[
                [<strong key="p">Atomic (provider)</strong>, "Always verifies. Every new contract negotiation triggers the Gaia-X compliance service to re-validate the consumer's VP-JWT.", "No caching — trust is re-evaluated for each new agreement."],
                [<strong key="c">Wintersteiger (consumer)</strong>, "Verifies on first call. The resulting EDR token is cached and reused for subsequent lookups.", "EDR token is a short-lived JWT. Once it expires, the next lookup triggers a full re-negotiation with fresh Gaia-X verification."],
              ]}
            />
            <P>This means the first lookup takes ~3-4 seconds (negotiation + Gaia-X crypto), while subsequent lookups using the cached EDR complete in ~0.3 seconds. When the EDR expires, the next lookup seamlessly re-negotiates — the user doesn&rsquo;t notice the difference except for a slightly longer wait.</P>
          <Callout>
              Open <strong>Access Control</strong> in this dashboard to see the current credential session status for both connectors, including EDR expiry countdown and Gaia-X verification timestamps.
            </Callout>
          </Sub>
        </Section>

        {/* ── AAS ── */}
        <Section id="aas" title="AAS / PASSAT integration">
          <P>The <strong>Asset Administration Shell (AAS)</strong> is the data backbone of the demonstrator. Product data comes live from the <a href="https://basyx.passat.srfg.at/aas-ui/" className="underline" style={{ color: CYAN }}>PASSAT AAS</a> hosted by Salzburg Research.</P>

          <Sub title="AAS operations used">
            <Table
              headers={["Operation", "Method", "What it returns"]}
              rows={[
                [<Mono key="1">getSkiServiceData</Mono>, "POST (invoke)", "Grinding parameters (side/base edge angles), product data (brand, name, dimensions), identification (serial, component code, service count), edge performance class"],
                [<Mono key="2">Item submodel</Mono>, "GET", "Individual ski item data: factory, registration date, delivery date, production order number"],
                [<Mono key="3">ProductModel submodel</Mono>, "GET", "Product model metadata: season, gender, EAN code, SAP article number, product image URL"],
              ]}
            />
          </Sub>

          <Sub title="Data flow through the data plane">
            <P>All product data flows through the provider&rsquo;s EDC data plane: <Mono>repair-api</Mono> → <Mono>dpp-edc-dp</Mono> → <Mono>dpp-api</Mono> → AAS. The consumer data plane is not involved (HttpData-PULL is a direct consumer-to-provider-DP call). The <Mono>edc_data_plane_fetch</Mono> and <Mono>edc_data_plane_received</Mono> trace events capture the payload summary (brand, product name, ski length, maintenance records) as it passes through the data plane.</P>
          </Sub>

          <Callout color={CYAN}>
            <strong>Base64 URL encoding:</strong> AAS shell and submodel IDs (URNs like <Mono>urn:samm:at.srfg.passat.AtomicSki:2.0.0#...</Mono>) must be URL-safe base64 encoded in the REST paths. The <Mono>repair-api</Mono> handles this automatically.
          </Callout>
        </Section>

        {/* ── Well-known ── */}
        <Section id="wellknown" title="DID & well-known documents">
          <P>Each connector needs a verifiable identity. This stack uses <strong>did:web</strong>: a DID document served over HTTPS at a well-known path on the connector&rsquo;s host.</P>

          <Sub title="Endpoints served by did-web-extension">
            <Table
              headers={["Path", "Content"]}
              rows={[
                [<Mono key="1">/.well-known/did.json</Mono>, "W3C DID document (verification methods, service endpoints, x5u reference)"],
                [<Mono key="2">/.well-known/participant.json</Mono>, "Gaia-X LegalParticipant self-description (name, country)"],
                [<Mono key="3">/.well-known/x509CertificateChain.pem</Mono>, "X.509 certificate for TLS / signing alignment"],
              ]}
            />
          </Sub>

          <Sub title="Both sides publish credentials">
            <P>Both the consumer and provider serve DID documents because the provider must verify <em>who is requesting access</em> during Gaia-X evaluation.</P>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-subtle/30 p-3">
                <p className="text-xs font-bold" style={{ color: RED }}>Provider (Atomic)</p>
                <p className="mt-1 font-mono text-[11px] text-muted">edc-dpp.{DOMAIN}</p>
              </div>
              <div className="rounded-lg border border-line bg-subtle/30 p-3">
                <p className="text-xs font-bold" style={{ color: BLUE }}>Consumer (Wintersteiger)</p>
                <p className="mt-1 font-mono text-[11px] text-muted">edc-repair-shop.{DOMAIN}</p>
              </div>
            </div>
            <P>Caddy rewrites <Mono>/.well-known/*</Mono> to <Mono>/api/*</Mono> and proxies to the control plane&rsquo;s default web context (port 8080) where the <Mono>did-web-extension</Mono> serves the JSON.</P>
          </Sub>

          <Callout>
            Open <strong>Access Control</strong> in this dashboard to see the live <Mono>did.json</Mono> and <Mono>participant.json</Mono> for both the provider and the consumer connector.
          </Callout>
        </Section>

        {/* ── Traces ── */}
        <Section id="traces" title="Trace & observability system">
          <P><Mono>trace-api</Mono> (FastAPI) exposes <Mono>POST /api/traces</Mono> with no auth so internal services and the Java EDC extension can push events. Events are stored in Postgres (<Mono>trace_events</Mono>). This dashboard reads them via authenticated GET endpoints.</P>

          <Sub title="What&rsquo;s in each trace event">
            <P>Every trace event now includes a rich payload with the actual data being processed. For example:</P>
            <ul className="ml-4 list-disc space-y-1 text-xs text-muted">
              <li><strong>qr_scanned</strong> — serial number, carrier URL, machine type</li>
              <li><strong>edc_catalog_query</strong> — DSP endpoint, management endpoint, protocol</li>
              <li><strong>gaiax_compliance_submission</strong> — issuer DID, subject DID, verifier service</li>
              <li><strong>edc_data_plane_received</strong> — brand, product name, ski length, maintenance records via data plane</li>
              <li><strong>dpp_data_returned</strong> — complete summary: brand, product, serial, maintenance count, data source</li>
            </ul>
          </Sub>

          <Sub title="How trace correlation works">
            <P>A single user action (e.g. QR lookup) generates one <Mono>trace_id</Mono> (UUID). The repair-api creates it. EDC Java extensions look up the latest <Mono>qr_scanned</Mono> event from the trace collector to attach their spans to the same trace.</P>
          </Sub>

          <Sub title="Ingestion sources">
            <Table
              headers={["Source", "Origin"]}
              rows={[
                [<Mono key="1">repair_api</Mono>, "Repair API — QR scan entry, lookup errors, maintenance reports"],
                [<Mono key="2">repair_shop_edc</Mono>, "Repair API — EDC management-driven steps (catalog → transfer → data fetch)"],
                [<Mono key="3">dpp_api</Mono>, "DPP API — data requests served through the data plane proxy"],
                [<Mono key="4">edc_cp_dpp</Mono>, "DPP control plane Java extension — negotiation lifecycle, Gaia-X verification"],
                [<Mono key="5">dpp_data_path</Mono>, "Repair API — AAS data fetching (after EDC trust established)"],
                [<Mono key="6">gx-compliance</Mono>, "Gaia-X compliance service invocation results"],
              ]}
            />
          </Sub>

          <Sub title="Database schema (trace_events)">
            <Table
              headers={["Column", "Type", "Role"]}
              rows={[
                [<Mono key="1">trace_id</Mono>, "UUID", "Correlates all events for one lookup"],
                [<Mono key="2">span_id</Mono>, "UUID", "Identifies this step; paired with parent for trees"],
                [<Mono key="3">parent_span_id</Mono>, "UUID | null", "Links child span to parent for waterfall"],
                [<Mono key="4">event_type</Mono>, "text", "Machine-readable step name (see catalog below)"],
                [<Mono key="5">source</Mono>, "text", "Which service emitted this span"],
                [<Mono key="6">participant_id</Mono>, "text", "EDC participant (dpp, repair_shop)"],
                [<Mono key="7">serial_number</Mono>, "text", "Ski serial number"],
                [<Mono key="8">payload</Mono>, "JSONB", "Rich event data: IDs, endpoints, product data, angles, etc."],
                [<Mono key="9">timestamp</Mono>, "timestamptz", "When the event occurred (UTC)"],
              ]}
            />
          </Sub>

          <Sub title="Trace API endpoints">
            <Table
              headers={["Method", "Path", "Auth", "Description"]}
              rows={[
                ["POST", <Mono key="1">/api/traces</Mono>, "None", "Ingest one event"],
                ["POST", <Mono key="2">/api/traces/batch</Mono>, "None", "Ingest multiple events"],
                ["GET", <Mono key="3">/api/traces</Mono>, "JWT", "List events with filters (event_type, source, serial)"],
                ["GET", <Mono key="4">/api/traces/{'{'}<em>id</em>{'}'}</Mono>, "JWT", "All events for one trace (waterfall)"],
                ["GET", <Mono key="5">/api/traces/stats</Mono>, "JWT", "Aggregates by event_type and source"],
                ["GET", <Mono key="6">/api/access-matrix</Mono>, "JWT", "Both connectors: assets, policies, agreements, identity"],
              ]}
            />
          </Sub>
        </Section>

        {/* ── Event types ── */}
        <Section id="events" title="Event types catalog">
          <Sub title="Wintersteiger Machine orchestration (repair_api + repair_shop_edc)">
            <Table
              headers={["event_type", "Payload highlights", "Meaning"]}
              rows={[
                [<Mono key="a">qr_scanned</Mono>, "serial_number, carrier_url, machine_type", "Lookup started for a serial number"],
                [<Mono key="b">edc_catalog_query</Mono>, "dsp_endpoint, management_endpoint", "EDC catalog request issued to discover DPP assets"],
                [<Mono key="c">edc_catalog_received</Mono>, "asset_id, offer_id, has_gaiax_constraint", "Catalog response with available datasets"],
                [<Mono key="d">edc_contract_negotiation</Mono>, "offer_id, asset_id, counter_party_address", "Contract negotiation initiated"],
                [<Mono key="e">gaiax_compliance_submission</Mono>, "issuer_did, subject_did, verifier", "VP-JWT submitted to compliance service"],
                [<Mono key="f">gaiax_compliance_verified</Mono>, "result, compliant, polls", "Gaia-X compliance passed"],
                [<Mono key="g">edc_agreement_reached</Mono>, "agreement_id, negotiation_id, asset_id", "Contract finalized"],
                [<Mono key="h">edc_edr_received</Mono>, "endpoint, auth_type", "EDR token received for data plane access"],
                [<Mono key="i">edc_data_plane_fetch</Mono>, "endpoint, auth_type", "Passport fetched through EDC data plane"],
                [<Mono key="j">edc_data_plane_received</Mono>, "brand, productName, skiLength, maintenance_records", "Passport received via data plane"],
                [<Mono key="k">data_request_received</Mono>, "endpoint, aas_target", "DPP API received request from data plane"],
                [<Mono key="l">dpp_data_returned</Mono>, "brand, productName, skiLength, maintenanceRecords, source", "Complete passport delivered to UI"],
                [<Mono key="m">maintenance_report_created</Mono>, "service_type, performed_by", "New maintenance report recorded"],
              ]}
            />
          </Sub>

          <Sub title="EDC control plane + Gaia-X (edc_cp_*)">
            <Table
              headers={["event_type", "Meaning"]}
              rows={[
                [<Mono key="a">edc_negotiation_requested</Mono>, "Negotiation request received"],
                [<Mono key="b">edc_negotiation_accepted</Mono>, "Accepted"],
                [<Mono key="c">edc_negotiation_agreed</Mono>, "Agreed"],
                [<Mono key="d">edc_negotiation_finalized</Mono>, "Finalized"],
                [<Mono key="e">edc_negotiation_terminated</Mono>, "Terminated or rejected"],
                [<Mono key="f">edc_transfer_process_started</Mono>, "Transfer started"],
                [<Mono key="g">edc_transfer_process_completed</Mono>, "Transfer completed"],
                [<Mono key="h">gaiax_edc_policy_evaluation</Mono>, "Policy engine evaluating gaiaxCompliant constraint"],
                [<Mono key="i">edc_did_resolution</Mono>, "Resolving counterparty DID document"],
                [<Mono key="j">gaiax_vc_generation</Mono>, "Building verifiable credentials"],
                [<Mono key="k">gaiax_vp_creation</Mono>, "Wrapping VP-JWT (issuer: did:web:edc-dpp.{DOMAIN})"],
              ]}
            />
          </Sub>
        </Section>

        {/* ── Docker ── */}
        <Section id="docker" title="Docker services & routing">
          <Table
            headers={["Service", "Image / build", "Role"]}
            rows={[
              [<Mono key="a">repair-api</Mono>, "backend/ (FastAPI)", "Wintersteiger Machine backend — drives EDC lookup"],
              [<Mono key="b">repair-edc-cp</Mono>, "edc/Dockerfile.controlplane", "Wintersteiger EDC control plane (management + DSP)"],
              [<Mono key="c">repair-edc-dp</Mono>, "edc/Dockerfile.dataplane", "Wintersteiger EDC data plane"],
              [<Mono key="d">repair-ui</Mono>, "frontend/ (Next.js)", "Wintersteiger Machine web UI"],
              [<Mono key="e">dpp-api</Mono>, "backend/ (FastAPI)", "Atomic backend — seeds EDC catalog on startup"],
              [<Mono key="f">dpp-edc-cp</Mono>, "edc/Dockerfile.controlplane", "Atomic EDC control plane (+ Gaia-X extension)"],
              [<Mono key="g">dpp-edc-dp</Mono>, "edc/Dockerfile.dataplane", "Atomic EDC data plane (public API for HttpData-PULL)"],
              [<Mono key="h">trace-api</Mono>, "backend/ (FastAPI)", "Trace collector + access-matrix API"],
              [<Mono key="i">trace-dashboard-ui</Mono>, "frontend/ (Next.js)", "This Atomic Trace Dashboard"],
              [<Mono key="j">gx-compliance</Mono>, "Node.js", "Gaia-X compliance verification (DID resolution, VP validation)"],
              [<Mono key="k">memgraph</Mono>, "memgraph:3.4.0", "Graph DB for gx-compliance"],
              [<Mono key="l">caddy</Mono>, "caddy:2-alpine", "Reverse proxy — hostname-based routing"],
            ]}
          />

          <Sub title="Caddy routing">
            <Table
              headers={["Hostname", "Target"]}
              rows={[
                [<Mono key="a">repair.*</Mono>, "/api/* → repair-api, else → repair-ui"],
                [<Mono key="b">dpp.*</Mono>, "/api/* → dpp-api"],
                [<Mono key="c">traces.*</Mono>, "/api/* → trace-api, else → trace-dashboard-ui"],
                [<Mono key="d">edc-dpp.*</Mono>, "/.well-known/* → dpp-edc-cp:8080, /dsp/* → :9292, /public/* → dpp-edc-dp:9291"],
                [<Mono key="e">edc-repair-shop.*</Mono>, "/.well-known/* → repair-edc-cp:8080, /dsp/* → :9292, /public/* → repair-edc-dp:9291"],
                [<Mono key="f">compliance.*</Mono>, "→ gx-compliance:3000"],
              ]}
            />
          </Sub>

          <Callout>
            The EDC uses in-memory storage. Restarting a control plane loses all assets, policies, agreements, and data plane registrations. After restarting CPs, also restart <Mono>dpp-api</Mono> (re-seeds catalog) and both data planes (re-register with their CP).
          </Callout>
        </Section>

        <footer className="mt-10 border-t border-line pt-4 text-xs text-ghost">
          Hanover Demonstrator — Gaia-X compliant dataspace for digital ski product passports. Built with Eclipse EDC, PASSAT AAS, and Gaia-X compliance services.
        </footer>
      </div>
    </div>
  );
}
