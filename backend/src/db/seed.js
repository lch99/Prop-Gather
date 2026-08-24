// Seeds the database with representative demo content — enough of every
// resource for the frontend to exercise each page against a real API.
import { getDb, withTransaction } from './index.js'
import { hashPassword } from '../util/auth.js'
import { id } from '../util/ids.js'

const now = () => new Date().toISOString()

const projects = [
  { id: 'p1', name: 'The Lumina Residences', type: 'Condo', state: 'Selangor', city: 'Petaling Jaya', address: 'Jalan PJU 5, Kota Damansara', ownerCount: 312, activityLevel: 'High', units: 480, blocks: ['A', 'B', 'C'], floorsPerBlock: 30, latestThread: 'Lift in Block B keeps breaking down — anyone else?' },
  { id: 'p2', name: 'Sentosa Heights', type: 'Apartment', state: 'Selangor', city: 'Shah Alam', address: 'Persiaran Sukan, Seksyen 13', ownerCount: 198, activityLevel: 'Medium', units: 320, blocks: ['1', '2'], floorsPerBlock: 20, latestThread: 'Reminder: pre-register visitors in the app' },
  { id: 'p3', name: 'Taman Bukit Damai (G&G)', type: 'Landed G&G', state: 'Johor', city: 'Johor Bahru', address: 'Jalan Bukit Damai, Taman Mount Austin', ownerCount: 154, activityLevel: 'Medium', units: 210, blocks: [], floorsPerBlock: 0, latestThread: 'Petition: 24hr guard shift change — 87/100 signatures' },
  { id: 'p4', name: 'Vista Permai Tower', type: 'Condo', state: 'Penang', city: 'George Town', address: 'Jalan Sultan Ahmad Shah', ownerCount: 267, activityLevel: 'High', units: 400, blocks: ['North', 'South'], floorsPerBlock: 35, latestThread: 'Heads up: water disruption 14 June, 10am–4pm', activeOfferBanner: true },
  { id: 'p5', name: 'Casa Mutiara', type: 'Apartment', state: 'Wilayah Persekutuan', city: 'Kuala Lumpur', address: 'Jalan Kuchai Lama', ownerCount: 89, activityLevel: 'Low', units: 180, blocks: ['A'], floorsPerBlock: 25, latestThread: 'Recommended aircon contractor for unit servicing' },
  { id: 'p6', name: 'Eco Greenview Park Homes', type: 'Landed G&G', state: 'Selangor', city: 'Rawang', address: 'Jalan Eco Greenview 2', ownerCount: 121, activityLevel: 'Medium', units: 150, blocks: [], floorsPerBlock: 0, latestThread: 'Heads up: road resurfacing Phase 2 from 20 June' }
]

const vendors = [
  { id: 'v1', name: 'CoolBreeze Aircon Services', category: 'Aircon & Electrical', state: 'Selangor', districts: ['Petaling Jaya', 'Shah Alam', 'Subang Jaya'], tier: 'Standard', rating: 4.6, reviews: 38, ssmVerified: true, ownerRecommended: true, description: 'Aircon chemical wash, repair & installation. 10+ years serving Klang Valley condos.', offer: 'RM20 off chemical wash this week — mention PropGather.' },
  { id: 'v2', name: 'FreshAir Cooling Services', category: 'Aircon & Electrical', state: 'Wilayah Persekutuan', districts: ['Kuala Lumpur'], tier: 'Basic', rating: 4.3, reviews: 12, ssmVerified: true, ownerRecommended: false, description: 'Affordable aircon servicing for apartments and condos in KL.' },
  { id: 'v3', name: 'SecureGuard Property Management', category: 'Security Services', state: 'Johor', districts: ['Johor Bahru', 'Iskandar Puteri'], tier: 'Premium', rating: 4.8, reviews: 21, ssmVerified: true, ownerRecommended: true, description: 'Licensed security guard outsourcing for G&G townships and condominiums.', offer: 'Free security audit for new client projects this month.' },
  { id: 'v4', name: 'BrightFix Plumbing & Renovation', category: 'Plumbing & Renovation', state: 'Penang', districts: ['George Town', 'Bayan Lepas'], tier: 'Standard', rating: 4.5, reviews: 27, ssmVerified: true, ownerRecommended: true, description: 'Ceiling leak repair, waterproofing, and unit renovation specialists.', offer: 'Free leak inspection for Vista Permai residents this week.' },
  { id: 'v5', name: 'GreenScape Landscaping', category: 'Landscaping & Grounds', state: 'Selangor', districts: ['Rawang', 'Kuang', 'Petaling Jaya'], tier: 'Basic', rating: 4.1, reviews: 9, ssmVerified: true, ownerRecommended: false, description: 'Garden maintenance, tree trimming and turf care for townships.' },
  { id: 'v6', name: 'Klang Valley Legal Associates', category: 'Legal & JMB Advisory', state: 'Selangor', districts: ['Petaling Jaya', 'Shah Alam', 'Kuala Lumpur'], tier: 'Premium', rating: 4.9, reviews: 15, ssmVerified: true, ownerRecommended: true, description: 'JMB/MC governance and strata law advisory services.' }
]

