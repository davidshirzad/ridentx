export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`BikeSignUp error ${response.status}`);

    const data = await response.json();
    console.log(`BikeSignUp raw races: ${(data.races || []).length}`);

    // Hard reject — clearly not cycling
    const REJECT = [
      '5k','10k','half marathon','marathon','fun run','color run','virtual run',
      'trail run','wod','crossfit','obstacle','mud run','spartan','tough mudder',
      'swim meet','triathlon','duathlon','aquathlon','paddle','kayak','canoe',
      'yoga','charity walk','fitness center','ruck','rucking','workout','weightlift'
    ];

    const isNotCycling = (name = '') => {
      const t = name.toLowerCase();
      return REJECT.some(kw => t.includes(kw));
    };

    const inferType = (name = '') => {
      const t = name.toLowerCase();
      if (t.includes('cyclocross') || t.includes(' cx ') || t.includes('cross')) return 'cx';
      if (t.includes('gravel') || t.includes('unpaved')) return 'gravel';
      if (t.includes('mountain') || t.includes(' mtb') || t.includes('trail')) return 'mtb';
      return 'road';
    };

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
      'bonham','mckinney','wichita falls','muenster','gainesville',
    ];

    const isNTX = (city = '') => {
      if (!city) return false;
      return NTX.some(k => city.toLowerCase().includes(k));
    };

    const races = data.races || [];
    const events = races
      .map(r => r.race)
      .filter(Boolean)
      .filter(r => !isNotCycling(r.name))
      .filter(r => isNTX(r.address?.city))
      .map(r => {
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
        return {
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
        };
      });

    console.log(`BikeSignUp after filtering: ${events.length} NTX cycling events`);

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeSignUp error:', err.message);
    return res.status(502).json({ error: 'BikeSignUp fetch failed', detail: err.message });
  }
}
