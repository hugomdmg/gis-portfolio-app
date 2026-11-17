
import {
    useMemo,
    useRef,
    useState
} from "react";

import {
    Canvas,
    useFrame
} from "@react-three/fiber";

import {
    OrbitControls,
    Html
} from "@react-three/drei";

import * as THREE from "three";

import useTerrainTiles from "../hooks/useTerrainTiles";
import { Clouds } from "./Clouds";

const SEA = new THREE.Color("#0878c9");
const LOW = new THREE.Color("#398b45");
const HIGH = new THREE.Color("#b8a078");
const SNOW = new THREE.Color("#ffffff");

const LOD = {
    0: { size: 30, maxX: 12, maxY: 4 },
    1: { size: 10, maxX: 36, maxY: 12 },
    2: { size: 2, maxX: 180, maxY: 60 }
};

// Determinar el nivel según la distancia.
function getLOD(distance) {
    if (distance > 4.5) return 0;
    if (distance > 2) return 1;
    return 2;
}

// Calcular las teselas visibles.
function getVisibleTiles(camera) {
    const distance = camera.position.length();
    const level = getLOD(distance);
    const config = LOD[level];

    const direction = camera.position.clone().normalize();

    const halfFov = THREE.MathUtils.degToRad(
        camera.fov / 2
    );

    const viewAngle =
        Math.asin(
            Math.min(1, distance * Math.sin(halfFov))
        ) -
        halfFov +
        THREE.MathUtils.degToRad(6);

    const visible = [];

    for (let y = 0; y < config.maxY; y++) {
        for (let x = 0; x < config.maxX; x++) {
            const size = config.size;

            const lon = -180 + (x + 0.5) * size;
            const lat = -60 + (y + 0.5) * size;

            const lonRad = THREE.MathUtils.degToRad(lon);
            const latRad = THREE.MathUtils.degToRad(lat);

            const normal = new THREE.Vector3(
                Math.cos(latRad) * Math.cos(lonRad),
                Math.sin(latRad),
                -Math.cos(latRad) * Math.sin(lonRad)
            );

            const angle = Math.acos(
                THREE.MathUtils.clamp(
                    direction.dot(normal),
                    -1,
                    1
                )
            );

            const tileRadius = THREE.MathUtils.degToRad(
                size * Math.SQRT2 / 2
            );

            if (angle <= viewAngle + tileRadius) {
                visible.push(`${level}_${x}_${y}`);
            }
        }
    }

    return visible;
}

// Obtener el padre de una tesela.
function getParentKey(level, x, y) {
    if (level === 1) {
        return `0_${Math.floor(x / 3)}_${Math.floor(y / 3)}`;
    }

    if (level === 2) {
        return `1_${Math.floor(x / 5)}_${Math.floor(y / 5)}`;
    }

    return null;
}

// Elegir las teselas más detalladas disponibles.
function getRenderKeys(activeKeys, loadedTiles) {
    const renderKeys = new Set();

    for (const key of activeKeys) {
        const [level, x, y] = key.split("_").map(Number);

        if (loadedTiles[key]) {
            renderKeys.add(key);
            continue;
        }

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

            if (loadedTiles[parentKey]) {
                renderKeys.add(parentKey);
                break;
            }

            [currentLevel, currentX, currentY] =
                parentKey.split("_").map(Number);
        }
    }

    return [...renderKeys];
}

