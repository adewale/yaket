export const VALID_FEATURE_NAMES = ["wrel", "wfreq", "wspread", "wcase", "wpos", "KPF"] as const;

export type FeatureName = typeof VALID_FEATURE_NAMES[number];

const VALID_FEATURE_NAME_SET = new Set<string>(VALID_FEATURE_NAMES);

export function isFeatureName(value: string): value is FeatureName {
  return VALID_FEATURE_NAME_SET.has(value);
}

export function featureEnabled(features: readonly FeatureName[] | null | undefined, name: FeatureName): boolean {
  return features == null || features.includes(name);
}
