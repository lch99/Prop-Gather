// Demo seed data — mirrors backend/src/data.js exactly.
// api.js deep-clones this at startup so mutations reset on page refresh.

export const projects = [
  {
    id: 'p1', name: 'The Lumina Residences', type: 'Condo',
    state: 'Selangor', city: 'Petaling Jaya', address: 'Jalan PJU 5, Kota Damansara',
    ownerCount: 312, activityLevel: 'High', units: 480, blocks: ['A', 'B', 'C'], floorsPerBlock: 30,
    latestThread: 'Lift in Block B keeps breaking down — anyone else?'
  },
  {
    id: 'p2', name: 'Sentosa Heights', type: 'Apartment',
    state: 'Selangor', city: 'Shah Alam', address: 'Persiaran Sukan, Seksyen 13',
    ownerCount: 198, activityLevel: 'Medium', units: 320, blocks: ['1', '2'], floorsPerBlock: 20,
    latestThread: 'Reminder: pre-register visitors in the app'
  },
  {
    id: 'p3', name: 'Taman Bukit Damai (G&G)', type: 'Landed G&G',
    state: 'Johor', city: 'Johor Bahru', address: 'Jalan Bukit Damai, Taman Mount Austin',
    ownerCount: 154, activityLevel: 'Medium', units: 210, blocks: [], floorsPerBlock: 0,
    latestThread: 'Petition: 24hr guard shift change — 87/100 signatures'
  },
  {
    id: 'p4', name: 'Vista Permai Tower', type: 'Condo',
    state: 'Penang', city: 'George Town', address: 'Jalan Sultan Ahmad Shah',
    ownerCount: 267, activityLevel: 'High', units: 400, blocks: ['North', 'South'], floorsPerBlock: 35,
    latestThread: 'Heads up: water disruption 14 June, 10am–4pm', activeOfferBanner: true
  },
  {
    id: 'p5', name: 'Casa Mutiara', type: 'Apartment',
    state: 'Wilayah Persekutuan', city: 'Kuala Lumpur', address: 'Jalan Kuchai Lama',
    ownerCount: 89, activityLevel: 'Low', units: 180, blocks: ['A'], floorsPerBlock: 25,
    latestThread: 'Recommended aircon contractor for unit servicing'
  },
  {
    id: 'p6', name: 'Eco Greenview Park Homes', type: 'Landed G&G',
    state: 'Selangor', city: 'Rawang', address: 'Jalan Eco Greenview 2',
    ownerCount: 121, activityLevel: 'Medium', units: 150, blocks: [], floorsPerBlock: 0,
    latestThread: 'Heads up: road resurfacing Phase 2 from 20 June'
  }
]

