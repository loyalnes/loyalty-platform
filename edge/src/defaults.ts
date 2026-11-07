// Settings every new merchant starts with. For the test deployment each account gets the same Google
// review link, so the "leave a review" step always opens a real Google review form.
// The place id is derived from the 0x…:0x… pair in the link's Maps URL (see placeIdFromHexPair).
export const DEFAULT_GOOGLE_MAPS_URL = "https://maps.app.goo.gl/723pLZsn1SxV3Szh8";
export const DEFAULT_GOOGLE_PLACE_ID = "ChIJtVhYzbQpQg0R9EylsGYiAX8";

export const DEFAULT_SETTINGS = JSON.stringify({
  googleMapsUrl: DEFAULT_GOOGLE_MAPS_URL,
  googlePlaceId: DEFAULT_GOOGLE_PLACE_ID,
});
