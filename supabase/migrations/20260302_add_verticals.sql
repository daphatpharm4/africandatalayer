-- Expand the category CHECK constraint to support all verticals
ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_category_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_category_check
  CHECK (category IN (
    'pharmacy',
    'fuel_station',
    'mobile_money',
    'alcohol_outlet',
    'retail_kiosk',
    'billboard',
    'fmcg',
    'transport_station_hub',
    'census_satellite_groundtruth',
    'fuel_fleet',
    'ngo_services',
    'public_goods',
    'competitor_intelligence',
    'water_point'
  ));
