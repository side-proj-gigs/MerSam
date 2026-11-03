import { PHOTOS, photo } from '@/lib/media';

const hero = (key: keyof typeof PHOTOS) => photo(PHOTOS[key], { width: 1920, quality: 72 });
const card = (key: keyof typeof PHOTOS) => photo(PHOTOS[key], { width: 1200, quality: 70 });

export const COMPANY = {
  name: 'MerSam',
  legalName: 'MerSam Water Systems and Plumbing Services',
  phone: '+233 55 183 0101',
  email: 'info@mersam.com',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
};

export const SETTINGS_SEED = {
  id: 'singleton',
  companyName: COMPANY.name,
  legalName: COMPANY.legalName,
  tagline: 'Clean water, engineered properly, from the borehole to the tap.',
  about:
    'MerSam is a Ghanaian water and plumbing engineering outfit working across Greater Accra and beyond. We sink boreholes, build and commission treatment plants, lay pipework and keep it all running. Where most contractors treat water supply and plumbing as two separate trades, we handle the whole line: the survey that finds the water, the drilling that reaches it, the treatment that makes it safe, and the pipework that carries it to where it is needed.',
  mission:
    'To put safe, reliable running water within reach of every home, business and community we serve, and to stand behind every metre of pipe we lay.',
  logoUrl: '/brand/mersam-icon.png',
  primaryPhone: COMPANY.phone,
  secondaryPhone: '+233 24 460 7788',
  whatsappNumber: COMPANY.phone,
  primaryEmail: COMPANY.email,
  supportEmail: 'support@mersam.com',
  addressLines: ['Spintex Road', 'Near Baatsona Total', 'Accra, Ghana'],
  city: COMPANY.city,
  region: COMPANY.region,
  country: COMPANY.country,
  mapEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d31763.3!2d-0.1!3d5.62!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sAccra!5e0!3m2!1sen!2sgh!4v1700000000000',
  businessHours: [
    { day: 'Monday', opensAt: '07:30', closesAt: '17:30', isClosed: false },
    { day: 'Tuesday', opensAt: '07:30', closesAt: '17:30', isClosed: false },
    { day: 'Wednesday', opensAt: '07:30', closesAt: '17:30', isClosed: false },
    { day: 'Thursday', opensAt: '07:30', closesAt: '17:30', isClosed: false },
    { day: 'Friday', opensAt: '07:30', closesAt: '17:30', isClosed: false },
    { day: 'Saturday', opensAt: '08:00', closesAt: '14:00', isClosed: false },
    { day: 'Sunday', opensAt: '', closesAt: '', isClosed: true },
  ],
  socials: [
    { platform: 'WhatsApp', url: 'https://wa.me/233551830101' },
    { platform: 'Facebook', url: 'https://facebook.com/mersamgh' },
    { platform: 'Instagram', url: 'https://instagram.com/mersamgh' },
    { platform: 'LinkedIn', url: 'https://linkedin.com/company/mersamgh' },
  ],
  offices: [
    {
      label: 'Head Office',
      addressLines: ['Spintex Road', 'Near Baatsona Total', 'Accra'],
      phone: COMPANY.phone,
      mapUrl: 'https://maps.google.com/?q=Spintex+Road+Accra',
    },
    {
      label: 'Workshop and Yard',
      addressLines: ['Community 25', 'Tema'],
      phone: '+233 24 460 7788',
      mapUrl: 'https://maps.google.com/?q=Community+25+Tema',
    },
  ],
  heroSlides: [
    {
      eyebrow: 'Water engineering',
      headline: 'Water you can drink, from a system you can trust',
      subhead:
        'Borehole drilling, reverse osmosis treatment and full plumbing installation, delivered by one team that stays accountable from survey to handover.',
      imageUrl: hero('waterSurface'),
      ctaLabel: 'Request a site visit',
      ctaHref: '/contact',
    },
    {
      eyebrow: 'Borehole and supply',
      headline: 'We find the water before we drill for it',
      subhead:
        'Geophysical surveys pinpoint the aquifer first, so you pay for a productive borehole rather than a hole in the ground.',
      imageUrl: hero('siteAerial'),
      ctaLabel: 'Book a survey',
      ctaHref: '/services/geophysical-surveys',
    },
    {
      eyebrow: 'Plumbing and maintenance',
      headline: 'Leaks found, pipes tested, pressure restored',
      subhead:
        'From a dripping joint to a failed riser across six floors, we trace the fault, prove the repair under pressure and document the work.',
      imageUrl: hero('pipeGauges'),
      ctaLabel: 'Report a problem',
      ctaHref: '/contact',
    },
  ],
  stats: [
    { label: 'Boreholes delivered', value: '340', suffix: '+' },
    { label: 'Litres treated daily', value: '1.2', suffix: 'M' },
    { label: 'Communities served', value: '48', suffix: '' },
    { label: 'Years on the tools', value: '14', suffix: '' },
  ],
  emergencyBannerText:
    'Burst pipe or no water? Our emergency line runs around the clock on +233 55 183 0101.',
  emergencyBannerEnabled: true,
  defaultVatRate: '0',
  defaultCurrency: 'GHS',
  defaultInvoiceTerms: [
    'As per agreed Terms and Conditions.',
    'Please do not hesitate to contact us should you have any concerns. Delivery of order should be within the stipulated time of receipt of payment.',
    'Orders are deemed confirmed after 2 hours if not cancelled.',
    'This invoice is valid for 7 days from date of issuance.',
  ].join('\n'),
  defaultPaymentDetails: [
    'Mobile Money: 055 183 0101 (MerSam)',
    'Bank: Ecobank Ghana, Spintex Branch',
    'Account Name: MerSam Water Systems and Plumbing Services',
    'Account Number: 1441000xxxxxx',
  ].join('\n'),
  bankName: 'Ecobank Ghana',
  bankAccountName: 'MerSam Water Systems and Plumbing Services',
  bankAccountNumber: '1441000xxxxxx',
  momoNumber: '055 183 0101',
  momoAccountName: 'MerSam',
  seoTitle: 'MerSam | Borehole Drilling, Water Treatment and Plumbing in Ghana',
  seoDescription:
    'MerSam delivers borehole drilling, geophysical water surveys, reverse osmosis treatment, solar water heater installation and full plumbing services across Accra and Ghana.',
  seoKeywords: [
    'borehole drilling Ghana',
    'water treatment Accra',
    'reverse osmosis Ghana',
    'plumbing services Accra',
    'geophysical water survey',
    'solar water heater installation',
    'community water project',
    'pipe laying Ghana',
  ],
  ogImageUrl: hero('waterSurface'),
};

