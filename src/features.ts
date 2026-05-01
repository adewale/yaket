export type FeatureName = "wrel" | "wfreq" | "wspread" | "wcase" | "wpos" | "KPF";

export function featureEnabled(features: readonly string[] | null | undefined, name: FeatureName): boolean {
  return features == null || features.includes(name);
}
