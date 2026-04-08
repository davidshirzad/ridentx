export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    // Correct event_type enum values + zipcode/radius for DFW (75201 = Dallas)
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

    results.forEach(({ param, races }) => {
      console.log(`BikeSignUp ${param}: ${races.length} races within 100mi of Dallas`);
    });

    // Hard reject — clearly not cycling
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
            type: inferType(r.name, defaultType),
            distances: dists.slice(0, 6),
            registrationUrl: r.url || `https://www.bikesignup.com/Race/${r.race_id}`,
            source: 'BikeSignUp'
          });
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