export const CATEGORY_SEED = [
  {
    slug: 'treatment-and-purification',
    name: 'Treatment and Purification',
    description:
      'Making raw water safe to drink, whether it comes from a borehole, a tanker or the mains.',
    iconKey: 'droplets',
    accentColor: '#1e9cb3',
    sortOrder: 1,
  },
  {
    slug: 'water-supply-and-drilling',
    name: 'Water Supply and Drilling',
    description: 'Finding water, reaching it, and getting it to the people who need it.',
    iconKey: 'waves',
    accentColor: '#c9a227',
    sortOrder: 2,
  },
  {
    slug: 'plumbing-and-installation',
    name: 'Plumbing and Installation',
    description: 'Pipework, fittings and appliances installed to last.',
    iconKey: 'wrench',
    accentColor: '#2f9e63',
    sortOrder: 3,
  },
  {
    slug: 'diagnostics-and-maintenance',
    name: 'Diagnostics and Maintenance',
    description: 'Finding the fault, proving the fix and keeping the system healthy.',
    iconKey: 'gauge',
    accentColor: '#d08b14',
    sortOrder: 4,
  },
];

interface ServiceSeed {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  summary: string;
  body: string;
  iconKey: string;
  hero: keyof typeof PHOTOS;
  gallery: (keyof typeof PHOTOS)[];
  features: { title: string; detail: string }[];
  deliverables: string[];
  startingPriceMinor: number | null;
  priceNote: string;
  turnaround: string;
  featured: boolean;
}

