export type RuntimeProfile = "development" | "personal" | "public";

let activeProfile: RuntimeProfile | undefined;

/** A document keeps one persistence identity for its lifetime. */
export function configureRuntime(profile: RuntimeProfile): void {
  if (!["development", "personal", "public"].includes(profile)) throw new Error("Unknown JIBJIP runtime profile.");
  if (activeProfile !== undefined && activeProfile !== profile) throw new Error("A JIBJIP document cannot switch runtime profiles.");
  activeProfile = profile;
}

export function runtimeProfile(): RuntimeProfile {
  if (activeProfile === undefined) throw new Error("Mount JIBJIP with an explicit runtime profile before using browser services.");
  return activeProfile;
}
