"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Snowflake, Wrench, Factory, Ruler, Tag, Mountain,
  ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Shield, ExternalLink,
  Image, Gauge, Hash, Package, Calendar,
} from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#86b817";

/* ── Types matching the AAS-backed API response ──────────────────────── */

interface MaintenanceRecord {
  serviceType: string;
  message: string;
  performedBy: string | null;
  timestamp: string;
}

interface EdgeParameter {
  angleTip: number | null;
  angleWaist: number | null;
  angleTail: number | null;
}

interface PassportData {
  serialNumber: string;
  identification: {
    serialNumber: string;
    componentCode: string;
    setCode: string;
    serviceCount: number;
  };
  productData: {
    skiBrand: string;
    skiManufacturer: string;
    skiProductName: string;
    skiLength: number | null;
    skiWidthTip: number | null;
    skiWidthWaist: number | null;
    skiWidthTail: number | null;
  };
  sideEdgeParameter: EdgeParameter;
  baseEdgeParameter: EdgeParameter;
  edgePerformance: {
    performanceClass: string;
  };
  productModelData: {
    season: string;
    gender: string;
    eanCode: string;
    sapArticleNumber: string;
    steelEdgeBaseAngle: string;
    steelEdgeSidewallAngle: string;
  };
  itemData: {
    factory: string;
    url: string;
    registrationDate: string;
    deliveryDate: string;
    orderNumber: string;
    pairSerial: string;
  };
  productImageUrl: string | null;
  maintenanceHistory: MaintenanceRecord[];
}

interface LookupData {
  traceId: string;
  serialNumber: string;
  source: string;
  passport: PassportData;
}

