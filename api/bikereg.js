export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    // Use BikeReg's GraphQL API (newer, more reliable than REST)
    const query = `
      query {
        searchEvents(
          appType: BIKEREG
          state: "TX"
          withinDays: 365
          limit: 200
        ) {
          id
          eventId
          name
          city
          state
          startDate
          latitude
          longitude
          distanceString
          url
        }
      }
    `;

    const response = await fetch('https://outsideapi.com/fed-gw/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ query })
    });

    // If GraphQL fails, fall back to REST with no state filter + NTX city matching
    if (!response.ok) throw new Error('GraphQL failed');

    const json = await response.json();
    const rawEvents = json?.data?.searchEvents || [];

    console.log(`BikeReg GraphQL returned ${rawEvents.length} TX events`);

    const NTX = [
      'dallas','fort worth','frisco','plano','mckinney','allen','garland',
      'irving','arlington','ri
