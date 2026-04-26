// Server-side Smartsheet helpers. Token never reaches the browser.

const SHEET_ID = "1833739362822020";
const SUPERVISOR_FILTER = "Billy Keesee";

export interface RawJobRow {
  rowId: string;
  workOrder: string;
  status: string; // raw Secondary Job Status
  jobStatus: string;
  address: string;
  city: string;
  zip: string;
  notes: string;
  splicingNotes: string;
  workType: string;
  base: string;
  scheduleDate: string;
  endDate: string;
  dueDate: string;
  receivedDate: string;
  bidValue: string;
  crew: string;
  permitNumber: string;
  supervisor: string;
}

interface SmartsheetCell {
  columnId: number;
  value?: string | number | boolean;
  displayValue?: string;
}
interface SmartsheetRow {
  id: number;
  cells: SmartsheetCell[];
}
interface SmartsheetColumn {
  id: number;
  title: string;
}
interface SmartsheetSheet {
  columns: SmartsheetColumn[];
  rows: SmartsheetRow[];
}

const COLUMN_TITLES = {
  workOrder: "Work Order",
  supervisor: "Construction Supervisor",
  secondaryStatus: "Secondary Job Status",
  jobStatus: "Job Status",
  address: "Address",
  city: "City",
  zip: "Zip Code",
  notes: "NSC Project Notes",
  splicingNotes: "Splicing Notes",
  workType: "Work Type",
  base: "Construction Base",
  scheduleDate: "Schedule Date",
  endDate: "End Date",
  dueDate: "Due Date",
  receivedDate: "Date Received",
  bidValue: "BidMaster Value",
  crew: "Construction Crew/Forman",
  permitNumber: "Permit #",
} as const;

export async function fetchSmartsheetJobs(token: string): Promise<RawJobRow[]> {
  const url = `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}?include=objectValue&pageSize=10000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Smartsheet ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as SmartsheetSheet;

  const colByTitle = new Map<string, number>();
  for (const c of data.columns) colByTitle.set(c.title, c.id);

  const colId = (key: keyof typeof COLUMN_TITLES) => colByTitle.get(COLUMN_TITLES[key]);

  const rows: RawJobRow[] = [];
  for (const row of data.rows) {
    const get = (key: keyof typeof COLUMN_TITLES): string => {
      const id = colId(key);
      if (!id) return "";
      const cell = row.cells.find((c) => c.columnId === id);
      const v = cell?.displayValue ?? cell?.value;
      return v == null ? "" : String(v);
    };

    const supervisor = get("supervisor");
    if (supervisor !== SUPERVISOR_FILTER) continue;

    const workOrder = get("workOrder");
    if (!workOrder) continue;

    rows.push({
      rowId: String(row.id),
      workOrder,
      status: get("secondaryStatus"),
      jobStatus: get("jobStatus"),
      address: get("address"),
      city: get("city"),
      zip: get("zip"),
      notes: get("notes"),
      splicingNotes: get("splicingNotes"),
      workType: get("workType"),
      base: get("base"),
      scheduleDate: get("scheduleDate"),
      endDate: get("endDate"),
      dueDate: get("dueDate"),
      receivedDate: get("receivedDate"),
      bidValue: get("bidValue"),
      crew: get("crew"),
      permitNumber: get("permitNumber"),
      supervisor,
    });
  }
  return rows;
}
