import { listSettingsHistory } from "@/features/settings/settingsHistoryRepository";

export async function getSettingsHistory() {
  const changes = await listSettingsHistory();

  return {
    ok: true,
    changes,
  };
}
