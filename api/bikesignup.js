// Simple city/state to lat/lng lookup for NTX cities
const CITY_COORDS = {
  'fort worth': [32.7555, -97.3308],
  'dallas': [32.7767, -96.7970],
  'frisco': [33.1507, -96.8236],
  'plano': [33.0198, -96.6989],
  'mckinney': [33.1972, -96.6397],
  'allen': [33.1032, -96.6705],
  'garland': [32.9126, -96.6389],
  'irving': [32.8140, -96.9489],
  'arlington': [32.7357, -97.1081],
  'richardson': [32.9483, -96.7299],
  'lewisville': [33.0462, -96.9942],
  'denton': [33.2148, -97.1331],
  'waxahachie': [32.3868, -96.8486],
  'weatherford': [32.7596, -97.7975],
  'rockwall': [32.9312, -96.4597],
  'rowlett': [32.9029, -96.5636],
  'wylie': [33.0151, -96.5388],
  'sherman': [33.6357, -96.6089],
  'denison': [33.7557, -96.5364],
  'gainesville': [33.6229, -97.1333],
  'decatur': [33.2343, -97.5836],
  'mineral wells': [32.8082, -98.1145],
  'granbury': [32.4424, -97.7941],
  'corsicana': [32.0954, -96.4689],
  'celina': [33.3251, -96.7836],
  'prosper': [33.2365, -96.8005],
  'grapevine': [32.9343, -97.0781],
  'southlake': [32.9412, -97.1341],
  'flower mound': [33.0146, -97.0969],
  'coppell': [32.9543, -97.0150],
  'cedar hill': [32.5882, -96.9561],
  'mansfield': [32.5632, -97.1417],
  'glen rose': [32.2321, -97.7528],
  'cleburne': [32.3501, -97.3864],
  'midlothian': [32.4824, -96.9939],
  'ennis': [32.3293, -96.6252],
  'kaufman': [32.5896, -96.3058],
  'terrell': [32.7357, -96.2750],
  'forney': [32.7479, -96.4694],
  'gunter': [33.4429, -96.7453],
  'melissa': [33.2851, -96.5705],
  'anna': [33.3487, -96.5483],
  'fate': [32.9418, -96.3836],
  'royse city': [32.9751, -96.3294],
  'heath': [32.8382, -96.4728],
  'sunnyvale': [32.7963, -96.5619],
  'sachse': [32.9763, -96.5880],
  'duncanville': [32.6518, -96.9081],
  'desoto': [32.5996, -96.8572],
  'grand prairie': [32.7460, -96.9978],
  'mesquite': [32.7668, -96.5992],
  'carrollton': [32.9537, -96.8903],
  'bedford': [32.8440, -97.1436],
  'hurst': [32.8232, -97.1886],
  'euless': [32.8371, -97.0819],
  'keller': [32.9343, -97.2294],
  'colleyville': [32.8882, -97.1505],
  'argyle': [33.1218, -97.1767],
  'justin': [33.0854, -97.2953],
  'roanoke': [33.0032, -97.2281],
  'greenville': [33.1384, -96.1108],
  'bonham': [33.5762, -96.1775],
  'wichita falls': [33.9137, -98.4934],
  'muenster': [33.6540, -97.3753],
  'burleson': [32.5421, -97.3208],
  'crowley': [32.5796, -97.3625],
  'azle': [32.8957, -97.5467],
  'stephenville': [32.2207, -98.2025],
  'highland village': [33.0918, -97.0561],
  'addison': [32.9618, -96.8297],
  'aubrey': [33.3026, -96.9886],
  'paris': [33.6609, -95.5555],
  'itasca': [32.1596, -97.1500],
  'gatesville': [31.4357, -97.7436],
  'crawford': [31.5307, -97.4478],
};

function getCoords(city = '') {
  const key = city.toLowerCase().trim();
  return CITY_COORDS[key] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    const eventTypes = [
      { param: 'bike_race',          type: 'road'   },
      { param: 'bike_ride',          type: 'road'   },
      { param: 'mountain_bike_race', type: 'mtb'    },
      { param: 'gravel_grinder',     type: 'gravel' },
      { param: 'fundraising_ride',   type: 'road'   },
    ];

    const results = await Promise.all(
      eventTypes.map(({ param }) =>
        fetch(
          `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&event_type=${param}&zipcode=75201&radius=100`,
          { headers: { 'Accept': 'application/json' } }
        )
        .then(r => r.ok ? r.json() : { races: [] })
        .catch(() => ({ races: [] }))
        .then(data => ({ param, races: data.races || [] }))
      )
    );

    const REJECT = [
      'swim', 'triathlon', 'duathlon', 'aquathlon', 'open water',
      'wod', 'crossfit', 'obstacle', 'mud run', 'spartan', 'ruck',
      'fun run', '5k', '10k', 'marathon', 'run/walk', 'running'
    ];

    const isNotCycling = (name = '') =>
      REJECT.some(kw => name.toLowerCase().includes(kw));

    const inferType = (name = '', defaultType = 'road') => {
      const t = name.toLowerCase();
      if (t.includes('cyclocross') || t.includes(' cx ')) return 'cx';
      if (t.includes('gravel')) return 'gravel';
      if (t.includes('mountain') || t.includes(' mtb') || t.includes('short track')) return 'mtb';
      return defaultType;
    };

    const seen = new Set();
    const events = [];

    results.forEach(({ param, races }) => {
      const defaultType = eventTypes.find(e => e.param === param)?.type || 'road';

      races
        .map(r => r.race)
        .filter(Boolean)
        .filter(r => !isNotCycling(r.name))
        .forEach(r => {
          if (seen.has(r.race_id)) return;
          seen.add(r.race_id);

          const addr = r.address || {};
          const coords = getCoords(addr.city);

          const dists = [];
          if (r.events) {
            const s = new Set();
            r.events.forEach(ev => {
              if (ev.distance) {
                const unit = ev.distance_unit === 'M' ? 'mi' : ev.distance_unit === 'K' ? 'km' : '';
                const l = `${ev.distance}${unit}`;
                if (!s.has(l)) { s.add(l); dists.push(l); }
              }
            });
          }

          events.push({
            id: 'bs-' + r.race_id,
            name: r.name || 'Untitled',
            date: r.next_date || '',
            location: [addr.city, addr.state].filter(Boolean).join(', ') || 'Texas',
            lat: coords ? coords[0] : null,
            lng: coords ? coords[1] : null,
            type: inferType(r.name, defaultType),
            distances: dists.slice(0, 6),
            registrationUrl: r.url || `https://www.bikesignup.com/Race/${r.race_id}`,
            source: 'BikeSignUp'
          });
        });
    });

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeSignUp error:', err.message);
    return res.status(502).json({ error: 'BikeSignUp fetch failed', detail: err.message });
  }
}
