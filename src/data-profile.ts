export const COMPLETE_GENERATED_DOCUMENT = 'complete-generated-document';

export const PERMITTED_DATA_PROFILES = [COMPLETE_GENERATED_DOCUMENT] as const;

export type PermittedDataProfile = (typeof PERMITTED_DATA_PROFILES)[number];

export const DATA_PROFILE_FIELDS = {
  [COMPLETE_GENERATED_DOCUMENT]: {
    ruleText: true,
    examples: true,
    glossaryText: true,
    credits: true,
    metadata: true,
    hashes: true,
    sourceUrl: true,
    effectiveDate: true,
    sourceTxt: false,
  },
} as const;

export function isPermittedDataProfile(value: string): value is PermittedDataProfile {
  return (PERMITTED_DATA_PROFILES as readonly string[]).includes(value);
}