const documents = {
  p1: [
    { id: 'doc1', title: 'House Rules & By-Laws (2025 revision)', category: 'By-Laws', uploadedBy: 'Farah I.', date: '2025-11-02' },
    { id: 'doc2', title: 'Renovation Guidelines (2026)', category: 'By-Laws', uploadedBy: 'Farah I.', date: '2026-06-01' },
    { id: 'doc3', title: 'Q1 2026 Community Meeting Minutes', category: 'Minutes', uploadedBy: 'Farah I.', date: '2026-04-15' },
    { id: 'doc4', title: 'Lift Maintenance Contract — Summary', category: 'Contracts', uploadedBy: 'Farah I.', date: '2026-02-20' }
  ],
  p2: [
    { id: 'doc5', title: 'Updated House Rules (2026)', category: 'By-Laws', uploadedBy: 'Nurul A.', date: '2026-06-02' },
    { id: 'doc6', title: 'House Rules', category: 'By-Laws', uploadedBy: 'Nurul A.', date: '2025-09-10' }
  ],
  p3: [{ id: 'doc7', title: 'RA Constitution', category: 'By-Laws', uploadedBy: 'Wong K.L.', date: '2024-01-15' }],
  p4: [{ id: 'doc8', title: 'Water Disruption Notice — 14 June', category: 'Circular', uploadedBy: 'Lee P.H.', date: '2026-06-11' }],
  p5: [
    { id: 'doc10', title: 'Casa Mutiara House Rules & Regulations', category: 'By-Laws', uploadedBy: 'Kevin T.', date: '2025-06-01' },
    { id: 'doc11', title: 'Sinking Fund Statement Q1 2026', category: 'Financial', uploadedBy: 'Kevin T.', date: '2026-04-10' },
    { id: 'doc12', title: 'Lift Inspection Notice — June 2026', category: 'Circular', uploadedBy: 'Kevin T.', date: '2026-06-09' }
  ],
  p6: [{ id: 'doc9', title: 'Road Resurfacing Schedule Phase 2', category: 'Circular', uploadedBy: 'Zulkifli M.', date: '2026-06-05' }]
}

const references = {
  p1: [
    { id: 'ref-p1-1', type: 'Project Reference', title: 'The Lumina Residences — Project Brochure', description: 'Full sales brochure: unit layouts, built-up sizes, facilities deck and finishing schedule.', date: '2025-08-12', uploadedBy: 'Admin', progress: null },
    { id: 'ref-p1-2', type: 'Residence Reference', title: 'Type A & Type B Layout Plans', description: 'Dimensioned plans for the 3-bedroom (Type A) and 2-bedroom (Type B) units.', date: '2025-08-12', uploadedBy: 'Admin', progress: null },
    { id: 'ref-p1-3', type: 'Building Progress', title: 'Facade & Pool Deck Update — June 2026', description: 'Block A facade painting completed. Pool deck tiling underway; gym equipment installs next week.', date: '2026-06-15', uploadedBy: 'Admin', progress: 78 },
    { id: 'ref-p1-4', type: 'Building Progress', title: 'Lobby Upgrade — April 2026', description: 'New lobby flooring and reception counters installed across all three blocks.', date: '2026-04-03', uploadedBy: 'Admin', progress: 40 }
  ],
  p2: [
    { id: 'ref-p2-1', type: 'Project Reference', title: 'Sentosa Heights — Resident Information Pack', description: 'Overview of blocks, facilities and maintenance scope for residents.', date: '2025-09-01', uploadedBy: 'Admin', progress: null },
    { id: 'ref-p2-2', type: 'Building Progress', title: 'Covered Walkway Works — May 2026', description: 'New covered walkway between Block 1 and 2 underway. Expected completion end of July.', date: '2026-05-20', uploadedBy: 'Admin', progress: 55 }
  ],
  p4: [
    { id: 'ref-p4-1', type: 'Project Reference', title: 'Vista Permai Tower — Project Brochure', description: 'Seaview unit layouts, sky lounge and facilities overview.', date: '2025-07-22', uploadedBy: 'Admin', progress: null }
  ]
}

