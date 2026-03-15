# ADL Automation Intake Templates

These n8n templates push low-trust external leads into ADL's internal intake queue instead of writing directly to `point_events`.

## Required environment variables

- `ADL_BASE_URL`: Base URL for the deployed ADL API, for example `https://africandatalayer.vercel.app`
- `AUTOMATION_SECRET`: Shared bearer token used by `POST /api/intake/leads`

## ADL API contract

- `POST /api/intake/leads`
  - Auth: `Authorization: Bearer $AUTOMATION_SECRET`
  - Body shape:

```json
{
  "runKey": "osm-2026-03-12T18:00:00Z",
  "workflowName": "adl-osm-public-refresh",
  "sourceSystem": "osm_overpass",
  "triggerType": "schedule",
  "startedAt": "2026-03-12T18:00:00.000Z",
  "completedAt": "2026-03-12T18:05:00.000Z",
  "leads": [
    {
      "sourceRecordId": "osm:12345",
      "sourceUrl": "https://www.openstreetmap.org/node/12345",
      "category": "fuel_station",
      "location": { "latitude": 4.0862, "longitude": 9.7354 },
      "normalizedDetails": { "name": "Total Bonamoussadi" },
      "rawPayload": { "raw_source": "osm" },
      "evidenceUrls": ["https://www.openstreetmap.org/node/12345"],
      "freshnessAt": "2026-03-12T18:03:00.000Z",
      "priority": "high"
    }
  ]
}
```

- `GET /api/intake/leads`
  - Auth: admin session or `Authorization: Bearer $AUTOMATION_SECRET`
  - Example: `/api/intake/leads?status=ready_for_assignment&limit=100`

## Templates

- `adl-osm-public-refresh.workflow.json`
  - Scheduled baseline refresh for OSM or other public POI feeds.
- `adl-file-intake.workflow.json`
  - Webhook/file-driven flow for CSV/XLSX/PDF preprocessing before posting leads.
- `adl-competitor-leads.workflow.json`
  - Webhook-driven flow for allowed competitor or public inventory extractions.

## Operational rules

- Keep direct writes to `CREATE_EVENT` and `ENRICH_EVENT` disabled in these workflows.
- Use canonical ADL categories where possible; aliases like `FUEL` and `PHARMACY` are normalized server-side.
- Do not use the competitor template for Google Maps-style scraping until legal and ToS review is complete.