export const SERVICE_SEED: ServiceSeed[] = [
  {
    slug: 'water-treatment',
    name: 'Water Treatment',
    category: 'treatment-and-purification',
    tagline: 'Raw water in, potable water out',
    summary:
      'Full treatment trains sized to your source and your demand, from sediment removal through to final disinfection.',
    body: `Most water problems in Ghana are not one problem. A borehole can be high in iron, moderately hard and carry a bacterial load all at once, and a filter that solves one of those will do nothing about the other two.

We start with a laboratory analysis of your actual water rather than a guess. From that result we size a treatment train: sediment and multimedia filtration to take out suspended solids, activated carbon for taste, odour and chlorine, softening or iron removal where the chemistry calls for it, and ultraviolet or dosed disinfection as the final barrier.

The plant is built on a skid, pressure tested and commissioned on site. You get the commissioning figures in writing, a maintenance schedule, and a service contract if you want us to keep it running.`,
    iconKey: 'droplets',
    hero: 'labTesting',
    gallery: ['labSamples', 'filterMedia', 'pipeGauges', 'labBench'],
    features: [
      { title: 'Laboratory analysis first', detail: 'We test your water before we quote on it, so the plant matches the chemistry.' },
      { title: 'Sized to real demand', detail: 'Flow rates are calculated from your peak draw, not from a catalogue page.' },
      { title: 'Commissioning report', detail: 'Written before and after figures for every parameter we treat.' },
      { title: 'Maintenance built in', detail: 'Media change intervals and consumable costs are quoted up front.' },
    ],
    deliverables: [
      'Raw water laboratory analysis',
      'Treatment train design and sizing',
      'Skid fabrication and installation',
      'Commissioning and handover report',
      'Operator training and maintenance schedule',
    ],
    startingPriceMinor: 850000,
    priceNote: 'Domestic systems start here. Plant scale is quoted after the water analysis.',
    turnaround: '2 to 5 weeks from analysis to handover',
    featured: true,
  },
  {
    slug: 'reverse-osmosis-water-treatment',
    name: 'Reverse Osmosis Water Treatment',
    category: 'treatment-and-purification',
    tagline: 'The last word in dissolved solids',
    summary:
      'RO plants for homes, offices, clinics and bottling lines, where salinity or dissolved solids put ordinary filtration out of its depth.',
    body: `Reverse osmosis is what you reach for when the problem is dissolved rather than suspended: brackish borehole water, high total dissolved solids, nitrates, or a process that simply demands very low conductivity.

We build RO systems around a proper pretreatment stage, because an RO membrane that is fed unprepared water fouls quickly and expensively. Sediment and carbon filtration, antiscalant dosing where the hardness calls for it, then the membrane array itself, sized so the recovery rate suits your source rather than looking good on paper.

Every system we install is fitted with conductivity monitoring so you can see at a glance that the membranes are still performing, and we log the readings at each service visit.`,
    iconKey: 'filter',
    hero: 'labBench',
    gallery: ['labSamples', 'pipeGauges', 'filterMedia', 'waterSurface'],
    features: [
      { title: 'Proper pretreatment', detail: 'Membranes are protected by filtration and dosing sized to the feed water.' },
      { title: 'Conductivity monitoring', detail: 'Inline meters show membrane performance without a service call.' },
      { title: 'Recovery tuned to source', detail: 'We set the recovery rate against your water, not a default figure.' },
      { title: 'Stocked consumables', detail: 'Cartridges and membranes held locally, so a service is not a six week wait.' },
    ],
    deliverables: [
      'Feed water analysis and RO modelling',
      'Pretreatment and dosing design',
      'Membrane array installation',
      'Permeate quality verification',
      'Service schedule with logged readings',
    ],
    startingPriceMinor: 1450000,
    priceNote: 'Quoted per cubic metre per day of permeate capacity.',
    turnaround: '3 to 6 weeks',
    featured: true,
  },
  {
    slug: 'osmosis-membrane-supply-and-replacement',
    name: 'Osmosis Membrane Supply and Replacement',
    category: 'treatment-and-purification',
    tagline: 'Genuine membranes, correctly specified',
    summary:
      'Supply, replacement and performance testing of RO membranes and housings for systems of any make.',
    body: `A reverse osmosis system lives or dies on its membranes, and a membrane is not a generic part. Element size, rejection rate, operating pressure and feed water chemistry all have to line up, and fitting the wrong element will quietly cost you both water and quality.

We supply genuine membranes across the common sizes and makes, and we will replace elements in a system we did not install. Before we quote we take the system's operating readings, because a drop in output is not always the membrane: it can be a failed pressure pump, a fouled pre-filter or a dosing line that stopped working months ago.

Where the membrane genuinely is at fault we replace it, flush and sanitise the housing, then verify the permeate quality before we leave.`,
    iconKey: 'layers',
    hero: 'filterMedia',
    gallery: ['labSamples', 'pipeGauges', 'labBench', 'machinist'],
    features: [
      { title: 'Diagnosis before replacement', detail: 'We confirm the membrane is the fault before you pay for a new one.' },
      { title: 'Correct specification', detail: 'Element matched to your housing, pressure and feed chemistry.' },
      { title: 'Housing sanitised', detail: 'Flushed and sanitised at every change, not just swapped over.' },
      { title: 'Any make serviced', detail: 'We work on systems we did not install.' },
    ],
    deliverables: [
      'System performance readings',
      'Membrane specification report',
      'Supply and fitting of elements',
      'Housing flush and sanitisation',
      'Post-change permeate verification',
    ],
    startingPriceMinor: 180000,
    priceNote: 'Per element, varying by size and rejection rate.',
    turnaround: 'Same day where stock is held',
    featured: false,
  },
  {
    slug: 'borehole-drilling',
    name: 'Borehole Drilling',
    category: 'water-supply-and-drilling',
    tagline: 'Your own water supply, properly constructed',
    summary:
      'Surveyed, drilled, cased, developed and tested boreholes for homes, estates, schools and farms.',
    body: `A borehole is a long-term asset, and the difference between one that serves a household for twenty years and one that silts up in two is almost entirely in how it was constructed.

We do not drill speculatively. A geophysical survey comes first to locate the aquifer and estimate its depth, which is what lets us give you a realistic depth range and yield expectation before the rig arrives. Drilling follows, then casing and screening chosen for the formation, a properly graded gravel pack, and development until the water runs clear.

Finally we run a pumping test to establish the sustainable yield, so the pump we recommend matches what the borehole can actually give rather than what you hoped for. You receive the drilling log, the test results and the water analysis as a single handover pack.`,
    iconKey: 'drill',
    hero: 'siteAerial',
    gallery: ['siteScaffold', 'siteTimber', 'technicianPortrait', 'cranes'],
    features: [
      { title: 'Survey before rig', detail: 'We locate the aquifer first, which is how we avoid dry holes.' },
      { title: 'Formation-matched casing', detail: 'Screen and gravel pack selected for the strata we actually drill through.' },
      { title: 'Pumping test included', detail: 'Sustainable yield measured, so the pump is sized honestly.' },
      { title: 'Full handover pack', detail: 'Drilling log, yield test and water analysis, all in writing.' },
    ],
    deliverables: [
      'Geophysical siting report',
      'Drilling and lithological log',
      'Casing, screening and gravel pack',
      'Borehole development and flushing',
      'Pumping test and yield certificate',
      'Water quality analysis',
    ],
    startingPriceMinor: 2800000,
    priceNote: 'Depends on depth and formation. Quoted after the survey.',
    turnaround: '1 to 3 weeks on site',
    featured: true,
  },
  {
    slug: 'geophysical-surveys',
    name: 'Geophysical Surveys',
    category: 'water-supply-and-drilling',
    tagline: 'Precision measurement of water underground',
    summary:
      'Electrical resistivity surveys that locate the aquifer and estimate its depth before a single metre is drilled.',
    body: `Drilling without a survey is the most expensive way to find out there is no water under your plot. A geophysical survey costs a fraction of a borehole and tells you where to put it.

We run vertical electrical soundings and resistivity profiling across the site, reading how the ground conducts current at increasing depths. Water-bearing formations have a distinct signature, and fractured zones in basement rock, which is where most of southern Ghana's groundwater sits, show up clearly against the surrounding mass.

The output is a marked drilling point, an expected depth range, an indication of likely yield and an honest assessment where the prospects are poor. We would rather tell you the site is weak than sell you a borehole that disappoints.`,
    iconKey: 'radar',
    hero: 'safetyGoggles',
    gallery: ['siteAerial', 'labBench', 'technicianPortrait', 'siteScaffold'],
    features: [
      { title: 'Resistivity profiling', detail: 'Vertical soundings and profiling read the ground to depth.' },
      { title: 'Marked drilling point', detail: 'You get a physical point on the ground, not a vague area.' },
      { title: 'Honest prospects', detail: 'Where the site is weak, we say so before you commit to drilling.' },
      { title: 'Depth and yield estimate', detail: 'A realistic range to budget against.' },
    ],
    deliverables: [
      'Site reconnaissance',
      'Vertical electrical sounding data',
      'Resistivity interpretation',
      'Marked and georeferenced drilling point',
      'Written survey report with depth and yield estimate',
    ],
    startingPriceMinor: 350000,
    priceNote: 'Per site. Deducted from the drilling cost if you proceed with us.',
    turnaround: '2 to 4 days including the report',
    featured: true,
  },
  {
    slug: 'community-water-systems',
    name: 'Community Water Systems',
    category: 'water-supply-and-drilling',
    tagline: 'Supply that serves a whole settlement',
    summary:
      'Mechanised borehole schemes with storage, distribution and standpipes, built for villages, schools and institutions.',
    body: `A community scheme is a different animal from a household borehole. It has to serve hundreds of people at peak hours, survive being used by everybody, and keep working after the people who built it have left.

We design and build complete schemes: the borehole and pump, solar or grid power, elevated or ground storage sized to carry the settlement through the evening draw, and a distribution network out to standpipes placed where people actually walk.

Durability drives every choice. Fittings are specified for heavy use, the pump controller is protected against the voltage conditions it will really see, and we train local caretakers on routine maintenance before handover so small faults get fixed before they become failures.`,
    iconKey: 'users',
    hero: 'siteScaffold',
    gallery: ['siteAerial', 'cranes', 'teamHands', 'technicianPortrait'],
    features: [
      { title: 'Sized for peak draw', detail: 'Storage carries the settlement through morning and evening demand.' },
      { title: 'Solar or grid powered', detail: 'Power chosen for what the site can reliably sustain.' },
      { title: 'Caretaker training', detail: 'Local maintenance handled locally, from day one.' },
      { title: 'Heavy-use fittings', detail: 'Specified for communal use rather than domestic duty.' },
    ],
    deliverables: [
      'Demand assessment and scheme design',
      'Borehole, pump and power installation',
      'Storage tower and tank',
      'Distribution network and standpipes',
      'Caretaker training and spares pack',
    ],
    startingPriceMinor: null,
    priceNote: 'Quoted per scheme after a demand assessment.',
    turnaround: '6 to 12 weeks',
    featured: true,
  },
  {
    slug: 'general-plumbing',
    name: 'General Plumbing',
    category: 'plumbing-and-installation',
    tagline: 'The everyday work, done properly',
    summary:
      'First fix, second fix, repairs and alterations across domestic, commercial and institutional buildings.',
    body: `This is the bread and butter: new installations, extensions, replacements and the repairs that cannot wait.

We work in PPR, PVC, galvanised and copper, and we size the pipework for the building rather than running the same diameter everywhere and hoping. Hot and cold runs are set out so they can be isolated and serviced later, which is the difference between a ten minute repair in five years and a wall being opened up.

Every job finishes the same way: the system is pressure tested, the work area is cleaned, and you get an itemised invoice listing every fitting used and the workmanship separately, so you can see exactly what you paid for.`,
    iconKey: 'wrench',
    hero: 'technicianAtWork',
    gallery: ['technicianPortrait', 'powerTool', 'interiorWork', 'machinist'],
    features: [
      { title: 'Correctly sized runs', detail: 'Pipework sized to the building, so pressure holds at every outlet.' },
      { title: 'Serviceable layout', detail: 'Isolation valves placed so future repairs do not mean opening walls.' },
      { title: 'Pressure tested', detail: 'Nothing is closed up until it has held pressure.' },
      { title: 'Itemised invoicing', detail: 'Every fitting and the workmanship listed separately.' },
    ],
    deliverables: [
      'Site assessment and materials list',
      'First and second fix installation',
      'Pressure test certificate',
      'Itemised invoice',
      'Workmanship warranty',
    ],
    startingPriceMinor: 35000,
    priceNote: 'Call-out and first hour. Materials itemised separately.',
    turnaround: 'Same or next working day for repairs',
    featured: true,
  },
  {
    slug: 'pipe-laying',
    name: 'Pipe Laying',
    category: 'plumbing-and-installation',
    tagline: 'Mains and transmission lines that stay buried',
    summary:
      'Excavation, jointing, bedding and reinstatement for supply mains, transmission lines and site distribution.',
    body: `Buried pipe is unforgiving. Get the bedding wrong or rush a joint and the failure happens under a driveway two years later, which is when it becomes genuinely expensive.

We set out the line, excavate to the right depth and width, and bed the pipe on properly graded material rather than dropping it onto the spoil. Joints are made to the manufacturer's method, whether that is solvent weld, fusion or mechanical, and every joint is left exposed until the line has been pressure tested.

Only once the line holds pressure do we backfill in compacted layers and reinstate the surface. You get an as-laid drawing showing depths and route, which the next person to dig on your site will thank you for.`,
    iconKey: 'spline',
    hero: 'welding',
    gallery: ['industrialPipes', 'siteScaffold', 'pipeGauges', 'siteTimber'],
    features: [
      { title: 'Graded bedding', detail: 'Pipe laid on proper material, not on excavated spoil.' },
      { title: 'Joints tested exposed', detail: 'Nothing is backfilled until the line has held pressure.' },
      { title: 'Compacted reinstatement', detail: 'Backfill in layers, so the surface does not settle later.' },
      { title: 'As-laid drawing', detail: 'Route and depths recorded for whoever digs next.' },
    ],
    deliverables: [
      'Route setting out',
      'Excavation and bedding',
      'Pipe jointing to manufacturer method',
      'Pressure test before backfill',
      'Compacted reinstatement',
      'As-laid drawing',
    ],
    startingPriceMinor: null,
    priceNote: 'Quoted per linear metre by diameter and ground conditions.',
    turnaround: 'Programmed to the run length',
    featured: false,
  },
  {
    slug: 'solar-water-heater-installation',
    name: 'Solar Water Heater Installation',
    category: 'plumbing-and-installation',
    tagline: 'Hot water from the one resource Ghana never runs short of',
    summary:
      'Supply and installation of solar water heating systems, with the plumbing and roof work handled by the same team.',
    body: `Ghana gets enough sun to heat domestic water for most of the year, and a solar water heater typically pays for itself against an electric geyser within a few seasons.

We install both flat plate and evacuated tube systems, choosing between them on your roof orientation, available area and how much hot water you actually draw. The tank is sized to your household rather than sold to you by the largest available unit.

Because we are plumbers as well as installers, the connection into your existing hot water circuit is done properly: tempering valve fitted, backup element wired where you want one for the harmattan weeks, and the roof penetration flashed and sealed so the first heavy rain does not find its way in.`,
    iconKey: 'sun',
    hero: 'solarArray',
    gallery: ['technicianAtWork', 'sealingWork', 'bathroomTub', 'powerTool'],
    features: [
      { title: 'System matched to roof', detail: 'Flat plate or evacuated tube, chosen on orientation and area.' },
      { title: 'Tank sized to the household', detail: 'Capacity based on your real draw, not the biggest unit in stock.' },
      { title: 'Proper hot water integration', detail: 'Tempering valve and backup element handled by plumbers.' },
      { title: 'Flashed and sealed', detail: 'Roof penetrations finished so they stay watertight.' },
    ],
    deliverables: [
      'Roof and demand assessment',
      'System supply and mounting',
      'Hot water circuit integration',
      'Tempering valve and backup element',
      'Commissioning and user handover',
    ],
    startingPriceMinor: 620000,
    priceNote: 'For a 150 litre domestic system, supplied and installed.',
    turnaround: '1 to 2 days on site',
    featured: true,
  },
  {
    slug: 'bathroom-accessories-and-fittings',
    name: 'Bathroom Accessories and Fittings',
    category: 'plumbing-and-installation',
    tagline: 'Fixtures fitted so they stay fitted',
    summary:
      'Supply and installation of sanitaryware, taps, showers, cisterns and accessories, plus repairs to existing fittings.',
    body: `Bathroom fittings fail for predictable reasons: the wrong fixing into the wrong substrate, a waste that was never properly sealed, or a mixer fitted to a system whose pressure it was never designed for.

We fit sanitaryware, mixers, showers, cisterns, heated towel rails and accessories, and we check the supply pressure before recommending a mixer so you are not left with a shower that trickles. Fixings are chosen for what the wall is actually made of, and every waste and trap is tested under running water before we call the job done.

We also repair rather than replace wherever it is sensible. A cistern that will not stop running is usually a two hundred cedi part, not a new suite.`,
    iconKey: 'shower-head',
    hero: 'bathroomShower',
    gallery: ['bathroomTub', 'sealingWork', 'technicianAtWork', 'interiorWork'],
    features: [
      { title: 'Pressure checked first', detail: 'Mixers recommended against your real supply pressure.' },
      { title: 'Substrate-correct fixings', detail: 'Fixings chosen for the wall, so nothing works loose.' },
      { title: 'Wastes tested running', detail: 'Every trap and waste proved under flow before handover.' },
      { title: 'Repair where sensible', detail: 'We will fix a cistern rather than sell you a suite.' },
    ],
    deliverables: [
      'Supply pressure check',
      'Sanitaryware and fittings supply',
      'Installation and sealing',
      'Waste and trap testing',
      'Making good and clean handover',
    ],
    startingPriceMinor: 45000,
    priceNote: 'Per fitting installed. Sanitaryware itemised separately.',
    turnaround: 'Same day for most fittings',
    featured: false,
  },
  {
    slug: 'leak-detection-and-repair',
    name: 'Leak Detection and Repair',
    category: 'diagnostics-and-maintenance',
    tagline: 'We find it before we open the wall',
    summary:
      'Non-destructive tracing of concealed leaks in walls, floors and buried lines, followed by a proven repair.',
    body: `The expensive part of a concealed leak is rarely the repair. It is the guesswork: four holes in a wall before anyone finds the pipe.

We trace leaks without that. Acoustic correlation picks up the sound of escaping water through concrete and screed, pressure decay testing isolates which circuit is losing, and section-by-section isolation narrows the fault down to a stretch of pipe rather than a room.

When we do open up, we open up once. The repair is made, the circuit is pressure tested to prove it, and we make good behind ourselves. Where a leak has been running long enough to cause damp, we will tell you plainly what drying out is going to involve.`,
    iconKey: 'search',
    hero: 'sealingWork',
    gallery: ['pipeGauges', 'interiorWork', 'technicianAtWork', 'industrialPipes'],
    features: [
      { title: 'Acoustic tracing', detail: 'Leaks located through concrete and screed without opening up.' },
      { title: 'Pressure decay testing', detail: 'Isolates the failing circuit before any cutting starts.' },
      { title: 'One opening, one repair', detail: 'We locate first, so the wall is opened once.' },
      { title: 'Proven under pressure', detail: 'The circuit is retested before anything is closed up.' },
    ],
    deliverables: [
      'Non-destructive leak survey',
      'Circuit isolation and pressure decay test',
      'Located fault report',
      'Repair and retest',
      'Making good',
    ],
    startingPriceMinor: 95000,
    priceNote: 'Detection survey. Repair quoted once the fault is located.',
    turnaround: 'Survey same or next day',
    featured: true,
  },
  {
    slug: 'pressure-testing-of-pipes',
    name: 'Pressure Testing of Pipes',
    category: 'diagnostics-and-maintenance',
    tagline: 'Proof, in writing, that the system holds',
    summary:
      'Hydrostatic and pneumatic testing of new and existing pipework, with a certificate for your records or your consultant.',
    body: `A pressure test is how you find out whether an installation is sound before it is buried, tiled over or handed to a client. It is also what a consultant, a bank or an insurer will ask to see.

We test new installations before closing up, existing systems where a fault is suspected, and buried mains before backfill. The system is isolated, filled and pressurised to the specified test pressure, then held and monitored for the required duration with the pressure logged at intervals.

You receive a signed certificate recording the test pressure, the hold period, the readings taken and the result. Where a system fails we identify where it is losing before we leave the site.`,
    iconKey: 'gauge',
    hero: 'pipeGauges',
    gallery: ['industrialPipes', 'machinist', 'welding', 'technicianPortrait'],
    features: [
      { title: 'Hydrostatic and pneumatic', detail: 'Testing method matched to the system and the specification.' },
      { title: 'Logged readings', detail: 'Pressure recorded at intervals across the full hold period.' },
      { title: 'Signed certificate', detail: 'Documentation your consultant or insurer will accept.' },
      { title: 'Failures located', detail: 'If it does not hold, we find out where before we leave.' },
    ],
    deliverables: [
      'System isolation and fill',
      'Pressurisation to specified test pressure',
      'Monitored hold period with logged readings',
      'Signed pressure test certificate',
      'Fault location where the test fails',
    ],
    startingPriceMinor: 120000,
    priceNote: 'Per circuit tested, including the certificate.',
    turnaround: 'Half a day for most circuits',
    featured: false,
  },
  {
    slug: 'drainage-works',
    name: 'Drainage Works',
    category: 'diagnostics-and-maintenance',
    tagline: 'Blockages cleared, falls corrected, flow restored',
    summary:
      'Clearing, repair and installation of foul and surface water drainage, including soakaways and septic connections.',
    body: `A drain that blocks repeatedly almost never has a blockage problem. It has a fall problem, a root problem or a collapsed section, and rodding it again every few months treats the symptom.

We clear the immediate blockage, then establish why it happened. That usually means checking the falls along the run and inspecting the line, because a belly in a pipe or a displaced joint will keep catching solids no matter how often it is cleared.

From there we do what the line actually needs: re-laying a section to the correct gradient, replacing collapsed pipe, cutting out roots, or building a soakaway that can take the surface water your compound actually sheds in a storm.`,
    iconKey: 'waves',
    hero: 'industrialPipes',
    gallery: ['welding', 'siteTimber', 'siteScaffold', 'pipeGauges'],
    features: [
      { title: 'Cause, not just symptom', detail: 'We establish why it blocked rather than rodding it again.' },
      { title: 'Falls checked', detail: 'Gradients verified along the run, because most repeat blockages are falls.' },
      { title: 'Sections re-laid', detail: 'Collapsed or bellied pipe replaced rather than patched.' },
      { title: 'Soakaways sized properly', detail: 'Built for the surface water your compound really sheds.' },
    ],
    deliverables: [
      'Blockage clearance',
      'Drain inspection and fall survey',
      'Repair or re-laying of defective sections',
      'Soakaway and septic connection works',
      'Flow test on completion',
    ],
    startingPriceMinor: 80000,
    priceNote: 'Clearance call-out. Repairs quoted after inspection.',
    turnaround: 'Same day clearance, repairs programmed',
    featured: false,
  },
];

