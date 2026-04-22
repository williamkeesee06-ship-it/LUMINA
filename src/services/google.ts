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

export async function fetchFilesInFolder(token: string, folderId: string) {
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink)`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.error('[Lumina Google] Folder Fetch Error:', err);
    return [];
  }
}

export function classifyFile(fileName: string) {
  const n = fileName.toLowerCase();
  if (n.includes('permit')) return 'permit';
  if (n.includes('print') || n.includes('drawing') || n.includes('map') || n.includes('plan') || n.includes('sheet')) return 'prints';
  if (n.includes('redline') || n.includes('mark') || n.includes('markup')) return 'redlines';
  if (n.includes('bid') || n.includes('quote') || n.includes('cost') || n.includes('master') || n.includes('pricing')) return 'bidmaster';
  if (n.includes('revisit') || n.includes('return') || n.includes('fix') || n.includes('snag')) return 'revisit';
  return 'other';
}

export async function fetchMoonForJob(token: string, jobNumber: string) {
  try {
    const q = encodeURIComponent(`"${jobNumber}"`);
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${q}&maxResults=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    if (!listData.threads || listData.threads.length === 0) return null;

    const threadId = listData.threads[0].id;
    const threadRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const threadData = await threadRes.json();
    const lastMessage = threadData.messages[threadData.messages.length - 1];

    const isFromMe = lastMessage.labelIds.includes('SENT');
    const isDone = !lastMessage.labelIds.includes('INBOX');

    return {
      threadId,
      subject: threadData.messages[0].payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject',
      snippet: lastMessage.snippet,
      state: isDone ? 'inactive' : (isFromMe ? 'waiting' : 'needs_reply')
    };
  } catch (err) {
    console.error(`[Lumina Google] Moon Fetch Error for ${jobNumber}:`, err);
    return null;
  }
}