/* ── Reusable UI components ──────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  accent = ACCENT,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-subtle"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: accent }} />
          <span className="text-sm font-semibold text-on-page">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-ghost" /> : <ChevronDown className="h-4 w-4 text-ghost" />}
      </button>
      {open && <div className="border-t border-line">{children}</div>}
    </div>
  );
}

function Row({ label, value, unit }: { label: string; value: unknown; unit?: string }) {
  if (value === null || value === undefined || value === "") return null;
  const display = unit ? `${value} ${unit}` : String(value);
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-5 py-2.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-on-surface">{display}</span>
    </div>
  );
}

function AngleRow({
  label,
  tipLabel,
  waistLabel,
  tailLabel,
  tip,
  waist,
  tail,
}: {
  label: string;
  tipLabel: string;
  waistLabel: string;
  tailLabel: string;
  tip: number | null;
  waist: number | null;
  tail: number | null;
}) {
  if (tip == null && waist == null && tail == null) return null;
  return (
    <div className="border-b border-line-subtle px-5 py-2.5 text-sm last:border-0">
      <div className="mb-1.5 font-medium text-on-surface">{label}</div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: tipLabel, v: tip },
          { l: waistLabel, v: waist },
          { l: tailLabel, v: tail },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-md bg-subtle px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-ghost">{l}</div>
            <div className="font-semibold text-on-surface">{v != null ? `${v}°` : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductImage({ imageUrl }: { imageUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (!imageUrl || imgError) {
    return (
      <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle">
        <Image className="h-10 w-10 text-ghost" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Product"
      className="h-40 w-40 shrink-0 rounded-xl border border-line object-contain bg-white p-2"
      onError={() => setImgError(true)}
    />
  );
}

/* ── Main result display ─────────────────────────────────────────────── */

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const api = useApi();
  const { t } = useI18n();
  const serial = searchParams.get("serial") ?? "";
  const [data, setData] = useState<LookupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serial) { router.replace("/"); return; }
    const cached = sessionStorage.getItem(`passport-${serial}`);
    if (cached) {
      try { setData(JSON.parse(cached)); setLoading(false); return; } catch { /* fall through */ }
    }
    api
      .post<LookupData>("/lookup", { serialNumber: serial })
      .then((res) => {
        setData(res);
        sessionStorage.setItem(`passport-${serial}`, JSON.stringify(res));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [serial, api, router]);

  if (loading) {
    return (
      <div className="space-y-4 px-6 py-6">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-subtle" />
        <div className="h-48 animate-pulse rounded-xl bg-subtle" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 animate-pulse rounded-xl bg-subtle" />
          <div className="h-64 animate-pulse rounded-xl bg-subtle" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-8">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
        <p className="text-lg font-bold text-on-page">{t("repair.result.couldNotLoad")}</p>
        <p className="mt-1 max-w-md text-center text-sm text-muted">{error}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-muted hover:text-on-page"
          >
            {t("repair.result.backToScanner")}
          </button>
          <button
            onClick={() => { setLoading(true); setError(null); }}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)` }}
          >
            {t("repair.result.retry")}
          </button>
        </div>
      </div>
    );
  }

  const p = data.passport;
  const pd = p.productData;
  const id = p.identification;
  const pm = p.productModelData;
  const item = p.itemData;
  const history = p.maintenanceHistory ?? [];

  return (
    <div className="animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-on-page"
          >
            <ArrowLeft className="h-4 w-4" /> {t("repair.result.back")}
          </button>
          <div className="h-6 w-px bg-line" />
          <ProductImage imageUrl={p.productImageUrl} />
          <div>
            <h1 className="text-xl font-extrabold text-on-page">
              {pd.skiProductName || "Unknown Model"}
            </h1>
            <p className="font-mono text-xs text-ghost">SN: {p.serialNumber}</p>
            <p className="text-xs text-muted">{pd.skiBrand || pd.skiManufacturer}</p>
            {id.serviceCount > 0 && (
              <p className="mt-1 text-xs text-ghost">{id.serviceCount} {t("repair.result.servicesRecorded")}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push(`/report?serial=${encodeURIComponent(serial)}`)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)`,
            boxShadow: `0 4px 12px ${ACCENT}40`,
          }}
        >
          <Wrench className="h-4 w-4" /> {t("repair.result.submitReport")}
        </button>
      </div>

      {/* Status badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          {t("repair.result.retrievedVia")}
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-600">
          <Shield className="h-3 w-3" />
          {t("repair.result.dpp")}
        </div>
        {p.edgePerformance.performanceClass && (
          <div className="flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-xs font-semibold text-blue-600">
            <Gauge className="h-3 w-3" />
            {t("repair.result.performance")}: {p.edgePerformance.performanceClass}
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ghost">
          Trace: {data.traceId.slice(0, 12)}
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Product Identity */}
        <Section icon={Snowflake} title={t("repair.result.productIdentity")}>
          <Row label={t("repair.result.brand")} value={pd.skiBrand} />
          <Row label={t("repair.result.productName")} value={pd.skiProductName} />
          <Row label={t("repair.result.manufacturer")} value={pd.skiManufacturer} />
          <Row label={t("repair.result.serialNumber")} value={p.serialNumber} />
          <Row label={t("repair.result.componentCode")} value={id.componentCode} />
          {pm.eanCode && <Row label={t("repair.result.ean")} value={pm.eanCode} />}
          {pm.sapArticleNumber && <Row label={t("repair.result.sapArticle")} value={pm.sapArticleNumber} />}
        </Section>

        {/* Dimensions */}
        <Section icon={Ruler} title={t("repair.result.dimensions")}>
          <Row label={t("repair.result.length")} value={pd.skiLength} unit="cm" />
          <Row label={t("repair.result.widthTip")} value={pd.skiWidthTip} unit="mm" />
          <Row label={t("repair.result.widthWaist")} value={pd.skiWidthWaist} unit="mm" />
          <Row label={t("repair.result.widthTail")} value={pd.skiWidthTail} unit="mm" />
          {pm.season && <Row label={t("repair.result.season")} value={pm.season} />}
          {pm.gender && <Row label={t("repair.result.gender")} value={pm.gender} />}
        </Section>

        {/* Grinding Parameters — Side Edge */}
        <Section icon={Mountain} title={t("repair.result.sideEdge")} accent="#2563eb">
          <AngleRow
            label={t("repair.result.grindingAngles")}
            tipLabel={t("repair.result.tip")}
            waistLabel={t("repair.result.waist")}
            tailLabel={t("repair.result.tail")}
            tip={p.sideEdgeParameter.angleTip}
            waist={p.sideEdgeParameter.angleWaist}
            tail={p.sideEdgeParameter.angleTail}
          />
          {pm.steelEdgeSidewallAngle && (
            <Row label={t("repair.result.specTolerance")} value={pm.steelEdgeSidewallAngle} />
          )}
        </Section>

        {/* Grinding Parameters — Base Edge */}
        <Section icon={Mountain} title={t("repair.result.baseEdge")} accent="#7c3aed">
          <AngleRow
            label={t("repair.result.grindingAngles")}
            tipLabel={t("repair.result.tip")}
            waistLabel={t("repair.result.waist")}
            tailLabel={t("repair.result.tail")}
            tip={p.baseEdgeParameter.angleTip}
            waist={p.baseEdgeParameter.angleWaist}
            tail={p.baseEdgeParameter.angleTail}
          />
          {pm.steelEdgeBaseAngle && (
            <Row label={t("repair.result.specTolerance")} value={pm.steelEdgeBaseAngle} />
          )}
        </Section>

        {/* Manufacturing / Item Data */}
        <Section icon={Factory} title={t("repair.result.manufacturing")}>
          <Row label={t("repair.result.factory")} value={item.factory} />
          <Row label={t("repair.result.orderNumber")} value={item.orderNumber} />
          <Row label={t("repair.result.registrationDate")} value={item.registrationDate ? new Date(item.registrationDate).toLocaleDateString() : null} />
          <Row label={t("repair.result.deliveryDate")} value={item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : null} />
          <Row label={t("repair.result.pairSerial")} value={item.pairSerial} />
          {item.url && (
            <div className="border-b border-line-subtle px-5 py-2.5 text-sm last:border-0">
              <span className="text-muted">{t("repair.result.productPage")}</span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                {t("repair.result.view")} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </Section>

        {/* Maintenance History */}
        <Section icon={Wrench} title={`${t("repair.result.maintenanceHistory")} (${history.length})`} defaultOpen={history.length > 0}>
          {history.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-ghost">{t("repair.result.noRecords")}</div>
          ) : (
            <div className="space-y-2 p-4">
              {history.map((r, i) => (
                <div key={i} className="rounded-lg border border-line-subtle bg-subtle/50 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-on-surface">{r.serviceType}</span>
                    <span className="shrink-0 text-xs text-ghost">
                      {r.timestamp
                        ? new Date(r.timestamp).toLocaleDateString(undefined, {
                            year: "numeric", month: "short", day: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                  {r.message && <p className="mt-1 text-xs text-muted">{r.message}</p>}
                  {r.performedBy && <p className="mt-1 text-xs text-ghost">{t("repair.result.by")}: {r.performedBy}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Bottom CTA */}
      <div
        className="mt-6 flex items-center justify-between rounded-xl p-4"
        style={{ backgroundColor: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}
      >
        <div>
          <p className="font-semibold text-on-page">{t("repair.result.needService")}</p>
          <p className="mt-0.5 text-sm text-muted">{t("repair.result.submitForDpp")}</p>
        </div>
        <button
          onClick={() => router.push(`/report?serial=${encodeURIComponent(serial)}`)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)` }}
        >
          <Wrench className="h-4 w-4" /> {t("repair.result.report")} <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 px-6 py-6">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-subtle" />
          <div className="h-48 animate-pulse rounded-xl bg-subtle" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