const feeTracker = {
  p1: { sinkingFund: 482300, monthlyFee: 280, previousYearFee: 250, feeIncreaseFlag: true, history: [['2026-01', 250], ['2026-02', 250], ['2026-03', 250], ['2026-04', 250], ['2026-05', 250], ['2026-06', 280]] },
  p2: { sinkingFund: 310500, monthlyFee: 220, previousYearFee: 220, feeIncreaseFlag: false, history: [['2026-01', 220], ['2026-02', 220], ['2026-03', 220], ['2026-04', 220], ['2026-05', 220], ['2026-06', 220]] },
  p3: { sinkingFund: 188500, monthlyFee: 150, previousYearFee: 130, feeIncreaseFlag: true, history: [['2026-01', 130], ['2026-02', 130], ['2026-03', 150], ['2026-04', 150], ['2026-05', 150], ['2026-06', 150]] },
  p4: { sinkingFund: 624000, monthlyFee: 300, previousYearFee: 300, feeIncreaseFlag: false, history: [['2026-01', 300], ['2026-02', 300], ['2026-03', 300], ['2026-04', 300], ['2026-05', 300], ['2026-06', 300]] },
  p5: { sinkingFund: 92400, monthlyFee: 200, previousYearFee: 200, feeIncreaseFlag: false, history: [['2026-01', 200], ['2026-02', 200], ['2026-03', 200], ['2026-04', 200], ['2026-05', 200], ['2026-06', 200]] },
  p6: { sinkingFund: 142800, monthlyFee: 120, previousYearFee: 100, feeIncreaseFlag: true, history: [['2026-01', 100], ['2026-02', 100], ['2026-03', 120], ['2026-04', 120], ['2026-05', 120], ['2026-06', 120]] }
}

const feePayments = {
  p1: [['2026-01', 250, 'Paid'], ['2026-02', 250, 'Paid'], ['2026-03', 250, 'Paid'], ['2026-04', 250, 'Paid'], ['2026-05', 250, 'Paid'], ['2026-06', 280, 'Pending']],
  p2: [['2026-05', 220, 'Paid'], ['2026-06', 220, 'Paid']],
  p3: [['2026-01', 130, 'Paid'], ['2026-02', 130, 'Paid'], ['2026-03', 150, 'Paid'], ['2026-04', 150, 'Paid'], ['2026-05', 150, 'Paid'], ['2026-06', 150, 'Pending']],
  p4: [['2026-04', 300, 'Paid'], ['2026-05', 300, 'Paid'], ['2026-06', 300, 'Pending']],
  p5: [['2026-04', 200, 'Paid'], ['2026-05', 200, 'Paid'], ['2026-06', 200, 'Pending']],
  p6: [['2026-01', 100, 'Paid'], ['2026-02', 100, 'Paid'], ['2026-03', 120, 'Paid'], ['2026-04', 120, 'Paid'], ['2026-05', 120, 'Paid'], ['2026-06', 120, 'Pending']]
}

// Demo residents: one verified "author" account per project so seeded forum
// threads / chat / petitions / defects have a real user to belong to.
const demoResidents = [
  { id: 'u_resident', name: 'Alex Lim', email: 'resident@propgather.com', password: 'resident123', projectId: 'p1', tier: 'Owner', unit: 'B-21-03' },
  { id: 'u_tanw', name: 'Tan W.', email: 'tan.w@example.com', password: 'password123', projectId: 'p1', tier: 'Owner', unit: 'B-21-03' },
  { id: 'u_nurula', name: 'Nurul A.', email: 'nurul.a@example.com', password: 'password123', projectId: 'p2', tier: 'Owner', unit: '1-10-03' },
  { id: 'u_wongkl', name: 'Wong K.L.', email: 'wong.kl@example.com', password: 'password123', projectId: 'p3', tier: 'House Owner', unit: 'No. 12' },
  { id: 'u_leeph', name: 'Lee P.H.', email: 'lee.ph@example.com', password: 'password123', projectId: 'p4', tier: 'Owner', unit: 'North-10-05' },
  { id: 'u_daniel', name: 'Daniel O.', email: 'daniel.o@example.com', password: 'password123', projectId: 'p5', tier: 'Owner', unit: 'A-09-04' },
  { id: 'u_suresh', name: 'Suresh K.', email: 'suresh.k@example.com', password: 'password123', projectId: 'p6', tier: 'House Owner', unit: 'No. 14' }
]

