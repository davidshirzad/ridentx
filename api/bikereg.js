export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate = nextYear.toISOString().split('T')[0];

    const query = `{
      athleticEventCalendar(
        appType: BIKEREG
        location: { latitude: 32.8968, longitude: -97.0403 }
        radiusMiles: 150
        startDate: "${today}"
        endDate: "${endDate}"
        first: 200
      ) {
        nodes {
          eventId
          appType
          startDate
          city
          state
          latitude
          longitude
          athleticEvent {
            name
            staticUrl
            distanceString
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://www.bikereg.com',
        'Referer': 'https://www.bikereg.com/'
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

    const nodes = json?.data?.athleticEventCalendar?.nodes || [];
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
        distances: e.athleticEvent?.distanceString ? [e.athleticEvent.distanceString] : [],
        registrationUrl: e.athleticEvent?.staticUrl || `https://www.bikereg.com/${e.eventId}`,
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
