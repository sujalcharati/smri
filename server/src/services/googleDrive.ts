import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export const createOAuth2Client = (): OAuth2Client => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

export const getAuthUrl = (oauth2Client: OAuth2Client): string => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
};

export const getDriveClient = (accessToken: string, refreshToken?: string): drive_v3.Drive => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
}

export const listFiles = async (
  drive: drive_v3.Drive,
  folderId?: string,
  pageToken?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> => {
  const query = folderId
    ? `'${folderId}' in parents and trashed = false`
    : `trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'text/plain')`;

  const response = await drive.files.list({
    q: query,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
    pageSize: 50,
    pageToken,
    orderBy: 'modifiedTime desc',
  });

  const files = (response.data.files || []).map((file) => ({
    id: file.id || '',
    name: file.name || '',
    mimeType: file.mimeType || '',
    size: file.size || '0',
    modifiedTime: file.modifiedTime || '',
    webViewLink: file.webViewLink || undefined,
    iconLink: file.iconLink || undefined,
  }));

  return {
    files,
    nextPageToken: response.data.nextPageToken || undefined,
  };
};

export const listFolders = async (
  drive: drive_v3.Drive,
  parentId?: string
): Promise<DriveFile[]> => {
  const query = parentId
    ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, modifiedTime)',
    pageSize: 100,
    orderBy: 'name',
  });

  return (response.data.files || []).map((file) => ({
    id: file.id || '',
    name: file.name || '',
    mimeType: file.mimeType || '',
    size: '0',
    modifiedTime: file.modifiedTime || '',
  }));
};

export const getFileContent = async (
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string
): Promise<{ content: string; exportedMimeType: string }> => {
  // Handle Google Docs native formats
  if (mimeType === 'application/vnd.google-apps.document') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return { content: response.data as string, exportedMimeType: 'text/plain' };
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/csv',
    });
    return { content: response.data as string, exportedMimeType: 'text/csv' };
  }

  if (mimeType === 'application/vnd.google-apps.presentation') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return { content: response.data as string, exportedMimeType: 'text/plain' };
  }

  // For other files (PDF, DOCX, etc.), download as binary
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return {
    content: Buffer.from(response.data as ArrayBuffer).toString('base64'),
    exportedMimeType: mimeType,
  };
};

export const getFileMetadata = async (
  drive: drive_v3.Drive,
  fileId: string
): Promise<DriveFile | null> => {
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink, iconLink',
    });

    return {
      id: response.data.id || '',
      name: response.data.name || '',
      mimeType: response.data.mimeType || '',
      size: response.data.size || '0',
      modifiedTime: response.data.modifiedTime || '',
      webViewLink: response.data.webViewLink || undefined,
      iconLink: response.data.iconLink || undefined,
    };
  } catch {
    return null;
  }
};

export const getMimeTypeCategory = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.google-apps.document': 'gdoc',
    'application/vnd.google-apps.spreadsheet': 'gsheet',
    'application/vnd.google-apps.presentation': 'gslide',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slide',
    'text/plain': 'txt',
    'application/msword': 'doc',
  };

  return mimeMap[mimeType] || 'unknown';
};
