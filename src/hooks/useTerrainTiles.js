
import { useEffect, useRef, useState } from "react";
import { loadTile } from "../services/terrainService";

function getParentKey(level, x, y) {
  if (level === 1) {
    return `0_${Math.floor(x / 3)}_${Math.floor(y / 3)}`;
  }

  if (level === 2) {
    return `1_${Math.floor(x / 5)}_${Math.floor(y / 5)}`;
  }

  return null;
}

export default function useTerrainTiles(activeKeys) {
  const [loadedTiles, setLoadedTiles] = useState({});
  const [error, setError] = useState(null);

  const loadedTilesRef = useRef({});
  const activeRequestRef = useRef(0);

  useEffect(() => {
    loadedTilesRef.current = loadedTiles;
  }, [loadedTiles]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++activeRequestRef.current;

    async function downloadTiles() {
      setError(null);

      const required = new Set();

      // Añadir las teselas actuales y todos sus padres.
      for (const key of activeKeys) {
        const [level, x, y] = key.split("_").map(Number);

        required.add(key);

        let currentLevel = level;
        let currentX = x;
        let currentY = y;

        while (currentLevel > 0) {
          const parentKey = getParentKey(
            currentLevel,
            currentX,
            currentY
          );

          if (!parentKey) break;

          required.add(parentKey);

          [currentLevel, currentX, currentY] =
            parentKey.split("_").map(Number);
        }
      }

      // Primero descargar los niveles de menor resolución.
      const queue = [...required].sort((a, b) => {
        const levelA = Number(a.split("_")[0]);
        const levelB = Number(b.split("_")[0]);

        return levelA - levelB;
      });

      let cursor = 0;

      async function worker() {
        while (!cancelled && cursor < queue.length) {
          const key = queue[cursor++];

          if (loadedTilesRef.current[key]) {
            continue;
          }

          const [level, x, y] = key.split("_").map(Number);

          try {
            const tile = await loadTile(level, x, y);

            if (
              cancelled ||
              requestId !== activeRequestRef.current
            ) {
              return;
            }

            setLoadedTiles(previous => ({
              ...previous,
              [key]: tile
            }));

            loadedTilesRef.current[key] = tile;

          } catch (err) {
            if (!cancelled) {
              setError(err.message);
            }
          }
        }
      }

      const workers = Math.min(4, queue.length);

      await Promise.all(
        Array.from({ length: workers }, () => worker())
      );
    }

    downloadTiles();

    return () => {
      cancelled = true;
    };
  }, [activeKeys]);

  return {
    loadedTiles,
    error
  };
}
