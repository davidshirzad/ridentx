export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const query = `{
      upcomingAthleticEvents(
        appType: BIKEREG
        findArea: { latitude: 32.8968, longitude: -97.0403, radiusMiles: 150 }
        first: 200
      ) {
        nodes {
          eventId
          startDate
          city
          state
          latitude
          longitude
          athleticEvent {
            name
            eventUrl
            eventTypes
          }
        }
      }
    }`;

    const response = await fetch('https://outsideapi.com/fed-gw/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.bikereg.com',
        'Referer': 'https://www.bikereg.com/',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ query })
    });

    const text = await response.text();
    console.log('GraphQL status:', response.status);
    console.log('GraphQL response (first 500):', text.substring(0, 500));

    const json = JSON.parse(text);

    if (json.errors) {
      return res.status(200).json({
        events: [], count: 0,
        debug: { errors: json.errors },
        fetchedAt: new Date().toISOString()
      });
    }

    const nodes = json?.data?.upcomingAthleticEvents?.nodes || [];
    console.log(`GraphQL returned ${nodes.length} events near DFW`);

    const isNTX = (lat, lng) =>
      lat >= 31.5 && lat <= 34.5 && lng >= -98.5 && lng <= -96.0;

    const inferType = (eventTypes = []) => {
      const t = (eventTypes || []).join(' ').toLowerCase();
      if (t.includes('cyclocross') || t.includes('cx')) return 'cx';
      if (t.includes('gravel')) return 'gravel';
      if (t.includes('mountain') || t.includes('mtb')) return 'mtb';
      return 'road';
    };

    const events = nodes
      .filter(e => e.latitude && e.longitude && isNTX(e.latitude, e.longitude))
      .map(e => ({
        id: 'br-' + e.eventId,
        name: e.athleticEvent?.name || 'Untitled',
        date: e.startDate ? e.startDate.split('T')[0] : '',
        location: [e.city, e.state].filter(Boolean).join(', ') || 'North Texas',
        lat: e.latitude,
        lng: e.longitude,
        type: inferType(e.athleticEvent?.eventTypes),
        distances: [],
        registrationUrl: e.athleticEvent?.eventUrl || `https://www.bikereg.com/${e.eventId}`,
        source: 'BikeReg'
      }));

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeReg error:', err.message);
    return res.status(200).json({
      events: [], count: 0,
      debug: { error: err.message },
      fetchedAt: new Date().toISOString()
    });
  }
}
