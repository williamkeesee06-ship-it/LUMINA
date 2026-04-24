import type { SmartsheetResponse, JobOrbit } from '../types/lumina';
import { resolveGalaxy } from '../lib/lumina';

const TOKEN = import.meta.env.VITE_SMARTSHEET_TOKEN;
const SHEET_ID = import.meta.env.VITE_SMARTSHEET_SHEET_ID || '1833739362822020';

export const fetchConstructionJobs = async (): Promise<JobOrbit[]> => {
  if (!TOKEN) {
    console.warn('[Lumina] Smartsheet token missing. Please check VITE_SMARTSHEET_TOKEN in .env');
    return [];
  }

  try {
    // Explicitly using the /api/smartsheet proxy path with hardcoded ID as requested
    const response = await fetch(`/api/smartsheet/2.0/sheets/${SHEET_ID}?include=attachments`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch from Smartsheet');

    const data: SmartsheetResponse = await response.json();
    const columns = data.columns;


    const colMap: Record<string, number> = {};
    columns.forEach(col => {
      colMap[col.title] = col.id;
    });

    const jobs = data.rows
      .map(row => {
        const getVal = (title: string) => {
          const id = colMap[title];
          const cell = row.cells.find(c => c.columnId === id);
          return cell?.displayValue || cell?.value?.toString() || '';
        };

        const driveFolderId = row.attachments?.find(a => 
          a.attachmentType === 'GOOGLE_DRIVE' || (a.url && a.url.includes('drive.google.com'))
        )?.url?.match(/([a-zA-Z0-9_-]{28,})/)?.[0];

        return {
          rowId: String(row.id),
          jobNumber: getVal('Primary'),
          status: resolveGalaxy(getVal('Secondary Job Status')),
          address: getVal('Address'),
          city: getVal('City'),
          notes: getVal('NSC Project Notes'),
          crew: getVal('Construction Crew/Foreman'),
          scheduleDate: getVal('Schedule Date'),
          cpaSro: getVal('CPA/SRO'),
          supervisor: getVal('Construction Supervisor'),
          driveFolderId,
          moons: [],
          satellites: [],
        } as JobOrbit;
      })
      .filter(job => job.supervisor === 'Billy Keesee');

    return jobs;
  } catch (error) {
    console.error('Lumina Data Sync Error:', error);
    return [];
  }
};
