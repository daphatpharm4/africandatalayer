-- Reassert active submission categories in point_events.
ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_category_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_category_check
  CHECK (category IN (
    'pharmacy',
    'fuel_station',
    'mobile_money',
    'alcohol_outlet',
    'billboard',
    'transport_road',
    'census_proxy'
  ));
