export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    // Only bike_race and bike_ride return results for TX — all other types return 0
    const [bikeRace, bikeRide] = await Promise.all([
      fetch(
        `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=bike_race`,
        { headers: { 'Accept': 'application/json' } }
      ).then(r => r.ok ? r.json() : { races: [] }).catch(() => ({ races: [] })),
      fetch(
        `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=bike_ride`,
        { headers: { 'Accept': 'application/json' } }
      ).then(r => r.ok ? r.json() : { races: [] }).catch(() => ({ races: [] }))
    ]);

    const allRaces = [
      ...(bikeRace.races || []),
      ...(bikeRide.races || [])
    ].map(r => r.race).filter(Boolean);

    console.log(`BikeSignUp raw: ${allRaces.length} TX races`);

    // Hard reject — clearly not cycling
    const REJECT = [
      'swim', 'triathlon', 'duathlon', 'aquathlon', 'open water',
      'wod', 'crossfit', 'obstacle', 'mud run', 'spartan', 'ruck',
      'fun run', 'walk', '5k', '10k', 'marathon', 'run/walk'
    ];

    const isNotCycling = (name = '') =>
      REJECT.some(kw => name.toLowerCase().includes(kw));

    // North Texas cities
    const NTX = [
      'dallas','fort worth','frisco','plano','mckinney','allen','garland',
      'irving','arlington','richardson','lewisville','denton','waxahachie',
      'weatherford','rockwall','rowlett','wylie','sherman','denison',
      'gainesville','decatur','mineral wells','granbury','corsicana',
      'celina','prosper','grapevine','southlake','flower mound','coppell',
      'cedar hill','mansfield','glen rose','cleburne','midlothian','ennis',
      'kaufman','terrell','forney','gunter','melissa','anna','fate',
      'royse city','heath','sunnyvale','sachse','duncanville','desoto',
      'grand prairie','mesquite','carrollton','bedford','hurst','euless',
      'keller','colleyville','argyle','justin','roanoke','greenville',
      'bonham','wichita falls','muenster','burleson','crowley','azle',
      'stephenville','highland village','addison','gatesville',
    ];

    const isNTX = (city = '') => {
      if (!city) return false;
      return NTX.some(k => city.toLowerCase().includes(k));
    };

    const inferType = (name = '') => {
      const t = name.toLowerCase();
      if (t.includes('cyclocross') || t.includes(' cx ')) return 'cx';
      if (t.includes('gravel')) return 'gravel';
      if (t.includes('mountain') || t.includes(' mtb')) return 'mtb';
      return 'road';
    };

    const seen = new Set();
    const events = [];

    allRaces
      .filter(r => !isNotCycling(r.name))
      .filter(r => isNTX(r.address?.city))
      .forEach(r => {
        if (seen.has(r.race_id)) return;
        seen.add(r.race_id);

        const addr = r.address || {};
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
          lat: parseFloat(addr.lat) || null,
          lng: parseFloat(addr.lng) || null,
          type: inferType(r.name),
          distances: dists.slice(0, 6),
          registrationUrl: r.url || `https://www.bikesignup.com/Race/${r.race_id}`,
          source: 'BikeSignUp'
        });
      });

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    console.log(`BikeSignUp final: ${events.length} NTX cycling events`);

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeSignUp error:', err.message);
    return res.status(502).json({ error: 'BikeSignUp fetch failed', detail: err.message });
  }
}
