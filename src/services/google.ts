/**
 * LUMINA GOOGLE INTEGRATION SERVICE
 * Handles read-only access to Drive and Gmail for construction workflow context.
 */

const GOOGLE_API_ROOT = 'https://www.googleapis.com';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

export interface GmailTriage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

/**
 * Searches for a Google Drive folder matching a Job Number and lists its contents.
 */
export const fetchDriveFilesForJob = async (accessToken: string, jobNumber: string): Promise<DriveFile[]> => {
  try {
    // 1. Find the folder
    const folderSearch = await fetch(
      `${GOOGLE_API_ROOT}/drive/v3/files?q=name contains '${jobNumber}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const folderData = await folderSearch.json();
    
    if (!folderData.files || folderData.files.length === 0) return [];
    
    const folderId = folderData.files[0].id;

    // 2. List files in that folder
    const fileSearch = await fetch(
      `${GOOGLE_API_ROOT}/drive/v3/files?q='${folderId}' in parents and trashed = false&fields=files(id, name, mimeType, webViewLink)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const fileData = await fileSearch.json();
    return fileData.files || [];
  } catch (error) {
    console.error('Error fetching Drive files:', error);
    return [];
  }
};

/**
 * Scans Gmail for recent emails related to specific keywords or job numbers.
 */
export const triageGmailContext = async (accessToken: string, jobNumbers: string[]): Promise<GmailTriage[]> => {
  try {
    // Search query: unread emails containing any of the active job numbers
    const query = `is:unread (${jobNumbers.join(' OR ')})`;
    const messageList = await fetch(
      `${GOOGLE_API_ROOT}/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await messageList.json();
    
    if (!listData.messages) return [];

    const messages = await Promise.all(
      listData.messages.map(async (m: { id: string }) => {
        const detail = await fetch(
          `${GOOGLE_API_ROOT}/gmail/v1/users/me/messages/${m.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await detail.json();
        const headers = data.payload.headers;
        return {
          id: data.id,
          subject: headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject',
          from: headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender',
          snippet: data.snippet,
          date: headers.find((h: any) => h.name === 'Date')?.value || '',
        };
      })
    );

    return messages;
  } catch (error) {
    console.error('Error triaging Gmail:', error);
    return [];
  }
};

/**
 * Combined context for Lumina AI
 */
export const getLuminaGoogleContext = async (accessToken: string) => {
  try {
    const [driveFiles, emails] = await Promise.all([
      fetch(`${GOOGLE_API_ROOT}/drive/v3/files?pageSize=5&fields=files(name, webViewLink)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(r => r.json()),
      fetch(`${GOOGLE_API_ROOT}/gmail/v1/users/me/messages?maxResults=5`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(r => r.json())
    ]);

    return {
      connected: true,
      driveRecent: driveFiles.files?.map((f: any) => f.name) || [],
      gmailRecent: emails.messages?.length || 0
    };
  } catch (e) {
    return { connected: false };
  }
};