export const TESTIMONIAL_SEED = [
  {
    authorName: 'Nana Ama Boateng',
    authorRole: 'Homeowner',
    location: 'East Legon, Accra',
    quote:
      'They surveyed first and told us the far corner of the plot was the only sensible spot. The borehole came in at thirty eight metres and we have not been on tanker water since. What stood out was that the yield test figure they gave us is the figure we actually get.',
    rating: 5,
    sortOrder: 1,
  },
  {
    authorName: 'Mr. Ebo Quartey',
    authorRole: 'Property Developer',
    location: 'Spintex, Accra',
    quote:
      'The invoice listed every elbow and every length of pipe with the workmanship separate. I have worked with a lot of contractors and almost none of them do that. It made approving the payment straightforward.',
    rating: 5,
    sortOrder: 2,
  },
  {
    authorName: 'Dr. Selorm Adjei',
    authorRole: 'Clinic Administrator',
    location: 'Tema',
    quote:
      'Our RO plant feeds the dialysis unit, so conductivity is not negotiable. MerSam commissioned it, left us the readings, and turn up on schedule for every service with the log book in hand.',
    rating: 5,
    sortOrder: 3,
  },
  {
    authorName: 'Shola Adeyemi',
    authorRole: 'Residential Client',
    location: 'Madina, Accra',
    quote:
      'The sewage line had been backing up for weeks and two other people had rodded it. MerSam cleared it, then found the section that had dropped and re-laid it. One working day, and it has been clear since.',
    rating: 5,
    sortOrder: 4,
  },
  {
    authorName: 'Elder Kwabena Mensah',
    authorRole: 'Community Chairman',
    location: 'Ayikuma, Greater Accra',
    quote:
      'They built the scheme and then spent two days training four of our young men to look after it. That is the part most contractors skip. Three years on it is still running and we have not had to call anyone.',
    rating: 5,
    sortOrder: 5,
  },
  {
    authorName: 'Gifty Owusu',
    authorRole: 'Facilities Manager',
    location: 'Airport Residential, Accra',
    quote:
      'We had a leak somewhere under a tiled floor and were dreading it. They traced it acoustically, opened one tile, fixed the joint and retested. The repair cost less than the detection survey I was quoted elsewhere.',
    rating: 5,
    sortOrder: 6,
  },
];

