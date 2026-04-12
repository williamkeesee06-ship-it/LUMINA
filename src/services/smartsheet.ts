import type { SmartsheetResponse, ConstructionJob } from '../types/lumina';

const TOKEN = import.meta.env.VITE_SMARTSHEET_TOKEN;
const SHEET_ID = import.meta.env.VITE_SMARTSHEET_SHEET_ID || '1833739362822020';

export const fetchConstructionJobs = async (): Promise<ConstructionJob[]> => {
  if (!TOKEN) {
    console.warn('[Lumina] Smartsheet token missing. Please check VITE_SMARTSHEET_TOKEN in .env');
    return [];
  }

  try {
    // Explicitly using the /api/smartsheet proxy path with hardcoded ID as requested
    const response = await fetch(`/api/smartsheet/2.0/sheets/1833739362822020`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch from Smartsheet');

    const data: SmartsheetResponse = await response.json();
    const columns = data.columns;

    // DEBUG: log actual column names from Smartsheet
    console.log('[Lumina] Smartsheet columns:', columns.map(c => c.title));
    if (data.rows?.[0]) {
      console.log('[Lumina] First row sample:', data.rows[0]);
    }
    
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

        return {
          id: row.id,
          jobNumber: getVal('Work Order'),
          status: getVal('Secondary Job Status'),
          address: getVal('Address'),
          city: getVal('City'),
          notes: getVal('NSC Project Notes'),
          crew: getVal('Construction Crew/Foreman'),
          scheduleDate: getVal('Schedule Date'),
          cpaSro: getVal('CPA/SRO'),
          supervisor: getVal('Construction Supervisor'),
        } as ConstructionJob;
      })
      .filter(job => job.supervisor === 'Billy Keesee');

    // Geocoding Logic (City-based to respect rate limits & avoid hardcoding)
    const cityCache: Record<string, { lat: number; lng: number }> = {};
    const finalJobs = await Promise.all(jobs.map(async job => {
      const city = job.city?.trim() || 'San Diego';
      if (!cityCache[city]) {
        try {
          const res = await fetch(`/api/nominatim/search?format=json&q=${encodeURIComponent(city + ', CA')}&limit=1`);
          const geoData = await res.json();
          if (geoData?.[0]) {
            cityCache[city] = { 
              lat: parseFloat(geoData[0].lat), 
              lng: parseFloat(geoData[0].lon) 
            };
          }
        } catch (e) {
          // Fallback if rate limited or offline
          cityCache[city] = { lat: 32.7157, lng: -117.1611 }; 
        }
      }
      return { 
        ...job, 
        lat: cityCache[city]?.lat, 
        lng: cityCache[city]?.lng 
      };
    }));

    return finalJobs;
  } catch (error) {
    console.error('Lumina Data Sync Error:', error);
    return [];
  }
};
