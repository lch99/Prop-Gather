-- A starter catalogue of well-known Malaysian developments.
--
-- Why a migration and not seed.js: seed.js is demo data, gated behind
-- SEED_DEMO_DATA and skipped on a production database on purpose. These are real
-- developments, and the catalogue is the one thing that has to exist in
-- production before anyone can use the platform — a resident cannot submit an
-- ownership application until their community is listed, and the alternative is
-- POST /api/community-requests plus an admin creating every building by hand. So
-- they ship with the schema.
--
-- Because these rows are visible to real residents, every field that would be a
-- guess is left empty rather than filled with a plausible-looking number:
--
--   * owner_count 0 and activity_level 'Low' — nobody has verified into these
--     yet, and the Discover card renders "0 verified residents" honestly.
--   * latest_thread NULL — DiscoverPage falls back to "New community — no posts
--     yet." for a community with no threads.
--   * units / blocks / floors_per_block left at 0 / [] / 0. Real unit counts and
--     block names are not something to invent under a real building's name. The
--     defect form's block dropdown already falls back to "-" for an empty list.
--     Note there is no PATCH /api/projects, so correcting these later means
--     another migration.
--
-- `type` is free text (see the createSchema comment in ../../routes/projects.js),
-- so 'Serviced Apartment' and 'Township' are new labels here; chipColor() in the
-- frontend hashes any label to a WCAG-AA colour pair, and both the Discover and
-- Admin type/state filters are derived from the data, so they pick these up on
-- their own.
--
-- INSERT IGNORE on the primary key makes this re-runnable: a file that fails
-- partway is retried from the top on the next boot (see ../migrate.js). The ids
-- are hand-written slugs, which cannot collide with the `p_<12 chars>` that
-- id('p') generates for admin-created communities.

INSERT IGNORE INTO projects
  (id, name, type, state, city, address, owner_count, activity_level, units, blocks, floors_per_block, latest_thread, active_offer_banner)
VALUES
  -- Kuala Lumpur
  ('p_desa_parkcity',       'Desa ParkCity',                    'Township',           'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Residen, Desa ParkCity',                   0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_verve_mont_kiara',    'Verve Suites Mont Kiara',          'Condo',              'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Kiara 5, Mont Kiara',                      0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_the_troika',          'The Troika',                       'Condo',              'Wilayah Persekutuan', 'Kuala Lumpur',    'Persiaran KLCC',                                 0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_binjai_on_the_park',  'Binjai on the Park',               'Condo',              'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Binjai, KLCC',                             0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_pavilion_residences', 'Pavilion Residences',              'Serviced Apartment', 'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Raja Chulan, Bukit Bintang',               0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_vertica_bangsar_s',   'Vertica Residensi, Bangsar South', 'Condo',              'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Kerinchi, Bangsar South',                  0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_setia_sky_res',       'Setia Sky Residences',             'Condo',              'Wilayah Persekutuan', 'Kuala Lumpur',    'Jalan Tun Razak',                                0, 'Low', 0, '[]', 0, NULL, 0),

  -- Selangor
  ('p_setia_alam',          'Setia Alam',                       'Township',           'Selangor',            'Shah Alam',       'Persiaran Setia Alam, Seksyen U13',              0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_bandar_utama',        'Bandar Utama',                     'Township',           'Selangor',            'Petaling Jaya',   'Jalan Bandar Utama',                             0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_tropicana_golf',      'Tropicana Golf & Country Resort',  'Landed G&G',         'Selangor',            'Petaling Jaya',   'Jalan Tropicana Utama',                          0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_kota_kemuning',       'Kota Kemuning',                    'Township',           'Selangor',            'Shah Alam',       'Jalan Kota Kemuning, Seksyen 31',                0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_sunway_south_quay',   'Sunway South Quay',                'Condo',              'Selangor',            'Subang Jaya',     'Jalan Lagoon Selatan, Bandar Sunway',            0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_eco_sanctuary',       'Eco Sanctuary',                    'Landed G&G',         'Selangor',            'Kuala Langat',    'Persiaran Eco Sanctuary, Telok Panglima Garang', 0, 'Low', 0, '[]', 0, NULL, 0),

  -- Penang
  ('p_gurney_paragon',      'Gurney Paragon Residences',        'Condo',              'Penang',              'George Town',     'Persiaran Gurney',                               0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_seri_tanjung_pinang', 'Seri Tanjung Pinang',              'Township',           'Penang',              'George Town',     'Jalan Seri Tanjung Pinang, Tanjung Tokong',      0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_the_light_coll',      'The Light Collection',             'Condo',              'Penang',              'George Town',     'The Light Waterfront, Gelugor',                  0, 'Low', 0, '[]', 0, NULL, 0),

  -- Johor
  ('p_horizon_hills',       'Horizon Hills',                    'Landed G&G',         'Johor',               'Iskandar Puteri', 'Jalan Horizon Perdana, Horizon Hills',           0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_teega_residences',    'Teega Residences, Puteri Harbour', 'Serviced Apartment', 'Johor',               'Iskandar Puteri', 'Jalan Puteri Harbour',                           0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_setia_eco_gardens',   'Setia Eco Gardens',                'Landed G&G',         'Johor',               'Johor Bahru',     'Jalan Eko Botani, Gelang Patah',                 0, 'Low', 0, '[]', 0, NULL, 0),

  -- Rest of Malaysia
  ('p_meru_valley',         'Meru Valley Residences',           'Landed G&G',         'Perak',               'Ipoh',            'Jalan Meru Valley, Meru',                        0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_seremban_2',          'Seremban 2',                       'Township',           'Negeri Sembilan',     'Seremban',        'Jalan S2, Seremban 2',                           0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_silverscape',         'Silverscape Residences',           'Condo',              'Melaka',              'Melaka',          'Jalan Melaka Raya, Hatten City',                 0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_jesselton_quay',      'Jesselton Quay',                   'Condo',              'Sabah',               'Kota Kinabalu',   'Jalan Haji Saman',                               0, 'Low', 0, '[]', 0, NULL, 0),
  ('p_riverine_emas',       'Riverine Emas',                    'Condo',              'Sarawak',             'Kuching',         'Jalan Petanak',                                  0, 'Low', 0, '[]', 0, NULL, 0);