export const FAQ_SEED = [
  {
    question: 'How much does a borehole cost in Ghana?',
    answer:
      'It depends almost entirely on depth and the formation being drilled. A shallow borehole in soft overburden is a very different job from one that has to penetrate twenty metres of hard basement rock. We run a geophysical survey first, which gives us a realistic depth range, and quote from that. As a guide, domestic boreholes typically start around GH₵28,000 fully constructed and tested.',
    category: 'Borehole and Supply',
    sortOrder: 1,
  },
  {
    question: 'Do I really need a survey before drilling?',
    answer:
      'If you want to avoid a dry hole, yes. A survey costs a small fraction of a borehole and tells you both where to drill and roughly how deep. We deduct the survey cost from the drilling price if you go ahead with us, so in practice it costs you nothing extra and removes most of the risk.',
    category: 'Borehole and Supply',
    sortOrder: 2,
  },
  {
    question: 'How long does a borehole take from start to finish?',
    answer:
      'The survey takes two to four days including the report. Drilling, casing, development and the pumping test usually take one to three weeks on site depending on depth and conditions. Pump installation and connection follows within a few days of the test.',
    category: 'Borehole and Supply',
    sortOrder: 3,
  },
  {
    question: 'Is borehole water safe to drink without treatment?',
    answer:
      'Not automatically. Groundwater in Ghana is often hard, frequently high in iron, and can carry bacteria depending on the surroundings and the borehole construction. We take a water sample as part of every borehole handover and give you the laboratory result. If treatment is needed we will tell you exactly which parameters are out and what it would take to correct them.',
    category: 'Water Quality',
    sortOrder: 4,
  },
  {
    question: 'What is the difference between filtration and reverse osmosis?',
    answer:
      'Filtration removes things suspended in the water: sediment, particles, and with carbon, taste and odour compounds. Reverse osmosis removes things dissolved in it: salts, nitrates, and most of the total dissolved solids. If your water is cloudy or tastes of chlorine, filtration is usually enough. If it is brackish or high in dissolved solids, you need RO.',
    category: 'Water Quality',
    sortOrder: 5,
  },
  {
    question: 'How often do RO membranes need replacing?',
    answer:
      'Between two and five years in normal service, but it depends heavily on the feed water and whether the pretreatment is being maintained. A system fed unprepared water can foul its membranes in months. We fit conductivity monitoring so you can see performance dropping before it becomes a problem.',
    category: 'Water Quality',
    sortOrder: 6,
  },
  {
    question: 'Do you handle emergency call-outs?',
    answer:
      'Yes. A burst pipe or a complete loss of supply is treated as an emergency and we aim to be on site the same day within Greater Accra. Call +233 55 183 0101. Outside normal hours the same number reaches the on-call engineer.',
    category: 'Working With Us',
    sortOrder: 7,
  },
  {
    question: 'How do you price your work?',
    answer:
      'Materials are itemised individually at the price we pay plus a stated margin, and workmanship is quoted as a separate line. You can see exactly what the fittings cost and exactly what the labour cost. For larger works we quote a fixed price after a site visit rather than working on day rates.',
    category: 'Working With Us',
    sortOrder: 8,
  },
  {
    question: 'Do you give any guarantee on the work?',
    answer:
      'Workmanship is guaranteed for twelve months on plumbing installations and twenty four months on borehole construction. Supplied equipment carries whatever warranty the manufacturer provides, and we register it for you at handover. If something we installed fails within that period we come back and put it right.',
    category: 'Working With Us',
    sortOrder: 9,
  },
  {
    question: 'Which areas do you cover?',
    answer:
      'Plumbing and maintenance work is centred on Greater Accra and Tema. Borehole drilling, treatment plant installation and community schemes we take on nationwide, with mobilisation quoted separately for sites outside the Accra region.',
    category: 'Working With Us',
    sortOrder: 10,
  },
  {
    question: 'Will I get documentation for the work?',
    answer:
      'Always. Every job closes with an itemised invoice, and larger works also receive a work completion and payment report setting out what was done, what it cost, what has been paid and what if anything is outstanding. Pressure tests, yield tests and water analyses are issued as signed certificates.',
    category: 'Working With Us',
    sortOrder: 11,
  },
  {
    question: 'Can you work on a system another contractor installed?',
    answer:
      'Yes, and we do it often. We will take the system as we find it, tell you honestly what state it is in, and quote for putting it right. We do not require you to replace equipment that is serviceable just because we did not install it.',
    category: 'Working With Us',
    sortOrder: 12,
  },
];

