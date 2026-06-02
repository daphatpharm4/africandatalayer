-- bd: africandatalayer-sex — point_events read path no longer scans the whole
-- table. The submissions GET handler now pushes a scope bounding box (and an
-- optional `since` time window) down to Postgres. Support those predicates with
-- a btree index on the lat/lng range columns. created_at already has
-- idx_point_events_created_at_desc (20260219_init_adl.sql), which serves the
-- `since` lower bound, so no new time index is required here.
--
-- A btree on (latitude, longitude) lets the planner range-scan latitude for the
-- north/south bound and filter longitude in-index. For pilot scale this is
-- sufficient; a PostGIS GiST index is the future upgrade if radius queries land.

CREATE INDEX IF NOT EXISTS idx_point_events_lat_lng
  ON public.point_events (latitude, longitude);
