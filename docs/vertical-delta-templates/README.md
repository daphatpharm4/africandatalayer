# Vertical Delta Templates

This pack gives you a CSV-based equivalent of a multi-tab workbook.

- `00_verticals_overview_matrix.csv`: strategy sheet for each vertical
- `01_unified_delta_dashboard_schema.csv`: canonical data dictionary
- `tabs/*.csv`: one sheet per vertical for daily updates

## Included vertical tabs

1. `pharmacy.csv`
2. `mobile_money_kiosk.csv`
3. `fuel_station.csv`
4. `alcohol_outlet.csv`
5. `retail_kiosk.csv`
6. `transport_station_hub.csv`
7. `billboard.csv`
8. `census_satellite_groundtruth.csv`
9. `fuel_fleet.csv`
10. `ngo_services.csv`
11. `fmcg.csv`
12. `public_goods.csv`
13. `competitor_intelligence.csv`

## Daily workflow

1. Copy the relevant file from `tabs/` for the day.
2. Replace placeholder values in row 2 with real observations.
3. Add one row per site or asset observed.
4. Keep `site_id` stable across days to enable clean delta tracking.
5. Compute deltas against `baseline_snapshot_date`.
6. Mark `status=validated` only after GPS + timestamp + photo checks.

## Minimal QA rules

- `snapshot_date`, `vertical_id`, `site_id`, `latitude`, `longitude`, `delta_type`, and `confidence_score` must not be empty.
- Use normalized delta types only: `new`, `removed`, `changed`, `unchanged`.
- If `delta_type=changed`, populate `delta_field`, `previous_value`, and `current_value`.
- Keep `confidence_score` between `0` and `1`.