export const PROJECT_SEED = [
  {
    slug: 'ayikuma-community-water-scheme',
    title: 'Ayikuma Community Water Scheme',
    client: 'Ayikuma Town Development Committee',
    location: 'Ayikuma, Greater Accra',
    summary:
      'A mechanised borehole scheme serving roughly 1,800 people through six standpipes, powered entirely by solar.',
    body: `Ayikuma had a hand pump that served part of the town and failed often. The committee wanted something that would carry the whole settlement and survive being used hard.

We surveyed three candidate sites and drilled at the strongest, hitting a fractured zone at fifty two metres with a tested yield of 4.2 cubic metres an hour. A solar array drives a submersible pump into a 20,000 litre elevated tank, sized to carry the town through the evening draw without the pump running after dark.

Six standpipes were placed after walking the town with the committee, rather than from a plan. Four local caretakers were trained over two days on routine maintenance and given a spares pack. The scheme has run without a contractor call-out since handover.`,
    serviceSlug: 'community-water-systems',
    cover: 'siteScaffold' as const,
    gallery: ['siteAerial', 'cranes', 'teamHands', 'technicianPortrait'] as const,
    completedOn: '2025-03-18',
    stats: [
      { label: 'People served', value: '1,800' },
      { label: 'Tested yield', value: '4.2 m³/hr' },
      { label: 'Standpipes', value: '6' },
      { label: 'Power source', value: 'Solar' },
    ],
    sortOrder: 1,
  },
  {
    slug: 'tema-clinic-reverse-osmosis-plant',
    title: 'Tema Clinic Reverse Osmosis Plant',
    client: 'Private medical clinic, Tema',
    location: 'Tema, Greater Accra',
    summary:
      'A 6 m³/day RO plant feeding a dialysis unit, with continuous conductivity monitoring and a logged service regime.',
    body: `Dialysis water has no tolerance for guesswork. The clinic's mains supply ran between 780 and 1,100 microsiemens depending on the season, well outside what the unit could accept.

We built a treatment train with multimedia and carbon pretreatment, antiscalant dosing, and a two-stage membrane array producing six cubic metres a day of permeate. Conductivity is monitored inline and alarmed, so the unit knows immediately if performance drifts.

Commissioning brought permeate conductivity down to 18 microsiemens. The plant has been on a six-weekly service since, with every reading logged in a book kept on site.`,
    serviceSlug: 'reverse-osmosis-water-treatment',
    cover: 'labBench' as const,
    gallery: ['labTesting', 'labSamples', 'pipeGauges', 'filterMedia'] as const,
    completedOn: '2025-07-02',
    stats: [
      { label: 'Capacity', value: '6 m³/day' },
      { label: 'Feed conductivity', value: '1,100 µS' },
      { label: 'Permeate', value: '18 µS' },
      { label: 'Service interval', value: '6 weeks' },
    ],
    sortOrder: 2,
  },
  {
    slug: 'east-legon-residential-borehole',
    title: 'East Legon Residential Borehole',
    client: 'Private residence',
    location: 'East Legon, Accra',
    summary:
      'Surveyed, drilled and commissioned in eleven days, ending a household dependence on tanker deliveries.',
    body: `The plot had been written off by a previous driller who put a dry hole in the obvious spot near the gate. We surveyed the whole plot and found the resistivity signature of a fractured zone at the far boundary, under what was then a car port.

Drilling hit water at thirty eight metres. The pumping test gave a sustainable yield of 2.8 cubic metres an hour, which comfortably covers a household of nine plus irrigation.

A pressure set and 5,000 litre storage were installed, with the whole system commissioned eleven days after the survey. The household has not taken a tanker delivery since.`,
    serviceSlug: 'borehole-drilling',
    cover: 'siteAerial' as const,
    gallery: ['siteTimber', 'technicianPortrait', 'safetyGoggles', 'siteScaffold'] as const,
    completedOn: '2025-09-12',
    stats: [
      { label: 'Depth', value: '38 m' },
      { label: 'Tested yield', value: '2.8 m³/hr' },
      { label: 'Storage', value: '5,000 L' },
      { label: 'Survey to water', value: '11 days' },
    ],
    sortOrder: 3,
  },
  {
    slug: 'spintex-apartment-block-plumbing',
    title: 'Spintex Apartment Block, Full Plumbing Installation',
    client: 'Mr. Ebo Quartey',
    location: 'Spintex, Accra',
    summary:
      'First and second fix across a four-unit block, pressure tested circuit by circuit before closing up.',
    body: `A four-unit block needed its entire water installation from scratch: cold distribution, hot runs, sanitary connections and a 4 inch soil stack.

The work was set out so each unit can be isolated independently, which matters in a block where one leaking apartment should not mean shutting water to the other three. Risers were sized so the top floor holds pressure when the ground floor is drawing.

Every circuit was pressure tested with the joints still exposed before anything was boxed in. The client received an invoice itemising all twenty three material lines separately from the workmanship.`,
    serviceSlug: 'general-plumbing',
    cover: 'technicianAtWork' as const,
    gallery: ['bathroomShower', 'welding', 'pipeGauges', 'powerTool'] as const,
    completedOn: '2026-10-16',
    stats: [
      { label: 'Units', value: '4' },
      { label: 'Circuits tested', value: '12' },
      { label: 'Stack', value: '4 inch' },
      { label: 'Programme', value: '3 weeks' },
    ],
    sortOrder: 4,
  },
  {
    slug: 'madina-sewage-line-rectification',
    title: 'Madina Sewage Line Rectification',
    client: 'Shola',
    location: 'Madina, Accra',
    summary:
      'A repeatedly blocking sewage line cleared, surveyed and re-laid to correct gradient in one working day.',
    body: `The line had been rodded twice by others and blocked again within weeks, which is the classic signature of a fall problem rather than a blockage problem.

We cleared the immediate obstruction, then ran a fall survey along the full length. A three metre section had dropped where the ground beneath it had settled, creating a belly that caught solids on every discharge.

That section was excavated, re-bedded and re-laid to the correct gradient, then flow tested. The work was completed within one working day and the line has run clear since.`,
    serviceSlug: 'drainage-works',
    cover: 'industrialPipes' as const,
    gallery: ['welding', 'siteTimber', 'interiorWork', 'technicianAtWork'] as const,
    completedOn: '2026-10-04',
    stats: [
      { label: 'Section re-laid', value: '3 m' },
      { label: 'Time on site', value: '1 day' },
      { label: 'Previous attempts', value: '2' },
      { label: 'Repeat blockages', value: '0' },
    ],
    sortOrder: 5,
  },
  {
    slug: 'airport-residential-solar-hot-water',
    title: 'Airport Residential Solar Hot Water Retrofit',
    client: 'Private residence',
    location: 'Airport Residential, Accra',
    summary:
      'Two 200 litre evacuated tube systems retrofitted onto an occupied house, cutting the water heating bill substantially.',
    body: `The house ran two electric geysers that between them accounted for a large share of the monthly bill. The roof had good northern exposure and enough clear area for two arrays.

We fitted evacuated tube collectors rather than flat plate, because the available roof area favoured the higher efficiency per square metre. Both systems were integrated into the existing hot water circuit with tempering valves, and the original elements retained as backup for the harmattan weeks.

All four roof penetrations were flashed and sealed. The house stayed occupied throughout and had hot water every evening of the installation.`,
    serviceSlug: 'solar-water-heater-installation',
    cover: 'solarArray' as const,
    gallery: ['bathroomTub', 'sealingWork', 'technicianAtWork', 'powerTool'] as const,
    completedOn: '2026-08-21',
    stats: [
      { label: 'Systems', value: '2 × 200 L' },
      { label: 'Collector type', value: 'Evacuated tube' },
      { label: 'Backup retained', value: 'Yes' },
      { label: 'Time on site', value: '2 days' },
    ],
    sortOrder: 6,
  },
];

