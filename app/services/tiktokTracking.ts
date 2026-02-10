// app/services/tiktokTracking.ts
// Server-side TikTok Events API tracking (replaces native SDK)

const TIKTOK_ACCESS_TOKEN = 'd1614240f596ce446d69a60585580df155071a6f';
const TIKTOK_PIXEL_ID = 'D5T5S1RC77UDQTF8AVJ0';
const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

export async function trackTikTokInstall(userId: string) {
  try {
    console.log('TikTok API Request:', {
      url: TIKTOK_API_URL,
      event: 'InstallApp',
      userId,
      timestamp: Math.floor(Date.now() / 1000)
    });

    const response = await fetch(TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: [{
          event: 'InstallApp',
          event_time: Math.floor(Date.now() / 1000),
          user: {
            external_id: userId
          }
        }]
      })
    });

    const responseText = await response.text();
    console.log('TikTok API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} - ${responseText}`);
    }

    console.log('TikTok InstallApp tracked successfully');
  } catch (error) {
    console.error('TikTok tracking error:', error);
    throw error;
  }
}

export async function trackTikTokPurchase(
  userId: string,
  price: number,
  currency: string = 'USD',
  contentId?: string
) {
  try {
    console.log('TikTok API Request:', {
      url: TIKTOK_API_URL,
      event: 'Purchase',
      userId,
      price,
      currency,
      contentId,
      timestamp: Math.floor(Date.now() / 1000)
    });

    const response = await fetch(TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: [{
          event: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          user: {
            external_id: userId
          },
          properties: {
            value: price,
            currency: currency,
            content_id: contentId
          }
        }]
      })
    });

    const responseText = await response.text();
    console.log('TikTok API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} - ${responseText}`);
    }

    console.log('TikTok Purchase tracked successfully:', price, currency);
  } catch (error) {
    console.error('TikTok tracking error:', error);
    throw error;
  }
}

export async function trackTikTokRegistration(userId: string, method: string) {
  try {
    console.log('TikTok API Request:', {
      url: TIKTOK_API_URL,
      event: 'CompleteRegistration',
      userId,
      method,
      timestamp: Math.floor(Date.now() / 1000)
    });

    const response = await fetch(TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: [{
          event: 'CompleteRegistration',
          event_time: Math.floor(Date.now() / 1000),
          user: {
            external_id: userId
          },
          properties: {
            registration_method: method
          }
        }]
      })
    });

    const responseText = await response.text();
    console.log('TikTok API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} - ${responseText}`);
    }

    console.log('TikTok CompleteRegistration tracked successfully');
  } catch (error) {
    console.error('TikTok tracking error:', error);
    throw error;
  }
}