const forumThreads = {
  p1: [
    { id: 'f1-2', category: 'Building Management', title: 'Reminder: renovation hours & contractor registration', author: 'u_tanw', pinned: true, replies: 6, createdAt: '2026-06-01T08:00:00+08:00', body: 'Sharing a reminder from the lobby notice: renovation works are permitted 9am–6pm on weekdays only. Please register your contractors with security before they start.' },
    { id: 'f1-1', category: 'Defects & Repairs', title: 'Lift in Block B keeps breaking down — anyone else?', author: 'u_tanw', pinned: false, replies: 11, createdAt: '2026-06-10T09:12:00+08:00', body: 'Lift 2 in Block B has broken down 3 times this month. Anyone on higher floors facing the same? Want to log this as a shared defect.' }
  ],
  p2: [
    { id: 'f2-1', category: 'Building Management', title: 'Reminder: pre-register visitors in the app', author: 'u_nurula', pinned: true, replies: 3, createdAt: '2026-06-02T10:00:00+08:00', body: 'Friendly reminder that you can pre-register your visitors in the app to skip the guardhouse queue — it really helps during the evening peak.' }
  ],
  p3: [
    { id: 'f3-1', category: 'Building Management', title: 'Petition: 24hr guard shift change — 87/100 signatures', author: 'u_wongkl', pinned: false, replies: 22, createdAt: '2026-06-06T12:00:00+08:00', body: 'We are close to our signature target — see Tools > Petitions to sign if you have not already.' }
  ],
  p4: [
    { id: 'f4-1', category: 'Building Management', title: 'Heads up: water disruption 14 June, 10am–4pm', author: 'u_leeph', pinned: true, replies: 7, createdAt: '2026-06-11T08:00:00+08:00', body: 'Sharing the notice from the lobby — scheduled maintenance will affect water supply on 14 June from 10am to 4pm. Please store water in advance.' }
  ],
  p5: [
    { id: 'f5-1', category: 'Contractors & Services', title: 'Recommended aircon contractor for unit servicing', author: 'u_daniel', pinned: false, replies: 3, createdAt: '2026-06-03T16:40:00+08:00', body: 'Used FreshAir Cooling Services last month, quick and reasonably priced. Worth checking the vendor directory.' }
  ],
  p6: [
    { id: 'f6-1', category: 'Building Management', title: 'Heads up: road resurfacing Phase 2 from 20 June', author: 'u_suresh', pinned: true, replies: 2, createdAt: '2026-06-05T09:00:00+08:00', body: 'Sharing from the notice board — Phase 2 road resurfacing begins 20 June. Expect temporary access restrictions on Jalan Eco Greenview 2 and 3.' }
  ]
}

const threadUpvotes = { 'f1-1': 24, 'f1-2': 41, 'f2-1': 29, 'f3-1': 51, 'f4-1': 38, 'f5-1': 9, 'f6-1': 17 }