export const forumThreads = {
  p1: [
    { id: 'f1-1', category: 'Defects & Repairs', title: 'Lift in Block B keeps breaking down — anyone else?', author: { name: 'Tan W.', unit: 'B-21-03', tier: 'Owner', verified: true }, pinned: false, upvotes: 24, replies: 11, createdAt: '2026-06-10T09:12:00+08:00', body: 'Lift 2 in Block B has broken down 3 times this month. Anyone on higher floors facing the same? Want to log this as a shared defect.' },
    { id: 'f1-2', category: 'Building Management', title: 'Reminder: renovation hours & contractor registration', author: { name: 'Farah I.', unit: 'B-08-02', tier: 'Owner', verified: true }, pinned: true, upvotes: 41, replies: 6, createdAt: '2026-06-01T08:00:00+08:00', body: 'Sharing a reminder from the lobby notice: renovation works are permitted 9am–6pm on weekdays only. Please register your contractors with security before they start.' },
    { id: 'f1-3', category: 'Contractors & Services', title: 'Aircon servicing — anyone used CoolBreeze Aircon?', author: { name: 'Priya S.', unit: 'A-12-05', tier: 'Owner', verified: true }, pinned: false, upvotes: 18, replies: 9, createdAt: '2026-06-08T19:45:00+08:00', body: 'Looking for a reliable aircon servicing company. Saw CoolBreeze Aircon in the vendor directory — anyone tried them?' },
    { id: 'f1-4', category: 'Maintenance Fees', title: 'Maintenance fee increase from July — breakdown?', author: { name: 'Marcus L.', unit: 'C-08-11', tier: 'Owner', verified: true }, pinned: false, upvotes: 32, replies: 14, createdAt: '2026-06-05T14:20:00+08:00', body: "Noticed the fee tracker is flagging an increase for July. Does anyone have details on what's driving it? Would be good to see a breakdown." },
    { id: 'f1-5', category: 'Security', title: 'Visitor registration at main gate is very slow during peak hours', author: { name: 'Aisyah R.', unit: 'A-05-02', tier: 'Owner', verified: true }, pinned: false, upvotes: 15, replies: 5, createdAt: '2026-06-09T18:02:00+08:00', body: 'Guardhouse queue at 6-8pm is getting long. Can we use the in-app visitor log feature to pre-register guests?' }
  ],
  p2: [
    { id: 'f2-1', category: 'Building Management', title: 'Reminder: pre-register visitors in the app', author: { name: 'Nurul A.', unit: '1-10-03', tier: 'Owner', verified: true }, pinned: true, upvotes: 29, replies: 3, createdAt: '2026-06-02T10:00:00+08:00', body: 'Friendly reminder that you can pre-register your visitors in the app to skip the guardhouse queue — it really helps during the evening peak.' },
    { id: 'f2-2', category: 'Facilities', title: 'Gym equipment — treadmill #2 not working', author: { name: 'Hafiz M.', unit: '2-15-07', tier: 'Owner', verified: true }, pinned: false, upvotes: 12, replies: 4, createdAt: '2026-06-07T07:30:00+08:00', body: 'Treadmill 2 on the gym level has been out of order for 2 weeks. Logged as a defect too.' }
  ],
  p3: [
    { id: 'f3-1', category: 'Building Management', title: 'Petition: 24hr guard shift change — 87/100 signatures', author: { name: 'Wong K.L.', unit: 'No. 12', tier: 'House Owner', verified: true }, pinned: false, upvotes: 51, replies: 22, createdAt: '2026-06-06T12:00:00+08:00', body: 'We are close to our signature target — see Tools > Petitions to sign if you have not already.' },
    { id: 'f3-2', category: 'General Discussion', title: 'Stray dogs near Jalan Bukit Damai 5 — safety concern', author: { name: 'Lim S.F.', unit: 'No. 45', tier: 'House Owner', verified: true }, pinned: false, upvotes: 20, replies: 8, createdAt: '2026-06-04T20:11:00+08:00', body: 'Several residents have reported stray dogs near the playground. Can we put in a request for animal control?' }
  ],
  p4: [
    { id: 'f4-1', category: 'Building Management', title: 'Heads up: water disruption 14 June, 10am–4pm', author: { name: 'Lee P.H.', unit: 'North-10-05', tier: 'Owner', verified: true }, pinned: true, upvotes: 38, replies: 7, createdAt: '2026-06-11T08:00:00+08:00', body: 'Sharing the notice from the lobby — scheduled maintenance will affect water supply on 14 June from 10am to 4pm. Please store water in advance.' },
    { id: 'f4-2', category: 'Defects & Repairs', title: 'Ceiling leak in South Tower units 12-08 to 12-11', author: { name: 'Chong Y.M.', unit: 'South-12-09', tier: 'Owner', verified: true }, pinned: false, upvotes: 27, replies: 10, createdAt: '2026-06-09T11:15:00+08:00', body: 'Multiple units on level 12 reporting ceiling leaks after the rain last week. Logged in defect tracker — please add yours if affected.' }
  ],
  p5: [
    { id: 'f5-1', category: 'Contractors & Services', title: 'Recommended aircon contractor for unit servicing', author: { name: 'Daniel O.', unit: 'A-09-04', tier: 'Owner', verified: true }, pinned: false, upvotes: 9, replies: 3, createdAt: '2026-06-03T16:40:00+08:00', body: 'Used FreshAir Cooling Services last month, quick and reasonably priced. Worth checking the vendor directory.' }
  ],
  p6: [
    { id: 'f6-1', category: 'Building Management', title: 'Heads up: road resurfacing Phase 2 from 20 June', author: { name: 'Suresh K.', unit: 'No. 14', tier: 'House Owner', verified: true }, pinned: true, upvotes: 17, replies: 2, createdAt: '2026-06-05T09:00:00+08:00', body: 'Sharing from the notice board — Phase 2 road resurfacing begins 20 June. Expect temporary access restrictions on Jalan Eco Greenview 2 and 3.' }
  ]
}

export const chatChannels = {
  p1: ['general', 'defects', 'announcements', 'facilities', 'renovation'],
  p2: ['general', 'defects', 'announcements', 'facilities', 'renovation'],
  p3: ['general', 'defects', 'announcements', 'facilities', 'renovation'],
  p4: ['general', 'defects', 'announcements', 'facilities', 'renovation'],
  p5: ['general', 'defects', 'announcements', 'facilities', 'renovation'],
  p6: ['general', 'defects', 'announcements', 'facilities', 'renovation']
}

