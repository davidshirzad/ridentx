export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  try {
    // Introspect the exact fields for EventDistanceFilterInput and AthleticEventSearchContainer
    const query = `{
      distInput: __type(name: "EventDistanceFilterInput") {
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
      container: __type(name: "AthleticEventSearchContainer") {
        fields {
          name
          type { name kind ofType { name kind } }
        }
      }
      event: __type(name: "AthleticEvent") {
        fields {
          name
          type { name kind ofType { name kind } }
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

    const json = await response.json();
    return res.status(200).json(json);

  } catch(err) {
    return res.status(200).json({ error: err.message });
  }
}
