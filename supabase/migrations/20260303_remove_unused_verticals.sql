-- Remove unused verticals, keep only: pharmacy, fuel_station, mobile_money, alcohol_outlet, retail_kiosk, billboard
ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_category_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_category_check
  CHECK (category IN (
    'pharmacy',
    'fuel_station',
    'mobile_money',
    'alcohol_outlet',
    'retail_kiosk',
    'billboard'
  ));