export const chatMessages = {
  p1: {
    general: [
      { id: 'm1', sender: 'Tan W.', unit: 'B-21-03', tier: 'Owner', verified: true, text: 'Morning all! Anyone notice the lift in Block B is down again?', time: '08:42' },
      { id: 'm2', sender: 'Priya S.', unit: 'A-12-05', tier: 'Owner', verified: true, text: 'Yes, been like that since yesterday. Reported it in the forum too.', time: '08:45' },
      { id: 'm3', sender: 'Marcus L.', unit: 'C-08-11', tier: 'Owner', verified: true, text: 'Heard the technician is arriving this afternoon.', time: '09:01' }
    ],
    defects: [
      { id: 'm4', sender: 'Aisyah R.', unit: 'A-05-02', tier: 'Owner', verified: true, text: 'Logged a defect for the corridor light on A-5. Flickering for days.', time: '10:15' }
    ],
    announcements: [
      { id: 'm5', sender: 'Farah I.', unit: 'B-08-02', tier: 'Owner', verified: true, text: '📢 Sharing the building notice: water tank cleaning this Saturday 7am–12pm. Minor pressure drop expected.', time: '07:00' }
    ],
    facilities: [
      { id: 'm6', sender: 'Hafiz M.', unit: 'B-14-02', tier: 'Owner', verified: true, text: 'BBQ pit booked for Saturday evening, anyone else planning a function room booking that day?', time: '12:30' }
    ],
    renovation: [
      { id: 'm7', sender: 'Chong Y.M.', unit: 'C-19-07', tier: 'Owner', verified: true, text: 'Doing minor renovation next week, will inform security re: contractor access.', time: '15:10' }
    ]
  },
  p2: {
    general: [
      { id: 'p2m1', sender: 'Hafiz M.', unit: '2-15-07', tier: 'Owner', verified: true, text: 'Good morning! Is the gym open today? Notice says treadmill still being fixed?', time: '07:45' },
      { id: 'p2m2', sender: 'Nurul A.', unit: '1-10-03', tier: 'Owner', verified: true, text: 'Yes gym is open, only treadmill 2 is down. The others are fine.', time: '07:52' },
      { id: 'p2m3', sender: 'Siti K.', unit: '2-07-11', tier: 'Owner', verified: true, text: 'Anyone know when the updated by-laws will be uploaded to the Documents tab?', time: '08:30' },
      { id: 'p2m4', sender: 'Nurul A.', unit: '1-10-03', tier: 'Owner', verified: true, text: 'The updated by-laws are now on the Documents tab — worth a read when you have a moment.', time: '09:00' }
    ],
    defects: [
      { id: 'p2m5', sender: 'Hafiz M.', unit: '2-15-07', tier: 'Owner', verified: true, text: 'Logged defect for treadmill #2 — belt slipping. Please vote to escalate.', time: '09:15' },
      { id: 'p2m6', sender: 'Nurul A.', unit: '1-10-03', tier: 'Owner', verified: true, text: 'Water heater in Block 1 lobby bathroom also leaking. Should I log separately?', time: '11:40' }
    ],
    announcements: [
      { id: 'p2m7', sender: 'Siti K.', unit: '2-07-11', tier: 'Owner', verified: true, text: '📢 Sharing the notice: pest control on 25 June, 9am–1pm. Please keep your windows closed.', time: '08:00' }
    ],
    facilities: [
      { id: 'p2m8', sender: 'Siti K.', unit: '2-07-11', tier: 'Owner', verified: true, text: 'Booked the function room for Sunday, 2pm-6pm. Please avoid double-booking.', time: '14:20' }
    ],
    renovation: [
      { id: 'p2m9', sender: 'Nurul A.', unit: '1-10-03', tier: 'Owner', verified: true, text: 'Starting bathroom tiles replacement next Monday. Contractor has been registered with security.', time: '16:05' }
    ]
  },
  p3: {
    general: [
      { id: 'p3m1', sender: 'Wong K.L.', unit: 'No. 12', tier: 'House Owner', verified: true, text: 'Petition now at 87 signatures! Come on neighbours, we need 100. See the Tools tab.', time: '08:10' },
      { id: 'p3m2', sender: 'Lim S.F.', unit: 'No. 45', tier: 'House Owner', verified: true, text: 'Signed already! The 6am shift change with no overlap is really dangerous.', time: '08:22' },
      { id: 'p3m3', sender: 'Ahmad Z.', unit: 'No. 78', tier: 'House Owner', verified: true, text: 'Can we also raise the street lights on Jalan Bukit Damai 3? Half of them are out.', time: '09:45' },
      { id: 'p3m4', sender: 'Wong K.L.', unit: 'No. 12', tier: 'House Owner', verified: true, text: 'Update: a few of us have escalated the street lights to Majlis Bandaraya JB — they expect a fix by next week.', time: '10:00' }
    ],
    defects: [
      { id: 'p3m5', sender: 'Lim S.F.', unit: 'No. 45', tier: 'House Owner', verified: true, text: 'Auto gate sensor at main entrance acting up again — took 3 tries to open this morning.', time: '07:35' },
      { id: 'p3m6', sender: 'Wong K.L.', unit: 'No. 12', tier: 'House Owner', verified: true, text: 'Pothole at the T-junction near No. 60 is getting worse after the rain. Log it in defect tracker please.', time: '17:00' }
    ],
    announcements: [
      { id: 'p3m7', sender: 'Ahmad Z.', unit: 'No. 78', tier: 'House Owner', verified: true, text: '📢 Sharing the notice: road resurfacing Phase 2 begins 20 June. Expect closures on Jalan Bukit Damai 2 & 3 from 8am.', time: '07:00' }
    ],
    facilities: [
      { id: 'p3m8', sender: 'Ahmad Z.', unit: 'No. 78', tier: 'House Owner', verified: true, text: 'Clubhouse booking for our block gathering on Saturday — anyone else want to join?', time: '12:30' }
    ],
    renovation: [
      { id: 'p3m9', sender: 'Lim S.F.', unit: 'No. 45', tier: 'House Owner', verified: true, text: 'Doing roof repaint next week. Will park contractor van at the side road, not blocking gate.', time: '20:10' }
    ]
  },
  p4: {
    general: [
      { id: 'p4m1', sender: 'Chong Y.M.', unit: 'South-12-09', tier: 'Owner', verified: true, text: "Water storage ready for tomorrow's disruption. Everyone please prepare — 10am to 4pm.", time: '19:30' },
      { id: 'p4m2', sender: 'Lee P.H.', unit: 'North-10-05', tier: 'Owner', verified: true, text: 'Good reminder. The ceiling in South Tower level 12 is still an issue — any update on this?', time: '19:45' },
      { id: 'p4m3', sender: 'Chong Y.M.', unit: 'South-12-09', tier: 'Owner', verified: true, text: 'Update: BrightFix Plumbing will inspect South Tower level 12 this Friday 9am. Affected units should be contacted directly.', time: '20:00' },
      { id: 'p4m4', sender: 'Raju S.', unit: 'North-22-01', tier: 'Owner', verified: true, text: 'Is the swimming pool still open this week? Was closed last weekend for maintenance.', time: '09:00' }
    ],
    defects: [
      { id: 'p4m5', sender: 'Chong Y.M.', unit: 'South-12-09', tier: 'Owner', verified: true, text: 'Logged the ceiling leak defect — South 12-08 to 12-11 all affected. Please add your unit if same issue.', time: '09:20' },
      { id: 'p4m6', sender: 'Lee P.H.', unit: 'North-10-05', tier: 'Owner', verified: true, text: 'Also added: emergency staircase light on North Tower Level 10 not working.', time: '11:05' }
    ],
    announcements: [
      { id: 'p4m7', sender: 'Lee P.H.', unit: 'North-10-05', tier: 'Owner', verified: true, text: '📢 Reminder: water disruption 14 June, 10am–4pm. Pool will also be closed that day.', time: '07:00' }
    ],
    facilities: [
      { id: 'p4m8', sender: 'Raju S.', unit: 'North-22-01', tier: 'Owner', verified: true, text: 'Badminton court light #3 is dim. Anyone else noticed? Might need bulb replacement.', time: '21:00' }
    ],
    renovation: [
      { id: 'p4m9', sender: 'Lee P.H.', unit: 'North-10-05', tier: 'Owner', verified: true, text: "Waterproofing contractor coming Friday — same guy I used for my previous unit. He's in the community vendor directory.", time: '14:30' }
    ]
  },
  p5: {
    general: [
      { id: 'p5m1', sender: 'Daniel O.', unit: 'A-09-04', tier: 'Owner', verified: true, text: "Morning all! Anyone else having issues with the intercom system? Mine hasn't been working for 2 days.", time: '08:15' },
      { id: 'p5m2', sender: 'Fatimah H.', unit: 'A-15-07', tier: 'Owner', verified: true, text: "Same here! Unit A-15 also. I think it's a building-wide wiring issue.", time: '08:28' },
      { id: 'p5m3', sender: 'Kevin T.', unit: 'A-03-01', tier: 'Owner', verified: true, text: "Should log this as a defect. Also — aircon contractor from Daniel's post is great, used last month.", time: '09:10' }
    ],
    defects: [
      { id: 'p5m4', sender: 'Daniel O.', unit: 'A-09-04', tier: 'Owner', verified: true, text: 'Logged: Intercom system down Block A (multiple units). Please add your unit if affected.', time: '09:30' },
      { id: 'p5m5', sender: 'Fatimah H.', unit: 'A-15-07', tier: 'Owner', verified: true, text: 'Also logging: lobby CCTV camera at L1 entrance appears to be offline — no light indicator.', time: '10:00' }
    ],
    announcements: [
      { id: 'p5m6', sender: 'Kevin T.', unit: 'A-03-01', tier: 'Owner', verified: true, text: '📢 Sharing the notice: lift inspection this Thursday 8am–12pm. Lift stays operational but may be slow — thanks for your patience.', time: '07:00' }
    ],
    facilities: [
      { id: 'p5m7', sender: 'Kevin T.', unit: 'A-03-01', tier: 'Owner', verified: true, text: 'Swimming pool tiles are cracking near the ladder. Someone might slip — can we get this looked into?', time: '13:45' }
    ],
    renovation: [
      { id: 'p5m8', sender: 'Daniel O.', unit: 'A-09-04', tier: 'Owner', verified: true, text: 'Replacing kitchen cabinet — contractor will arrive 9am Saturday. Have notified security.', time: '18:20' }
    ]
  },
  p6: {
    general: [
      { id: 'p6m1', sender: 'Zulkifli M.', unit: 'No. 5', tier: 'House Owner', verified: true, text: 'Road resurfacing in Phase 2 area starts Monday. Please use the back road via Jalan Eco Greenview 4 temporarily.', time: '07:50' },
      { id: 'p6m2', sender: 'Lee T.K.', unit: 'No. 23', tier: 'House Owner', verified: true, text: 'Thanks for the heads up! Also — streetlight at the corner of No. 30 has been out for a week.', time: '08:05' },
      { id: 'p6m3', sender: 'Nora B.', unit: 'No. 67', tier: 'House Owner', verified: true, text: "Morning! Is there a poll about upgrading the kids' playground? I saw it mentioned on the notice board.", time: '09:00' },
      { id: 'p6m4', sender: 'Nora B.', unit: 'No. 67', tier: 'House Owner', verified: true, text: 'The playground upgrade poll is now live in Tools > Polls — please cast your vote by 30 June!', time: '09:15' }
    ],
    defects: [
      { id: 'p6m5', sender: 'Lee T.K.', unit: 'No. 23', tier: 'House Owner', verified: true, text: 'Logged: streetlight out near No. 30. Also the boom gate sensor keeps triggering false alarms at night.', time: '08:10' },
      { id: 'p6m6', sender: 'Zulkifli M.', unit: 'No. 5', tier: 'House Owner', verified: true, text: 'Confirmed — boom gate was stuck open for 1 hour last night. Security had to manually operate.', time: '08:20' }
    ],
    announcements: [
      { id: 'p6m7', sender: 'Zulkifli M.', unit: 'No. 5', tier: 'House Owner', verified: true, text: '📢 Sharing the notice: Phase 2 road resurfacing 20–24 June. Side road access via Jalan Eco Greenview 4 remains open.', time: '07:00' }
    ],
    facilities: [
      { id: 'p6m8', sender: 'Nora B.', unit: 'No. 67', tier: 'House Owner', verified: true, text: "Clubhouse booking for Saturday 4pm-8pm — neighbourhood kids' sports day. All welcome!", time: '11:00' }
    ],
    renovation: [
      { id: 'p6m9', sender: 'Lee T.K.', unit: 'No. 23', tier: 'House Owner', verified: true, text: 'Adding a car porch extension — done as per the renovation guidelines. Contractor starts Monday, should finish within 3 days.', time: '16:30' }
    ]
  }
}

