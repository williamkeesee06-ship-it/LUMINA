export async function fetchGmailUnreadCount(token: string) {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.resultSizeEstimate || 0;
  } catch (err) {
    console.error('[Lumina Google] Gmail Fetch Error:', err);
    return 0;
  }
}

export async function fetchDriveFiles(token: string) {
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,webViewLink)', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.error('[Lumina Google] Drive Fetch Error:', err);
    return [];
  }
}
