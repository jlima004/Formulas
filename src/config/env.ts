import "dotenv/config";

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function asString(value: string | undefined, fallback = ""): string {
  return value?.trim() || fallback;
}

export type ApiMode = "batch" | "api" | "both";

function asApiMode(value: string | undefined): ApiMode {
  const normalized = (value || "batch").trim().toLowerCase();
  if (normalized === "api" || normalized === "both") {
    return normalized;
  }

  return "batch";
}

export const env = {
  API_MODE: asApiMode(process.env.API_MODE),
  API_HOST: asString(process.env.API_HOST, "0.0.0.0"),
  API_PORT: asNumber(process.env.API_PORT, 3000),
  TRUST_PROXY: asBoolean(process.env.TRUST_PROXY, false),
  REDIS_ENABLED: asBoolean(process.env.REDIS_ENABLED, false),
  REDIS_URL: asString(process.env.REDIS_URL, "redis://127.0.0.1:6379"),
  REDIS_QUEUE_NAME: asString(process.env.REDIS_QUEUE_NAME, "drive-file-events"),
  DRIVE_WEBHOOK_TOKEN: asString(process.env.DRIVE_WEBHOOK_TOKEN),
  DRIVE_FOLDER_ID: asString(process.env.DRIVE_FOLDER_ID),
  DRIVE_SHARED_DRIVE_ID: asString(process.env.DRIVE_SHARED_DRIVE_ID),
  DRIVE_WEBHOOK_ADDRESS: asString(process.env.DRIVE_WEBHOOK_ADDRESS),
  DRIVE_TEMP_DIR: asString(process.env.DRIVE_TEMP_DIR, "/tmp/formulas-drive"),
  DRIVE_SYNC_MAX_FILES: asNumber(process.env.DRIVE_SYNC_MAX_FILES, 200),
  DRIVE_WATCH_TTL_SECONDS: asNumber(
    process.env.DRIVE_WATCH_TTL_SECONDS,
    86_400,
  ),
  DRIVE_WATCH_AUTO_RENEW_ENABLED: asBoolean(
    process.env.DRIVE_WATCH_AUTO_RENEW_ENABLED,
    true,
  ),
  DRIVE_WATCH_RENEW_BEFORE_SECONDS: asNumber(
    process.env.DRIVE_WATCH_RENEW_BEFORE_SECONDS,
    900,
  ),
  DRIVE_WATCH_CHECK_INTERVAL_SECONDS: asNumber(
    process.env.DRIVE_WATCH_CHECK_INTERVAL_SECONDS,
    60,
  ),
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON: asString(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON,
  ),
  GOOGLE_APPLICATION_CREDENTIALS: asString(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ),
  GOOGLE_DRIVE_SCOPES: asString(
    process.env.GOOGLE_DRIVE_SCOPES,
    "https://www.googleapis.com/auth/drive.readonly",
  )
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0),
};