export const vendors = [
  { id: 'v1', name: 'CoolBreeze Aircon Services', category: 'Aircon & Electrical', state: 'Selangor', districts: ['Petaling Jaya', 'Shah Alam', 'Subang Jaya'], tier: 'Standard', rating: 4.6, reviews: 38, ssmVerified: true, ownerRecommended: true, description: 'Aircon chemical wash, repair & installation. 10+ years serving Klang Valley condos.', offer: 'RM20 off chemical wash this week — mention PropGather.' },
  { id: 'v2', name: 'FreshAir Cooling Services', category: 'Aircon & Electrical', state: 'Wilayah Persekutuan', districts: ['Kuala Lumpur'], tier: 'Basic', rating: 4.3, reviews: 12, ssmVerified: true, ownerRecommended: false, description: 'Affordable aircon servicing for apartments and condos in KL.' },
  { id: 'v3', name: 'SecureGuard Property Management', category: 'Security Services', state: 'Johor', districts: ['Johor Bahru', 'Iskandar Puteri'], tier: 'Premium', rating: 4.8, reviews: 21, ssmVerified: true, ownerRecommended: true, description: 'Licensed security guard outsourcing for G&G townships and condominiums.', offer: 'Free security audit for new client projects this month.' },
  { id: 'v4', name: 'BrightFix Plumbing & Renovation', category: 'Plumbing & Renovation', state: 'Penang', districts: ['George Town', 'Bayan Lepas'], tier: 'Standard', rating: 4.5, reviews: 27, ssmVerified: true, ownerRecommended: true, description: 'Ceiling leak repair, waterproofing, and unit renovation specialists.', offer: 'Free leak inspection for Vista Permai residents this week.' },
  { id: 'v5', name: 'GreenScape Landscaping', category: 'Landscaping & Grounds', state: 'Selangor', districts: ['Rawang', 'Kuang', 'Petaling Jaya'], tier: 'Basic', rating: 4.1, reviews: 9, ssmVerified: true, ownerRecommended: false, description: 'Garden maintenance, tree trimming and turf care for townships.' },
  { id: 'v6', name: 'Klang Valley Legal Associates', category: 'Legal & JMB Advisory', state: 'Selangor', districts: ['Petaling Jaya', 'Shah Alam', 'Kuala Lumpur'], tier: 'Premium', rating: 4.9, reviews: 15, ssmVerified: true, ownerRecommended: true, description: 'JMB/MC governance and strata law advisory services.' }
]