/** The worked example from the signed paper invoice, used to prove the maths. */
export const SAMPLE_INVOICE_LINES = [
  { unitOfMeasure: 'Pcs', description: '3/4" PPR Pipe', quantity: 25, unitPriceMinor: 4400 },
  { unitOfMeasure: 'Pcs', description: '1/2" Pipe', quantity: 3, unitPriceMinor: 3000 },
  { unitOfMeasure: 'Pcs', description: '3/4" Elbow', quantity: 30, unitPriceMinor: 300 },
  { unitOfMeasure: 'Pcs', description: 'PPR Female Elbow', quantity: 30, unitPriceMinor: 1000 },
  { unitOfMeasure: 'Pcs', description: '1/2" Female Elbow Twins', quantity: 3, unitPriceMinor: 2000 },
  { unitOfMeasure: 'Pcs', description: '1/2" Plugs', quantity: 33, unitPriceMinor: 300 },
  { unitOfMeasure: 'Pcs', description: '3/4" Stop Cock', quantity: 5, unitPriceMinor: 7000 },
  { unitOfMeasure: 'Pcs', description: '3/4" Tee', quantity: 26, unitPriceMinor: 300 },
  { unitOfMeasure: 'Pcs', description: '3/4" Elbow', quantity: 25, unitPriceMinor: 300 },
  { unitOfMeasure: 'Pcs', description: '3/4" by 1/2" Reducer', quantity: 20, unitPriceMinor: 300 },
  { unitOfMeasure: 'Pcs', description: '4" Pressure Pipe', quantity: 15, unitPriceMinor: 40000 },
  { unitOfMeasure: 'Pcs', description: '4" Slow Elbow', quantity: 14, unitPriceMinor: 2000 },
  { unitOfMeasure: 'Pcs', description: '4" Swerve Tee', quantity: 12, unitPriceMinor: 2500 },
  { unitOfMeasure: 'Pcs', description: '2" Pressure Pipe', quantity: 9, unitPriceMinor: 18000 },
  { unitOfMeasure: 'Pcs', description: '2" Elbow', quantity: 16, unitPriceMinor: 800 },
  { unitOfMeasure: 'Pcs', description: '2" Swerve Tee', quantity: 9, unitPriceMinor: 1000 },
  { unitOfMeasure: 'Pcs', description: '1 1/2" Pipe', quantity: 3, unitPriceMinor: 7000 },
  { unitOfMeasure: 'Pcs', description: '2" by 1 1/2" Reducer', quantity: 14, unitPriceMinor: 700 },
  { unitOfMeasure: 'Pcs', description: '1 1/2" Elbow', quantity: 8, unitPriceMinor: 600 },
  { unitOfMeasure: 'Pcs', description: '1 1/2" End Cap', quantity: 6, unitPriceMinor: 500 },
  { unitOfMeasure: 'Pcs', description: '2" End Cap', quantity: 6, unitPriceMinor: 400 },
  { unitOfMeasure: 'Pcs', description: 'Era (B)', quantity: 10, unitPriceMinor: 7000 },
  { unitOfMeasure: 'Pcs', description: 'Workmanship', quantity: 1, unitPriceMinor: 800000 },
];
