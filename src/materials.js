import * as THREE from 'three';

// Shared by every creature and prop: the colour things fade into as they go deeper.
export const water = {
  uWaterColor: { value: new THREE.Color(0x0c3a42) },
};

// MeshStandardMaterial that melts into the water colour with depth below y = 0.
export function underwaterMaterial(params = {}) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, ...params });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterColor = water.uWaterColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMurkY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMurkY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uWaterColor;\nvarying float vMurkY;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float murk = clamp((-0.4 - vMurkY) / 16.0, 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uWaterColor, sqrt(murk) * 0.92);`,
      );
  };
  material.customProgramCacheKey = () => 'underwater';
  return material;
}

// Bakes per-vertex colours from a function of position.
export function paintGeometry(geometry, colorFn) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
