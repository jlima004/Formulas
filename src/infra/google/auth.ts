import { GoogleAuth } from "google-auth-library";
import { env } from "../../config/env.js";

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function parseInlineCredentials(): ServiceAccountJson | null {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    return null;
  }

  const parsed = JSON.parse(
    env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON,
  ) as ServiceAccountJson;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_JSON invalido.");
  }

  return parsed;
}

export function createGoogleAuth(): GoogleAuth {
  const inlineCredentials = parseInlineCredentials();

  if (inlineCredentials) {
    return new GoogleAuth({
      credentials: inlineCredentials,
      scopes: env.GOOGLE_DRIVE_SCOPES,
    });
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new GoogleAuth({
      keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: env.GOOGLE_DRIVE_SCOPES,
    });
  }

  throw new Error(
    "Credenciais Google nao configuradas. Defina GOOGLE_SERVICE_ACCOUNT_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS.",
  );
}