export const petitions = {
  p1: [{ id: 'pet1-1', title: 'Replace Block B Lift 2 (chronic breakdowns)', description: 'We request the JMB to engage a new lift maintenance contractor for Block B Lift 2, which has broken down 5 times in 2 months.', target: 100, signatures: 64, createdBy: 'Tan W. (B-21-03)', createdAt: '2026-06-10', signedByMe: false }],
  p2: [{ id: 'pet2-1', title: 'Replace Gym Equipment (Treadmill & Rowing Machine)', description: 'Request JMC to budget for replacement of treadmill #2 and the broken rowing machine in the gym. Both have been out of order repeatedly in the past year.', target: 80, signatures: 53, createdBy: 'Hafiz M. (2-15-07)', createdAt: '2026-06-07', signedByMe: false }],
  p3: [{ id: 'pet3-1', title: '24-hour guard shift change at Main Gate', description: 'Petition to JMC to change the guard shift schedule so that the main gate has continuous coverage during 6-8am shift change.', target: 100, signatures: 87, createdBy: 'Wong K.L. (No. 12)', createdAt: '2026-06-06', signedByMe: false }],
  p4: [{ id: 'pet4-1', title: 'Emergency waterproofing works — South Tower Level 12', description: 'Request JMB to engage a certified waterproofing contractor immediately for South Tower Level 12, where 4 units have reported ceiling leaks after recent heavy rain.', target: 60, signatures: 47, createdBy: 'Chong Y.M. (South-12-09)', createdAt: '2026-06-10', signedByMe: false }],
  p5: [{ id: 'pet5-1', title: 'Strict enforcement of reserved parking bays', description: 'Petition for RA to issue clamping notices to residents and visitors who park in reserved bays without authorization. Parking violations have increased significantly.', target: 60, signatures: 41, createdBy: 'Kevin T. (A-03-01)', createdAt: '2026-06-05', signedByMe: false }],
  p6: [{ id: 'pet6-1', title: 'Add second security guard during 6pm–10pm peak hours', description: 'Request RA to increase security coverage at the main gate from 6pm to 10pm daily. Delivery riders and visitors are causing long queues during this period.', target: 70, signatures: 38, createdBy: 'Nora B. (No. 67)', createdAt: '2026-06-08', signedByMe: false }]
}