const petitions = {
  p1: [{ id: 'pet1-1', title: 'Replace Block B Lift 2 (chronic breakdowns)', description: 'We request the JMB to engage a new lift maintenance contractor for Block B Lift 2, which has broken down 5 times in 2 months.', target: 100, signatures: 64, author: 'u_tanw', createdAt: '2026-06-10' }],
  p2: [{ id: 'pet2-1', title: 'Replace Gym Equipment (Treadmill & Rowing Machine)', description: 'Request JMC to budget for replacement of treadmill #2 and the broken rowing machine in the gym. Both have been out of order repeatedly in the past year.', target: 80, signatures: 53, author: 'u_nurula', createdAt: '2026-06-07' }],
  p3: [{ id: 'pet3-1', title: '24-hour guard shift change at Main Gate', description: 'Petition to JMC to change the guard shift schedule so that the main gate has continuous coverage during 6-8am shift change.', target: 100, signatures: 87, author: 'u_wongkl', createdAt: '2026-06-06' }],
  p4: [{ id: 'pet4-1', title: 'Emergency waterproofing works — South Tower Level 12', description: 'Request JMB to engage a certified waterproofing contractor immediately for South Tower Level 12, where 4 units have reported ceiling leaks after recent heavy rain.', target: 60, signatures: 47, author: 'u_leeph', createdAt: '2026-06-10' }],
  p5: [{ id: 'pet5-1', title: 'Strict enforcement of reserved parking bays', description: 'Petition for RA to issue clamping notices to residents and visitors who park in reserved bays without authorization. Parking violations have increased significantly.', target: 60, signatures: 41, author: 'u_daniel', createdAt: '2026-06-05' }],
  p6: [{ id: 'pet6-1', title: 'Add second security guard during 6pm–10pm peak hours', description: 'Request RA to increase security coverage at the main gate from 6pm to 10pm daily. Delivery riders and visitors are causing long queues during this period.', target: 70, signatures: 38, author: 'u_suresh', createdAt: '2026-06-08' }]
}

const polls = {
  p1: [{ id: 'poll1-1', question: 'Should we install CCTV cameras at the playground area?', options: [['a', 'Yes, install CCTV', 142], ['b', 'No, not necessary', 38], ['c', 'Need more info first', 21]], expiresAt: '2026-06-20' }],
  p2: [{ id: 'poll2-1', question: 'Should we hire a new security company?', options: [['a', 'Yes', 76], ['b', 'No', 54]], expiresAt: '2026-06-18' }],
  p3: [{ id: 'poll3-1', question: 'Do you support upgrading street lights to LED along all internal roads?', options: [['a', 'Yes, upgrade all', 89], ['b', 'Priority roads only', 22], ['c', 'Not necessary', 7]], expiresAt: '2026-06-28' }],
  p4: [{ id: 'poll4-1', question: 'Should swimming pool operating hours be extended to 10pm on weekends?', options: [['a', 'Yes, extend to 10pm', 134], ['b', 'Keep current (9pm)', 67], ['c', 'No preference', 19]], expiresAt: '2026-06-25' }],
  p5: [{ id: 'poll5-1', question: 'Should we introduce mandatory visitor pre-registration via the app?', options: [['a', 'Yes, mandatory', 48], ['b', 'Optional only', 23], ['c', 'Not needed', 9]], expiresAt: '2026-06-30' }],
  p6: [{ id: 'poll6-1', question: "Should RA allocate RM8,000 from reserves to upgrade the children's playground equipment?", options: [['a', 'Yes, approve budget', 72], ['b', 'Yes but lower (RM5k)', 28], ['c', 'Defer to next year', 11]], expiresAt: '2026-06-30' }]
}

const defects = {
  p1: [
    { id: 'd1-1', title: 'Lift 2 (Block B) frequent breakdowns', block: 'B', floorRange: 'All floors', unit: 'B-21-03', category: 'Lift', status: 'In Progress', author: 'u_tanw', reportedAt: '2026-06-10', matchingUnits: 14, description: 'Lift stops between floors, doors fail to open. Happened 5 times in 2 months.' },
    { id: 'd1-3', title: 'Gym treadmill out of order', block: '-', floorRange: 'Facilities Level', unit: '-', category: 'Facilities', status: 'Resolved', author: 'u_tanw', reportedAt: '2026-05-28', matchingUnits: 1, description: 'Treadmill #2 motor replaced, back in service.' }
  ],
  p2: [{ id: 'd2-1', title: 'Gym treadmill #2 not working', block: '2', floorRange: 'Gym Level', unit: '2-15-07', category: 'Facilities', status: 'Open', author: 'u_nurula', reportedAt: '2026-06-07', matchingUnits: 3, description: 'Treadmill 2 belt slipping, unsafe to use.' }],
  p3: [{ id: 'd3-2', title: 'Pothole at T-junction near No. 60', block: '-', floorRange: '-', unit: 'No. 45', category: 'Roads & Infrastructure', status: 'Open', author: 'u_wongkl', reportedAt: '2026-06-11', matchingUnits: 12, description: 'Large pothole developed after heavy rain. Risk of vehicle and motorcycle damage.' }],
  p4: [{ id: 'd4-1', title: 'Ceiling leaks, South Tower Level 12', block: 'South', floorRange: '12', unit: 'South-12-09', category: 'Waterproofing', status: 'Acknowledged', author: 'u_leeph', reportedAt: '2026-06-09', matchingUnits: 4, description: 'Ceiling leak after heavy rain, affecting units 12-08 to 12-11.' }],
  p5: [{ id: 'd5-2', title: 'Intercom system down — multiple units Block A', block: 'A', floorRange: 'All floors', unit: 'A-09-04', category: 'Electrical', status: 'Acknowledged', author: 'u_daniel', reportedAt: '2026-06-11', matchingUnits: 9, description: 'Intercom handsets in multiple units not receiving calls from lobby panel.' }],
  p6: [{ id: 'd6-1', title: 'Boom gate stuck — main entrance', block: '-', floorRange: '-', unit: '-', category: 'Security', status: 'In Progress', author: 'u_suresh', reportedAt: '2026-06-10', matchingUnits: 1, description: 'Boom gate arm gets stuck in raised position — manually operated by guards. Motor appears faulty.' }]
}