// Crear la geometría de una tesela.
function TerrainTile({ tile }) {
    const geometry = useMemo(() => {
        const {
            elevations,
            width,
            height,
            bounds,
            level = 0
        } = tile;

        const positions = [];
        const colors = [];
        const indices = [];

        for (let row = 0; row <= height; row++) {
            for (let col = 0; col <= width; col++) {
                const sampleRow = Math.min(row, height - 1);
                const sampleCol = Math.min(col, width - 1);

                const elevation = elevations[sampleRow][sampleCol];

                const h =
                    elevation !== null && Number.isFinite(elevation)
                        ? elevation
                        : 0;

                const lon =
                    bounds.min_lon +
                    (col / width) *
                    (bounds.max_lon - bounds.min_lon);

                const lat =
                    bounds.max_lat -
                    (row / height) *
                    (bounds.max_lat - bounds.min_lat);

                const baseRadius =
                    h > 0
                        ? 1 + (h / 6355) * 0.08
                        : 1;

                // Pequeño desplazamiento para evitar conflictos
                // entre las superficies de diferentes niveles.
                const radius =
                    baseRadius + level * 0.00015;

                const phi = THREE.MathUtils.degToRad(
                    90 - lat
                );

                const theta = THREE.MathUtils.degToRad(
                    lon + 180
                );

                const px =
                    -radius * Math.sin(phi) * Math.cos(theta);

                const py =
                    radius * Math.cos(phi);

                const pz =
                    radius * Math.sin(phi) * Math.sin(theta);

                positions.push(px, py, pz);

                let color;

                if (elevation === null || elevation <= 0) {
                    color = SEA;
                } else if (h < 1500) {
                    color = LOW.clone().lerp(
                        HIGH,
                        h / 1500
                    );
                } else if (h < 3500) {
                    color = HIGH.clone().lerp(
                        SNOW,
                        (h - 1500) / 2000
                    );
                } else {
                    color = SNOW;
                }

                colors.push(
                    color.r,
                    color.g,
                    color.b
                );
            }
        }

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const a = row * (width + 1) + col;
                const b = a + width + 1;

                indices.push(a, b, a + 1);
                indices.push(b, b + 1, a + 1);
            }
        }

        const geo = new THREE.BufferGeometry();

        geo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
                positions,
                3
            )
        );

        geo.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(
                colors,
                3
            )
        );

        geo.setIndex(indices);
        geo.computeVertexNormals();

        return geo;
    }, [tile]);

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial
                vertexColors
                roughness={1}
                metalness={0}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// Escena del globo.
function GlobeScene() {
    const [activeKeys, setActiveKeys] = useState([]);

    const previousView = useRef(null);

    const {
        loadedTiles,
        error
    } = useTerrainTiles(activeKeys);

    useFrame(({ camera }) => {
        const distance = camera.position.length();

        const direction = camera.position
            .clone()
            .normalize();

        const level = getLOD(distance);

        const previous = previousView.current;

        if (previous) {
            const sameLevel = previous.level === level;

            const sameDistance =
                Math.abs(previous.distance - distance) < 0.08;

            const sameDirection =
                previous.direction.dot(direction) > 0.999;

            if (
                sameLevel &&
                sameDistance &&
                sameDirection
            ) {
                return;
            }
        }

        previousView.current = {
            level,
            distance,
            direction
        };

        const visible = getVisibleTiles(camera);

        setActiveKeys(previousKeys => {
            if (
                previousKeys.length === visible.length &&
                previousKeys.every(key =>
                    visible.includes(key)
                )
            ) {
                return previousKeys;
            }

            return visible;
        });
    });

    const renderKeys = getRenderKeys(
        activeKeys,
        loadedTiles
    );

    const visibleLoaded = activeKeys.filter(
        key => loadedTiles[key]
    );

    const progress = activeKeys.length
        ? Math.round(
            (visibleLoaded.length / activeKeys.length) * 100
        )
        : 0;

    return (
        <>
            <ambientLight intensity={1.5} />

            <directionalLight
                position={[5, 3, 5]}
                intensity={2}
            />

            {/* Esfera oceánica de fondo */}
            <mesh>
                <sphereGeometry args={[0.999, 180, 90]} />
                <meshStandardMaterial
                    color="#0878c9"
                    roughness={1}
                    metalness={0}
                />
            </mesh>

            {/* Teselas de terreno */}
            {renderKeys.map(key => (
                <TerrainTile
                    key={key}
                    tile={loadedTiles[key]}
                />
            ))}
            <Clouds/>

            <OrbitControls
                enableRotate
                enableZoom
                enablePan={false}
                minDistance={1.3}
                maxDistance={6}
                // rotateSpeed={0.7}
                zoomSpeed={0.8}
            />

            <Html position={[0, 1.3, 0]} center>
                <div className="terrain-loading">
                    {error
                        ? `Error: ${error}`
                        : `LOD ${activeKeys.length
                            ? activeKeys[0].split("_")[0]
                            : "-"
                        } · ${progress}%`
                    }

                    <br />

                    {renderKeys.length} teselas renderizadas

                    <br />

                    {visibleLoaded.length} / {activeKeys.length} teselas actuales
                </div>
            </Html>
        </>
    );
}

export default function Globe() {
    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#07111f"
            }}
        >
            <Canvas
                camera={{
                    position: [0, 0, 3],
                    fov: 45
                }}
            >
                <GlobeScene />
            </Canvas>
        </div>
    );
}