export const polls = {
  p1: [{ id: 'poll1-1', question: 'Should we install CCTV cameras at the playground area?', options: [{ id: 'a', label: 'Yes, install CCTV', votes: 142 }, { id: 'b', label: 'No, not necessary', votes: 38 }, { id: 'c', label: 'Need more info first', votes: 21 }], expiresAt: '2026-06-20', votedByMe: false }],
  p2: [{ id: 'poll2-1', question: 'Should we hire a new security company?', options: [{ id: 'a', label: 'Yes', votes: 76 }, { id: 'b', label: 'No', votes: 54 }], expiresAt: '2026-06-18', votedByMe: false }],
  p3: [{ id: 'poll3-1', question: 'Do you support upgrading street lights to LED along all internal roads?', options: [{ id: 'a', label: 'Yes, upgrade all', votes: 89 }, { id: 'b', label: 'Priority roads only', votes: 22 }, { id: 'c', label: 'Not necessary', votes: 7 }], expiresAt: '2026-06-28', votedByMe: false }],
  p4: [{ id: 'poll4-1', question: 'Should swimming pool operating hours be extended to 10pm on weekends?', options: [{ id: 'a', label: 'Yes, extend to 10pm', votes: 134 }, { id: 'b', label: 'Keep current (9pm)', votes: 67 }, { id: 'c', label: 'No preference', votes: 19 }], expiresAt: '2026-06-25', votedByMe: false }],
  p5: [{ id: 'poll5-1', question: 'Should we introduce mandatory visitor pre-registration via the app?', options: [{ id: 'a', label: 'Yes, mandatory', votes: 48 }, { id: 'b', label: 'Optional only', votes: 23 }, { id: 'c', label: 'Not needed', votes: 9 }], expiresAt: '2026-06-30', votedByMe: false }],
  p6: [{ id: 'poll6-1', question: "Should RA allocate RM8,000 from reserves to upgrade the children's playground equipment?", options: [{ id: 'a', label: 'Yes, approve budget', votes: 72 }, { id: 'b', label: 'Yes but lower (RM5k)', votes: 28 }, { id: 'c', label: 'Defer to next year', votes: 11 }], expiresAt: '2026-06-30', votedByMe: false }]
}

