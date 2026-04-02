const OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup";

interface OpenElevationResult {
  latitude: number;
  longitude: number;
  elevation: number;
}

interface OpenElevationResponse {
  results: OpenElevationResult[];
}

export async function fetchElevation(lat: number, lng: number): Promise<number> {
  const url = `${OPEN_ELEVATION_URL}?locations=${lat},${lng}`;
  const contact = process.env.NOMINATIM_CONTACT ?? "unknown";

  let res: Response;
  try {
    console.log(url)
    res = await fetch(url, {
      headers: {
        "User-Agent": `grow-zone-app (${contact})`,
      },
    });
  } catch (err) {
    throw new Error(`fetchElevation: network request failed for (${lat}, ${lng}): ${err}`);
  }

  if (!res.ok) {
    throw new Error(`fetchElevation: HTTP ${res.status} for (${lat}, ${lng})`);
  }

  let body: OpenElevationResponse;
  try {
    body = (await res.json()) as OpenElevationResponse;
  } catch {
    throw new Error(`fetchElevation: failed to parse JSON response for (${lat}, ${lng})`);
  }

  const elevation = body?.results?.[0]?.elevation;
  if (typeof elevation !== "number") {
    throw new Error(
      `fetchElevation: malformed response for (${lat}, ${lng}) — expected results[0].elevation to be a number, got ${JSON.stringify(body)}`
    );
  }

  return elevation;
}
