export function isAppendingOnCheckpoint(
  savedFingerprints: string[] | undefined,
  currentFingerprints: string[],
): boolean {
  /**
   * Overwrite condition:
   * - currentFingerprints length >= savedFingerprints length - 1 (accommodates active assistant node completion / user append)
   * - All historical indices in savedFingerprints (up to savedFingerprints.length - 1) match currentFingerprints exactly.
   */
  if (!savedFingerprints?.length || currentFingerprints.length < savedFingerprints.length - 1) {
    return false;
  }

  return savedFingerprints.slice(0, -1).every((fp, i) => fp === currentFingerprints[i]);
}