export const defects = {
  p1: [
    { id: 'd1-1', title: 'Lift 2 (Block B) frequent breakdowns', block: 'B', floorRange: 'All floors', unit: 'B-21-03', category: 'Lift', status: 'In Progress', reportedBy: 'Tan W.', reportedAt: '2026-06-10', matchingUnits: 14, description: 'Lift stops between floors, doors fail to open. Happened 5 times in 2 months.' },
    { id: 'd1-2', title: 'Corridor light flickering, Level 5 Block A', block: 'A', floorRange: '5', unit: 'A-05-02', category: 'Electrical', status: 'Acknowledged', reportedBy: 'Aisyah R.', reportedAt: '2026-06-09', matchingUnits: 2, description: 'Corridor light outside unit 05-02 and 05-04 flickering continuously.' },
    { id: 'd1-3', title: 'Gym treadmill out of order', block: '-', floorRange: 'Facilities Level', unit: '-', category: 'Facilities', status: 'Resolved', reportedBy: 'Hafiz M.', reportedAt: '2026-05-28', matchingUnits: 1, description: 'Treadmill #2 motor replaced, back in service.' }
  ],
  p2: [{ id: 'd2-1', title: 'Gym treadmill #2 not working', block: '2', floorRange: 'Gym Level', unit: '2-15-07', category: 'Facilities', status: 'Open', reportedBy: 'Hafiz M.', reportedAt: '2026-06-07', matchingUnits: 3, description: 'Treadmill 2 belt slipping, unsafe to use.' }],
  p3: [
    { id: 'd3-1', title: 'Main gate auto-sensor malfunction', block: '-', floorRange: '-', unit: 'No. 12', category: 'Security', status: 'In Progress', reportedBy: 'Lim S.F.', reportedAt: '2026-06-08', matchingUnits: 7, description: 'Auto-sensor at main entrance intermittently fails — gate requires multiple card taps to open.' },
    { id: 'd3-2', title: 'Pothole at T-junction near No. 60', block: '-', floorRange: '-', unit: 'No. 45', category: 'Roads & Infrastructure', status: 'Open', reportedBy: 'Wong K.L.', reportedAt: '2026-06-11', matchingUnits: 12, description: 'Large pothole developed after heavy rain. Risk of vehicle and motorcycle damage.' }
  ],
  p4: [{ id: 'd4-1', title: 'Ceiling leaks, South Tower Level 12', block: 'South', floorRange: '12', unit: 'South-12-09', category: 'Waterproofing', status: 'Acknowledged', reportedBy: 'Chong Y.M.', reportedAt: '2026-06-09', matchingUnits: 4, description: 'Ceiling leak after heavy rain, affecting units 12-08 to 12-11.' }],
  p5: [
    { id: 'd5-1', title: 'Lobby CCTV offline — Block A entrance', block: 'A', floorRange: 'Ground', unit: '-', category: 'Security', status: 'Open', reportedBy: 'Fatimah H.', reportedAt: '2026-06-10', matchingUnits: 1, description: 'CCTV camera at Block A ground floor lobby has no power indicator and appears offline.' },
    { id: 'd5-2', title: 'Intercom system down — multiple units Block A', block: 'A', floorRange: 'All floors', unit: 'A-09-04', category: 'Electrical', status: 'Acknowledged', reportedBy: 'Daniel O.', reportedAt: '2026-06-11', matchingUnits: 9, description: 'Intercom handsets in multiple units not receiving calls from lobby panel.' }
  ],
  p6: [
    { id: 'd6-1', title: 'Boom gate stuck — main entrance', block: '-', floorRange: '-', unit: '-', category: 'Security', status: 'In Progress', reportedBy: 'Lee T.K.', reportedAt: '2026-06-10', matchingUnits: 1, description: 'Boom gate arm gets stuck in raised position — manually operated by guards. Motor appears faulty.' },
    { id: 'd6-2', title: 'Street light out — near No. 30', block: '-', floorRange: '-', unit: 'No. 23', category: 'Electrical', status: 'Open', reportedBy: 'Lee T.K.', reportedAt: '2026-06-11', matchingUnits: 5, description: 'Street light column near house No. 30 has been dark for 7+ days. Safety concern at night.' }
  ]
}

