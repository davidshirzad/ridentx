export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    // Try the simplest possible call first — no filters except state
    const url = 'https://www.bikereg.com/api/search?state=TX&format=json';
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const text = await response.text();
    console.log('BikeReg status:', response.status);
    console.log('BikeReg raw response (first 500 chars):', text.substring(0, 500));

    if (!response.ok) {
      return res.status(200).json({ 
        events: [], 
        count: 0, 
        debug: { status: response.status, body: text.substring(0, 500) },
        fetchedAt: new Date().toISOString() 
      });
    }

    const data = JSON.parse(text);
    const raw = data.data || data.events || data || [];
    
    console.log('BikeReg total events returned:', Array.isArray(raw) ? raw.length : typeof raw);

    return res.status(200).json({ 
      events: [], 
      count: 0,
      debug: { 
        totalReturned: Array.isArray(raw) ? raw.length : 0,
        sampleEvent: Array.isArray(raw) && raw.length > 0 ? raw[0] : null,
        keys: data ? Object.keys(data) : []
      },
      fetchedAt: new Date().toISOString() 
    });

  } catch(err) {
    console.error('BikeReg error:', err.message);
    return res.status(200).json({ 
      events: [], 
      count: 0, 
      debug: { error: err.message },
      fetchedAt: new Date().toISOString() 
    });
  }
}
