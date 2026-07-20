-- supabase/migrations/20260720_platform_demo_urban_waste_douala.sql
-- Stage 3 demo org: "Urban Waste Mapping — Douala" on the real config engine.
-- Synthetic only. No HYSACAM branding, no prospect data, no partnership claim.
--
-- Idempotent: re-run safe via slug unique key.
-- Requires at least one user_profiles row (uses the earliest profile as owner).

DO $$
DECLARE
  v_owner_id text;
  v_org_id uuid;
  v_project_id uuid;
  v_schema_id uuid;
  v_schema jsonb := $schema$
{
  "recordTypes": [
    {
      "key": "waste_bin",
      "label": { "en": "Waste bin", "fr": "Bac à ordures" },
      "fields": [
        {
          "key": "condition",
          "label": { "en": "Condition", "fr": "État" },
          "type": "select",
          "required": true,
          "options": [
            { "value": "good", "label": { "en": "Good", "fr": "Bon" } },
            { "value": "damaged", "label": { "en": "Damaged", "fr": "Endommagé" } },
            { "value": "overflowing", "label": { "en": "Overflowing", "fr": "Débordant" } }
          ]
        },
        {
          "key": "capacity_liters",
          "label": { "en": "Capacity (L)", "fr": "Capacité (L)" },
          "type": "number",
          "required": false,
          "min": 50,
          "max": 5000
        },
        {
          "key": "notes",
          "label": { "en": "Notes", "fr": "Notes" },
          "type": "text",
          "required": false
        }
      ],
      "evidence": {
        "gpsRequired": true,
        "gpsAccuracyMeters": 50,
        "minPhotos": 1,
        "notesRequired": false
      }
    },
    {
      "key": "dumping_point",
      "label": { "en": "Dumping point", "fr": "Dépôt sauvage" },
      "fields": [
        {
          "key": "severity",
          "label": { "en": "Severity", "fr": "Gravité" },
          "type": "select",
          "required": true,
          "options": [
            { "value": "low", "label": { "en": "Low", "fr": "Faible" } },
            { "value": "medium", "label": { "en": "Medium", "fr": "Moyenne" } },
            { "value": "high", "label": { "en": "High", "fr": "Élevée" } }
          ]
        },
        {
          "key": "waste_type",
          "label": { "en": "Waste type", "fr": "Type de déchet" },
          "type": "select",
          "required": true,
          "options": [
            { "value": "household", "label": { "en": "Household", "fr": "Ménager" } },
            { "value": "construction", "label": { "en": "Construction", "fr": "Chantier" } },
            { "value": "mixed", "label": { "en": "Mixed", "fr": "Mixte" } }
          ]
        },
        {
          "key": "estimated_volume_m3",
          "label": { "en": "Est. volume (m³)", "fr": "Volume est. (m³)" },
          "type": "number",
          "required": false,
          "min": 0,
          "max": 500
        }
      ],
      "evidence": {
        "gpsRequired": true,
        "gpsAccuracyMeters": 50,
        "minPhotos": 2,
        "notesRequired": false
      }
    }
  ]
}
$schema$::jsonb;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.user_profiles
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'platform demo seed skipped: no user_profiles row';
    RETURN;
  END IF;

  INSERT INTO public.platform_organizations (name, slug, accent_color, settings, created_by)
  VALUES (
    'Urban Waste Mapping — Douala',
    'urban-waste-douala-demo',
    '#4c7c59',
    jsonb_build_object(
      'isDemo', true,
      'demoLabel', jsonb_build_object('en', 'Synthetic demo', 'fr', 'Démo synthétique'),
      'city', 'Douala',
      'country', 'CM'
    ),
    v_owner_id
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        accent_color = EXCLUDED.accent_color,
        settings = EXCLUDED.settings
  RETURNING id INTO v_org_id;

  INSERT INTO public.platform_organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_owner_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';

  SELECT id INTO v_project_id
  FROM public.platform_projects
  WHERE organization_id = v_org_id AND name = 'Douala Pilot Coverage'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO public.platform_projects (
      organization_id, name, status, created_by, coverage_scope, coverage_label
    )
    VALUES (
      v_org_id, 'Douala Pilot Coverage', 'active', v_owner_id, 'town', 'Douala'
    )
    RETURNING id INTO v_project_id;
  ELSE
    UPDATE public.platform_projects
    SET status = 'active',
        coverage_scope = COALESCE(coverage_scope, 'town'),
        coverage_label = COALESCE(coverage_label, 'Douala')
    WHERE id = v_project_id;
  END IF;

  -- Publish schema version 1 if none published yet.
  SELECT id INTO v_schema_id
  FROM public.platform_project_schema_versions
  WHERE project_id = v_project_id AND status = 'published'
  ORDER BY version DESC
  LIMIT 1;

  IF v_schema_id IS NULL THEN
    INSERT INTO public.platform_project_schema_versions (
      project_id, organization_id, version, status, definition, published_at, created_by
    )
    VALUES (
      v_project_id, v_org_id, 1, 'published', v_schema, now(), v_owner_id
    )
    RETURNING id INTO v_schema_id;
  END IF;

  -- Synthetic approved records around Douala (Akwa / Bonanjo / Deido).
  -- Skip if demo records already exist for this org.
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_records
    WHERE organization_id = v_org_id
      AND data ? 'demoSeed'
  ) THEN
    INSERT INTO public.platform_records (
      organization_id, project_id, schema_version_id, record_type_key,
      data, evidence, status, captured_by, idempotency_key, request_hash,
      capture_lat, capture_lng, reviewed_by, reviewed_at
    ) VALUES
    (
      v_org_id, v_project_id, v_schema_id, 'waste_bin',
      '{"condition":"overflowing","capacity_liters":240,"notes":"Near market entrance","demoSeed":true}'::jsonb,
      '{"gps":{"latitude":4.0511,"longitude":9.7085,"accuracyMeters":12},"photos":[],"capturedAt":"2026-07-15T09:12:00.000Z"}'::jsonb,
      'approved', v_owner_id, 'demo-waste-bin-001',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      4.0511, 9.7085, v_owner_id, now()
    ),
    (
      v_org_id, v_project_id, v_schema_id, 'waste_bin',
      '{"condition":"good","capacity_liters":1100,"notes":"Public square","demoSeed":true}'::jsonb,
      '{"gps":{"latitude":4.0485,"longitude":9.7042,"accuracyMeters":9},"photos":[],"capturedAt":"2026-07-15T10:05:00.000Z"}'::jsonb,
      'approved', v_owner_id, 'demo-waste-bin-002',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      4.0485, 9.7042, v_owner_id, now()
    ),
    (
      v_org_id, v_project_id, v_schema_id, 'dumping_point',
      '{"severity":"high","waste_type":"mixed","estimated_volume_m3":4.5,"demoSeed":true}'::jsonb,
      '{"gps":{"latitude":4.0612,"longitude":9.7121,"accuracyMeters":15},"photos":[],"capturedAt":"2026-07-16T08:40:00.000Z"}'::jsonb,
      'approved', v_owner_id, 'demo-dump-001',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      4.0612, 9.7121, v_owner_id, now()
    ),
    (
      v_org_id, v_project_id, v_schema_id, 'dumping_point',
      '{"severity":"medium","waste_type":"household","estimated_volume_m3":1.2,"demoSeed":true}'::jsonb,
      '{"gps":{"latitude":4.0550,"longitude":9.6998,"accuracyMeters":18},"photos":[],"capturedAt":"2026-07-16T11:22:00.000Z"}'::jsonb,
      'pending_review', v_owner_id, 'demo-dump-002',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      4.0550, 9.6998, NULL, NULL
    ),
    (
      v_org_id, v_project_id, v_schema_id, 'waste_bin',
      '{"condition":"damaged","capacity_liters":240,"notes":"Lid missing","demoSeed":true}'::jsonb,
      '{"gps":{"latitude":4.0438,"longitude":9.7155,"accuracyMeters":11},"photos":[],"capturedAt":"2026-07-17T14:18:00.000Z"}'::jsonb,
      'pending_review', v_owner_id, 'demo-waste-bin-003',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      4.0438, 9.7155, NULL, NULL
    );
  END IF;

  RAISE NOTICE 'platform demo seed ready: org=% project=% schema=%', v_org_id, v_project_id, v_schema_id;
END $$;
