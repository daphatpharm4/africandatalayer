import assert from "node:assert/strict";
import test from "node:test";
import { buildPointEventsQuery } from "../lib/server/storage/pointEventsQuery.ts";

test("no filter → full table select, no where clause, asc order", () => {
  const q = buildPointEventsQuery();
  assert.match(q.text, /from point_events/i);
  assert.doesNotMatch(q.text, /where/i);
  assert.match(q.text, /order by created_at asc/i);
  assert.deepEqual(q.values, []);
});

test("bbox filter → parameterized lat/lng bounds", () => {
  const q = buildPointEventsQuery({ bbox: { minLat: 4.0, maxLat: 4.1, minLng: 9.7, maxLng: 9.8 } });
  assert.match(q.text, /where/i);
  assert.match(
    q.text,
    /latitude >= \$1 and latitude <= \$2 and longitude >= \$3 and longitude <= \$4/i,
  );
  assert.deepEqual(q.values, [4.0, 4.1, 9.7, 9.8]);
});

test("since filter → created_at lower bound param", () => {
  const q = buildPointEventsQuery({ since: "2026-06-01T00:00:00.000Z" });
  assert.match(q.text, /created_at >= \$1::timestamptz/i);
  assert.deepEqual(q.values, ["2026-06-01T00:00:00.000Z"]);
});

test("pointId filter → exact parameterized point lookup", () => {
  const q = buildPointEventsQuery({ pointId: " point-1 " });
  assert.match(q.text, /point_id = \$1/i);
  assert.deepEqual(q.values, ["point-1"]);
});

test("bbox + since combine with AND and sequential param indexes", () => {
  const q = buildPointEventsQuery({
    bbox: { minLat: 1, maxLat: 2, minLng: 3, maxLng: 4 },
    since: "2026-06-01T00:00:00.000Z",
  });
  assert.match(q.text, /\$5::timestamptz/);
  assert.deepEqual(q.values, [1, 2, 3, 4, "2026-06-01T00:00:00.000Z"]);
});

test("bbox + since + pointId preserve sequential parameter indexes", () => {
  const q = buildPointEventsQuery({
    bbox: { minLat: 1, maxLat: 2, minLng: 3, maxLng: 4 },
    since: "2026-06-01T00:00:00.000Z",
    pointId: "point-1",
  });
  assert.match(q.text, /point_id = \$6/i);
  assert.deepEqual(q.values, [1, 2, 3, 4, "2026-06-01T00:00:00.000Z", "point-1"]);
});

test("empty filter object behaves like no filter", () => {
  const q = buildPointEventsQuery({});
  assert.doesNotMatch(q.text, /where/i);
  assert.deepEqual(q.values, []);
});

test("ignores non-finite bbox values (no injection of NaN bounds)", () => {
  const q = buildPointEventsQuery({ bbox: { minLat: NaN, maxLat: 2, minLng: 3, maxLng: 4 } });
  assert.doesNotMatch(q.text, /where/i);
  assert.deepEqual(q.values, []);
});
