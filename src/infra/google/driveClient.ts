import { google, type drive_v3 } from "googleapis";
import { createGoogleAuth } from "./auth.js";

export interface DrivePdfFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export class DriveClient {
  private readonly api: drive_v3.Drive;

  constructor() {
    this.api = google.drive({
      version: "v3",
      auth: createGoogleAuth(),
    });
  }

  async listPdfFilesInFolder(
    folderId: string,
    options?: { driveId?: string },
  ): Promise<DrivePdfFile[]> {
    const driveId = options?.driveId?.trim() || undefined;

    const response = await this.api.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id,name,mimeType,modifiedTime)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: driveId ? "drive" : "allDrives",
      driveId,
    });

    const files: DrivePdfFile[] = [];

    for (const file of response.data.files || []) {
      if (!file.id || !file.name || !file.mimeType) {
        continue;
      }

      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime || undefined,
      });
    }

    return files;
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await this.api.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      {
        responseType: "arraybuffer",
      },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  async getStartPageToken(options?: { driveId?: string }): Promise<string> {
    const driveId = options?.driveId?.trim() || undefined;

    const response = await this.api.changes.getStartPageToken({
      supportsAllDrives: true,
      driveId,
    });

    if (!response.data.startPageToken) {
      throw new Error("Nao foi possivel obter startPageToken do Drive.");
    }

    return response.data.startPageToken;
  }

  async watchChanges(params: {
    pageToken: string;
    channelId: string;
    address: string;
    driveId?: string;
    channelToken?: string;
    expirationMs?: number;
  }): Promise<{
    channelId: string;
    resourceId: string;
    resourceUri?: string;
    expirationMs?: number;
  }> {
    const driveId = params.driveId?.trim() || undefined;

    const response = await this.api.changes.watch(
      {
        pageToken: params.pageToken,
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        includeRemoved: true,
        includeCorpusRemovals: true,
        restrictToMyDrive: false,
        driveId,
        requestBody: {
          id: params.channelId,
          type: "web_hook",
          address: params.address,
          token: params.channelToken,
          expiration: params.expirationMs
            ? String(params.expirationMs)
            : undefined,
        },
      },
    );

    if (!response.data.resourceId || !response.data.id) {
      throw new Error("Resposta do watch sem resourceId/channelId.");
    }

    return {
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      resourceUri: response.data.resourceUri || undefined,
      expirationMs:
        typeof response.data.expiration === "string"
          ? Number(response.data.expiration)
          : response.data.expiration || undefined,
    };
  }

  async stopChannel(channelId: string, resourceId: string): Promise<void> {
    await this.api.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });
  }
}