// One multi-row INSERT per table instead of one round trip per row.
//
// This seed writes ~1,600 rows. Unbatched that is ~1,600 network round trips —
// six seconds per seed, and the test suite reseeds before every test, which put
// a full run at around half an hour. Batched, the same work is ~20 round trips.
//
// Chunked because one statement's placeholders and packet size are both bounded
// (max_allowed_packet, default 64MB, and mysql2's own limits).
async function insertRows(tx, table, columns, rows, { ignore = false } = {}) {
  if (!rows.length) return
  const CHUNK = 200
  const cols = columns.map(c => `\`${c}\``).join(', ')
  const tuple = `(${columns.map(() => '?').join(', ')})`
  const verb = ignore ? 'INSERT IGNORE' : 'INSERT'

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    await tx.allDynamic(
      `${verb} INTO \`${table}\` (${cols}) VALUES ${slice.map(() => tuple).join(', ')}`,
      slice.flat()
    )
  }
}

export async function seed() {
  const db = getDb()
  // "Has the demo data already been loaded?", not "are there any projects?".
  // Migration 0006 inserts the real-community catalogue, and it runs before this
  // (both at boot in ../index.js and in the `npm run seed` entrypoint below), so
  // a projects-count guard would see those rows on a brand new database and skip
  // the whole seed — no admin account, no vendors, no demo residents. The demo
  // admin is the row that actually distinguishes a seeded database.
  const already = await db.get("SELECT id FROM users WHERE id = 'u_admin'")
  if (already) return

  await withTransaction(async (tx) => {
    await insertRows(tx, 'projects',
      ['id', 'name', 'type', 'state', 'city', 'address', 'owner_count', 'activity_level', 'units', 'blocks', 'floors_per_block', 'latest_thread', 'active_offer_banner'],
      projects.map(p => [p.id, p.name, p.type, p.state, p.city, p.address, p.ownerCount, p.activityLevel, p.units, JSON.stringify(p.blocks), p.floorsPerBlock, p.latestThread ?? null, p.activeOfferBanner ? 1 : 0]))

    await insertRows(tx, 'vendors',
      ['id', 'name', 'category', 'state', 'districts', 'tier', 'rating', 'reviews', 'ssm_verified', 'owner_recommended', 'description', 'offer'],
      vendors.map(v => [v.id, v.name, v.category, v.state, JSON.stringify(v.districts), v.tier, v.rating, v.reviews, v.ssmVerified ? 1 : 0, v.ownerRecommended ? 1 : 0, v.description, v.offer || null]))

    await insertRows(tx, 'documents',
      ['id', 'project_id', 'title', 'category', 'uploaded_by', 'date'],
      Object.entries(documents).flatMap(([projectId, list]) => list.map(d => [d.id, projectId, d.title, d.category, d.uploadedBy, d.date])))

    await insertRows(tx, 'references_',
      ['id', 'project_id', 'type', 'title', 'description', 'date', 'uploaded_by', 'progress', 'attachments'],
      Object.entries(references).flatMap(([projectId, list]) => list.map(r => [r.id, projectId, r.type, r.title, r.description, r.date, r.uploadedBy, r.progress ?? null, '[]'])))

    await insertRows(tx, 'fee_tracker',
      ['project_id', 'sinking_fund', 'monthly_fee', 'previous_year_fee', 'fee_increase_flag'],
      Object.entries(feeTracker).map(([projectId, fee]) => [projectId, fee.sinkingFund, fee.monthlyFee, fee.previousYearFee, fee.feeIncreaseFlag ? 1 : 0]))

    await insertRows(tx, 'fee_history',
      ['project_id', 'month', 'amount'],
      Object.entries(feeTracker).flatMap(([projectId, fee]) => fee.history.map(([month, amount]) => [projectId, month, amount])))

    await insertRows(tx, 'users',
      ['id', 'name', 'email', 'password_hash', 'role', 'created_at'],
      [
        ['u_admin', 'Platform Admin', 'admin@propgather.com', hashPassword('admin123'), 'admin', now()],
        ...demoResidents.map(r => [r.id, r.name, r.email, hashPassword(r.password), 'resident', now()])
      ])

    await insertRows(tx, 'community_memberships',
      ['id', 'user_id', 'project_id', 'tier', 'unit', 'verified_at'],
      demoResidents.map(r => [id('mem'), r.id, r.projectId, r.tier, r.unit, '2026-03-15']))

    // fee payments for the seeded members of each project
    await insertRows(tx, 'fee_payments',
      ['project_id', 'user_id', 'month', 'amount', 'status'],
      demoResidents.flatMap(r => (feePayments[r.projectId] || []).map(([month, amount, status]) => [r.projectId, r.id, month, amount, status])),
      { ignore: true })

    await insertRows(tx, 'forum_threads',
      ['id', 'project_id', 'category', 'title', 'body', 'author_user_id', 'pinned', 'replies', 'attachments', 'created_at'],
      Object.entries(forumThreads).flatMap(([projectId, list]) =>
        list.map(t => [t.id, projectId, t.category, t.title, t.body, t.author, t.pinned ? 1 : 0, t.replies, '[]', t.createdAt])))

    // Fabricate distinct "voter" rows so the seeded upvote count matches the
    // original demo numbers without a real per-user identity per vote.
    await insertRows(tx, 'forum_upvotes', ['thread_id', 'user_id'],
      Object.values(forumThreads).flat().flatMap(t =>
        Array.from({ length: threadUpvotes[t.id] || 0 }, (_, i) => [t.id, `seed_voter_${t.id}_${i}`])),
      { ignore: true })

    await insertRows(tx, 'petitions',
      ['id', 'project_id', 'title', 'description', 'target', 'created_by_user_id', 'created_at'],
      Object.entries(petitions).flatMap(([projectId, list]) =>
        list.map(p => [p.id, projectId, p.title, p.description, p.target, p.author, p.createdAt])))

    await insertRows(tx, 'petition_signatures', ['petition_id', 'user_id'],
      Object.values(petitions).flat().flatMap(p =>
        Array.from({ length: p.signatures }, (_, i) => [p.id, `seed_signer_${p.id}_${i}`])),
      { ignore: true })

    await insertRows(tx, 'polls',
      ['id', 'project_id', 'question', 'expires_at'],
      Object.entries(polls).flatMap(([projectId, list]) => list.map(p => [p.id, projectId, p.question, p.expiresAt ?? null])))

    await insertRows(tx, 'poll_options',
      ['id', 'poll_id', 'label', 'position'],
      Object.values(polls).flat().flatMap(p =>
        p.options.map(([optId, label], idx) => [`${p.id}-${optId}`, p.id, label, idx])))

    await insertRows(tx, 'poll_votes', ['poll_id', 'user_id', 'option_id'],
      Object.values(polls).flat().flatMap(p =>
        p.options.flatMap(([optId, , votes]) => {
          const optionId = `${p.id}-${optId}`
          return Array.from({ length: votes }, (_, i) => [p.id, `seed_voter_${optionId}_${i}`, optionId])
        })),
      { ignore: true })

    await insertRows(tx, 'defects',
      ['id', 'project_id', 'title', 'block', 'floor_range', 'unit', 'category', 'status', 'reported_by_user_id', 'reported_at', 'matching_units', 'description'],
      Object.entries(defects).flatMap(([projectId, list]) =>
        list.map(d => [d.id, projectId, d.title, d.block, d.floorRange, d.unit, d.category, d.status, d.author, d.reportedAt, d.matchingUnits, d.description])))
  })

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log('Database seeded.')
  }
}

// Allow running directly: `node src/db/seed.js`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const { runMigrations } = await import('./migrate.js')
  const { closeDb } = await import('./index.js')
  await runMigrations()
  await seed()
  await closeDb()
}
