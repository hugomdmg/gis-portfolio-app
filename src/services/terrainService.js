
const API_URL = "http://localhost:8000";

const cache = new Map();
const pending = new Map();

export async function loadTile(level, tileX, tileY) {
  const key = `${level}_${tileX}_${tileY}`;

  // Utilizar caché si ya está descargada.
  if (cache.has(key)) {
    return cache.get(key);
  }

  // Evitar solicitudes duplicadas.
  if (pending.has(key)) {
    return pending.get(key);
  }

  const request = fetch(
    `${API_URL}/terrain/lod/${level}/${tileX}/${tileY}`
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(
          `Error descargando tesela ${key}: ${response.status}`
        );
      }

      return response.json();
    })
    .then(data => {
      // Guardamos también el nivel LOD.
      const tile = {
        ...data,
        level
      };

      cache.set(key, tile);

      return tile;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);

  return request;
}

export function getTileCacheSize() {
  return cache.size;
}

export function clearTileCache() {
  cache.clear();
}

export function getCachedTile(level, tileX, tileY) {
  return cache.get(`${level}_${tileX}_${tileY}`) || null;
}
