export interface RoleMetadata {
  icon: string;
  displayName: string;
}

export const ROLE_METADATA: Record<string, RoleMetadata> = {
  system: { icon: "⚙️", displayName: "System" },
  user: { icon: "👤", displayName: "User" },
  assistant: { icon: "🤖", displayName: "Assistant" },
  developer: { icon: "🛠️", displayName: "Developer" },
  model: { icon: "🤖", displayName: "Model" },
  tool: { icon: "🔧", displayName: "Tool" },
};

export const getRoleIcon = (role: string): string => ROLE_METADATA[role]?.icon ?? "💬";
export const getRoleDisplayName = (role: string): string => ROLE_METADATA[role]?.displayName ?? role;
