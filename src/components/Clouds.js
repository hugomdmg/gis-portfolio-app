
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function Clouds() {
    const cloudRef = useRef();

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,

            uniforms: {
                uTime: { value: 0 },
                uVisibility: { value: 1 }
            },

            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;

                    gl_Position =
                        projectionMatrix *
                        modelViewMatrix *
                        vec4(position, 1.0);
                }
            `,

            fragmentShader: `
                uniform float uTime;
                uniform float uVisibility;

                varying vec2 vUv;

                // Ruido pseudoaleatorio
                float hash(vec2 p) {
                    return fract(
                        sin(dot(p, vec2(127.1, 311.7))) *
                        43758.5453
                    );
                }

                // Ruido interpolado
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);

                    f = f * f * (3.0 - 2.0 * f);

                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));

                    return mix(
                        mix(a, b, f.x),
                        mix(c, d, f.x),
                        f.y
                    );
                }

                // Ruido fractal de varias octavas
                float fbm(vec2 p) {
                    float value = 0.0;
                    float amplitude = 0.5;

                    for (int i = 0; i < 6; i++) {
                        value += noise(p) * amplitude;

                        p *= 2.0;
                        amplitude *= 0.5;
                    }

                    return value;
                }

                // Combinación de escalas de nubes
                float cloudPattern(vec2 p) {
                    // Grandes masas
                    float large = fbm(p * 3.0);

                    // Formaciones medianas
                    float medium = fbm(p * 8.0);

                    // Pequeños detalles
                    float detail = fbm(p * 20.0);

                    return large * 0.55 +
                           medium * 0.30 +
                           detail * 0.15;
                }

                void main() {
                    vec2 uv = vUv;

                    // Movimiento lento
                    uv.x += uTime * 0.001;

                    // Reducir las nubes en los polos
                    float latitude =
                        abs(vUv.y - 0.5) * 2.0;

                    float polarFade =
                        1.0 - smoothstep(
                            0.72,
                            1.0,
                            latitude
                        );

                    // Coordenadas del patrón
                    vec2 cloudUV =
                        uv * vec2(10.0, 5.0);

                    // Generar las formaciones
                    float pattern =
                        cloudPattern(cloudUV);

                    // Definir las nubes
                    float clouds = smoothstep(
                        0.48,
                        0.65,
                        pattern
                    );

                    // Transparencia final
                    float alpha =
                        clouds *
                        polarFade *
                        0.65 *
                        uVisibility;

                    gl_FragColor = vec4(
                        vec3(1.0),
                        alpha
                    );
                }
            `
        });
    }, []);

    // Movimiento y desaparición según la distancia
    useFrame((state, delta) => {
        material.uniforms.uTime.value += delta;

        const distance =
            state.camera.position.length();

        // Nubes visibles a distancia
        // y transparentes al acercarse
        const visibility =
            THREE.MathUtils.smoothstep(
                distance,
                1.8,
                2.8
            );

        material.uniforms.uVisibility.value =
            visibility;

        // if (cloudRef.current) {
        //     cloudRef.current.rotation.y +=
        //         delta * 0.000;
        // }
    });

    return (
        <mesh
            ref={cloudRef}
            material={material}
        >
            <sphereGeometry
                args={[1.020, 256, 128]}
            />
        </mesh>
    );
}
