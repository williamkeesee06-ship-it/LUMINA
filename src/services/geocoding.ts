const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface Coordinates {
  lat: number;
  lng: number;
}

const cache: Record<string, Coordinates> = JSON.parse(localStorage.getItem('lumina_geocode_cache') || '{}');

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!API_KEY) return null;
  if (cache[address]) return cache[address];

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results[0]) {
      const coords = data.results[0].geometry.location;
      cache[address] = coords;
      localStorage.setItem('lumina_geocode_cache', JSON.stringify(cache));
      return coords;
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};
