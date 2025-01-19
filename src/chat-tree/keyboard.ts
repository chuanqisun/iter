/**
 * syntax: [ctrl+][alt+][shift+]<keyname>
 * keyname is the lowercased KeyboardEvent.key, except for space being "space"
 * see special key names: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
 */
export function getCombo(event: KeyboardEvent) {
  const ctrlMetaPrefix = event.ctrlKey || event.metaKey ? "ctrl+" : "";
  const altOption = event.altKey ? "alt+" : "";
  const shiftOption = event.shiftKey ? "shift+" : "";
  const key = event.key === " " ? "space" : event.key.toLowerCase();
  return `${ctrlMetaPrefix}${altOption}${shiftOption}${key}`;
}
