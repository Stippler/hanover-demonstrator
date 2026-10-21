import ObservabilityGuidePage from "./ObservabilityGuidePage";

/** Avoid stale HTML/JS for this documentation route behind reverse proxies. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ObservabilityPage() {
  return <ObservabilityGuidePage />;
}