export const documents = {
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

export const references = {
  p1: [
    { id: 'ref-p1-1', type: 'Project Reference', title: 'The Lumina Residences — Project Brochure', description: 'Full sales brochure: unit layouts, built-up sizes, facilities deck and finishing schedule.', date: '2025-08-12', uploadedBy: 'Admin', progress: null, attachments: [] },
    { id: 'ref-p1-2', type: 'Residence Reference', title: 'Type A & Type B Layout Plans', description: 'Dimensioned plans for the 3-bedroom (Type A) and 2-bedroom (Type B) units.', date: '2025-08-12', uploadedBy: 'Admin', progress: null, attachments: [] },
    { id: 'ref-p1-3', type: 'Building Progress', title: 'Facade & Pool Deck Update — June 2026', description: 'Block A facade painting completed. Pool deck tiling underway; gym equipment installs next week.', date: '2026-06-15', uploadedBy: 'Admin', progress: 78, attachments: [] },
    { id: 'ref-p1-4', type: 'Building Progress', title: 'Lobby Upgrade — April 2026', description: 'New lobby flooring and reception counters installed across all three blocks.', date: '2026-04-03', uploadedBy: 'Admin', progress: 40, attachments: [] }
  ],
  p2: [
    { id: 'ref-p2-1', type: 'Project Reference', title: 'Sentosa Heights — Resident Information Pack', description: 'Overview of blocks, facilities and maintenance scope for residents.', date: '2025-09-01', uploadedBy: 'Admin', progress: null, attachments: [] },
    { id: 'ref-p2-2', type: 'Building Progress', title: 'Covered Walkway Works — May 2026', description: 'New covered walkway between Block 1 and 2 underway. Expected completion end of July.', date: '2026-05-20', uploadedBy: 'Admin', progress: 55, attachments: [] }
  ],
  p4: [
    { id: 'ref-p4-1', type: 'Project Reference', title: 'Vista Permai Tower — Project Brochure', description: 'Seaview unit layouts, sky lounge and facilities overview.', date: '2025-07-22', uploadedBy: 'Admin', progress: null, attachments: [] }
  ]
}

export const feeTracker = {
  p1: { sinkingFund: 482300, monthlyFee: 280, previousYearFee: 250, feeIncreaseFlag: true, history: [{ month: '2026-01', amount: 250 }, { month: '2026-02', amount: 250 }, { month: '2026-03', amount: 250 }, { month: '2026-04', amount: 250 }, { month: '2026-05', amount: 250 }, { month: '2026-06', amount: 280 }], myPayments: [{ month: '2026-01', amount: 250, status: 'Paid' }, { month: '2026-02', amount: 250, status: 'Paid' }, { month: '2026-03', amount: 250, status: 'Paid' }, { month: '2026-04', amount: 250, status: 'Paid' }, { month: '2026-05', amount: 250, status: 'Paid' }, { month: '2026-06', amount: 280, status: 'Pending' }] },
  p2: { sinkingFund: 310500, monthlyFee: 220, previousYearFee: 220, feeIncreaseFlag: false, history: [{ month: '2026-01', amount: 220 }, { month: '2026-02', amount: 220 }, { month: '2026-03', amount: 220 }, { month: '2026-04', amount: 220 }, { month: '2026-05', amount: 220 }, { month: '2026-06', amount: 220 }], myPayments: [{ month: '2026-05', amount: 220, status: 'Paid' }, { month: '2026-06', amount: 220, status: 'Paid' }] },
  p3: { sinkingFund: 188500, monthlyFee: 150, previousYearFee: 130, feeIncreaseFlag: true, history: [{ month: '2026-01', amount: 130 }, { month: '2026-02', amount: 130 }, { month: '2026-03', amount: 150 }, { month: '2026-04', amount: 150 }, { month: '2026-05', amount: 150 }, { month: '2026-06', amount: 150 }], myPayments: [{ month: '2026-01', amount: 130, status: 'Paid' }, { month: '2026-02', amount: 130, status: 'Paid' }, { month: '2026-03', amount: 150, status: 'Paid' }, { month: '2026-04', amount: 150, status: 'Paid' }, { month: '2026-05', amount: 150, status: 'Paid' }, { month: '2026-06', amount: 150, status: 'Pending' }] },
  p4: { sinkingFund: 624000, monthlyFee: 300, previousYearFee: 300, feeIncreaseFlag: false, history: [{ month: '2026-01', amount: 300 }, { month: '2026-02', amount: 300 }, { month: '2026-03', amount: 300 }, { month: '2026-04', amount: 300 }, { month: '2026-05', amount: 300 }, { month: '2026-06', amount: 300 }], myPayments: [{ month: '2026-04', amount: 300, status: 'Paid' }, { month: '2026-05', amount: 300, status: 'Paid' }, { month: '2026-06', amount: 300, status: 'Pending' }] },
  p5: { sinkingFund: 92400, monthlyFee: 200, previousYearFee: 200, feeIncreaseFlag: false, history: [{ month: '2026-01', amount: 200 }, { month: '2026-02', amount: 200 }, { month: '2026-03', amount: 200 }, { month: '2026-04', amount: 200 }, { month: '2026-05', amount: 200 }, { month: '2026-06', amount: 200 }], myPayments: [{ month: '2026-04', amount: 200, status: 'Paid' }, { month: '2026-05', amount: 200, status: 'Paid' }, { month: '2026-06', amount: 200, status: 'Pending' }] },
  p6: { sinkingFund: 142800, monthlyFee: 120, previousYearFee: 100, feeIncreaseFlag: true, history: [{ month: '2026-01', amount: 100 }, { month: '2026-02', amount: 100 }, { month: '2026-03', amount: 120 }, { month: '2026-04', amount: 120 }, { month: '2026-05', amount: 120 }, { month: '2026-06', amount: 120 }], myPayments: [{ month: '2026-01', amount: 100, status: 'Paid' }, { month: '2026-02', amount: 100, status: 'Paid' }, { month: '2026-03', amount: 120, status: 'Paid' }, { month: '2026-04', amount: 120, status: 'Paid' }, { month: '2026-05', amount: 120, status: 'Paid' }, { month: '2026-06', amount: 120, status: 'Pending' }] }
}

export const demoUser = {
  id: 'u1', name: 'Alex Lim', email: 'alex.lim@example.com',
  verifiedCommunities: [{ projectId: 'p1', tier: 'Owner', unit: 'B-21-03', verifiedAt: '2026-03-15' }]
}
