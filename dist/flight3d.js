import * as THREE from "./assets/vendor/three.module.js";

const hero = document.querySelector(".hero-section");
const smooth = (value) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function createAircraft() {
  const aircraft = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x7e8b9e, metalness: 0.48, roughness: 0.37, envMapIntensity: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb4becb, metalness: 0.65, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b1622, roughness: 0.42, metalness: 0.15 });
  const fanMetal = new THREE.MeshStandardMaterial({ color: 0x394756, roughness: 0.56, metalness: 0.6 });
  function mesh(geometry, material = skin, parent = aircraft) {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  // Closed rigid surfaces keep the wings and fins from behaving like warped images.
  function surface(points, offset, material = skin) {
    const normal = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(new THREE.Vector3(...points[1]), new THREE.Vector3(...points[0])),
      new THREE.Vector3().subVectors(new THREE.Vector3(...points[2]), new THREE.Vector3(...points[0]))
    );
    if (normal.dot(new THREE.Vector3(...offset)) < 0) points = [...points].reverse();
    const positions = [];
    const append = (a, b, c) => positions.push(...a, ...b, ...c);
    const back = points.map((point) => point.map((value, axis) => value + offset[axis]));
    for (let i = 1; i < points.length - 1; i++) {
      append(points[0], points[i + 1], points[i]);
      append(back[0], back[i], back[i + 1]);
    }
    points.forEach((point, i) => {
      const next = (i + 1) % points.length;
      append(point, points[next], back[next]);
      append(point, back[next], back[i]);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  }
  const profile = [[0, -20], [0.35, -18.8], [1.05, -15.5], [1.55, -11], [1.8, -5], [1.8, 9], [1.76, 12], [1.6, 14], [1.22, 16], [0.67, 17.5], [0.2, 18.1], [0, 18.2]];
  const profileCurve = new THREE.CatmullRomCurve3(profile.map(([r, z]) => new THREE.Vector3(r, z, 0)));
  const roundedProfile = profileCurve.getPoints(180).map(point => new THREE.Vector2(Math.max(0, point.x), point.y));
  const fuselage = mesh(new THREE.LatheGeometry(roundedProfile, 80));
  fuselage.rotation.x = Math.PI / 2;
  function radiusAt(z) {
    const index = roundedProfile.findIndex(point => point.y >= z);
    const a = roundedProfile[Math.max(0, index - 1)], b = roundedProfile[Math.max(0, index)];
    return THREE.MathUtils.lerp(a.x, b.x, (z - a.y) / (b.y - a.y || 1));
  }
  function bodyPoint(sign, angle, z, offset = 0.025) {
    const r = radiusAt(z) + offset;
    return [sign * Math.sin(angle) * r, Math.cos(angle) * r, z];
  }
  function windshield(sign, from, to, front, back) {
    const positions = [], indices = [], steps = 8;
    for (let row = 0; row <= steps; row++) {
      for (let col = 0; col <= steps; col++) {
        positions.push(...bodyPoint(sign, THREE.MathUtils.lerp(from, to, col / steps), THREE.MathUtils.lerp(front - 0.12 * col / steps, back, row / steps), 0.035));
      }
    }
    for (let row = 0; row < steps; row++) {
      for (let col = 0; col < steps; col++) {
        const a = row * (steps + 1) + col, b = a + 1, d = a + steps + 1, c = d + 1;
        indices.push(...(sign > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, dark);
  }
  // A rounded airfoil section, rather than a flat polygon, gives highlights a real leading edge.
  function wing(sign) {
    const positions = [], indices = [], sections = 16, chordSteps = 24;
    const ringSize = chordSteps * 2;
    for (let s = 0; s <= sections; s++) {
      const span = s / sections;
      const chord = THREE.MathUtils.lerp(8.4, 1.55, span);
      for (let j = 0; j < ringSize; j++) {
        const upper = j <= chordSteps;
        const t = upper ? j / chordSteps : (ringSize - j) / chordSteps;
        const c = (1 - Math.cos(t * Math.PI)) / 2;
        const thickness = (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c ** 2 + 0.2843 * c ** 3 - 0.1036 * c ** 4) * chord * 0.42;
        positions.push(sign * (1.25 + 17.1 * span), -0.5 + span * 1.1 + (upper ? thickness : -thickness), 4.2 - 11.1 * span - c * chord);
      }
    }
    for (let s = 0; s < sections; s++) {
      for (let j = 0; j < ringSize; j++) {
        const a = s * ringSize + j, b = a + ringSize;
        const d = s * ringSize + (j + 1) % ringSize, c = d + ringSize;
        indices.push(...(sign > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry);
  }
  // A lathe runs along Y; after rotation its nose points down the positive Z axis.
  for (const sign of [-1, 1]) {
    wing(sign);
    surface([[sign * 18.3, 0.55, -6.9], [sign * 18.8, 2.4, -7.8], [sign * 18.9, 2.65, -8.6], [sign * 18.35, 0.55, -8.45]], [sign * 0.045, 0, 0]);
    surface([[sign * 0.6, 0.4, -12.5], [sign * 7, 0.8, -17], [sign * 7.2, 0.8, -18.8], [sign * 0.5, 0.4, -17.4]], [0, 0.14, 0]);
    surface([[sign * 7.1, -0.15, 0.5], [sign * 7.9, -0.15, -3], [sign * 7.9, -2.6, -1], [sign * 7.1, -2.6, 2]], [sign * 0.14, 0, 0]);
    const engine = new THREE.Group();
    engine.position.set(sign * 7.6, -2.25, 2.5);
    aircraft.add(engine);
    const nacelle = mesh(new THREE.LatheGeometry([[0.8, -2.6], [1.04, -1.7], [1.24, 0.9], [1.27, 1.65], [1.15, 2], [0.96, 1.85]].map(([r, z]) => new THREE.Vector2(r, z)), 48), skin, engine);
    nacelle.rotation.x = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(1.09, 0.13, 12, 48), trim, engine);
    ring.position.z = 1.85;
    const intake = mesh(new THREE.CircleGeometry(0.98, 48), dark, engine);
    intake.position.z = 1.64;
    const fan = new THREE.Group();
    fan.position.z = 1.7;
    engine.add(fan);
    for (let i = 0; i < 20; i++) {
      const blade = mesh(new THREE.BoxGeometry(0.06, 0.66, 0.035), fanMetal, fan);
      const angle = i * Math.PI * 2 / 20;
      blade.position.set(Math.sin(angle) * 0.51, Math.cos(angle) * 0.51, 0);
      blade.rotation.z = -angle + 0.22;
    }
    const spinner = mesh(new THREE.ConeGeometry(0.23, 0.4, 24), trim, engine);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 1.8;
    for (let z = -12; z < 12; z += 0.78) {
      const window = mesh(new THREE.SphereGeometry(1, 12, 10), dark);
      window.scale.set(0.04, 0.16, 0.11);
      window.position.set(sign * Math.sqrt(Math.max(0, radiusAt(z) ** 2 - 0.58 ** 2)), 0.58, z);
    }
    for (const [from, to, front, back] of [[3, 30, 16.7, 15.6], [34, 61, 16.45, 15.25], [65, 82, 15.9, 14.95]]) {
      const a = THREE.MathUtils.degToRad(from), b = THREE.MathUtils.degToRad(to);
      windshield(sign, a, b, front, back);
    }
  }
  surface([[-0.09, 1.3, -10.5], [-0.09, 7.1, -17], [-0.09, 7.3, -19], [-0.09, 1, -18.3]], [0.18, 0, 0]);
  aircraft.userData.fans = aircraft.children.filter((item) => item.type === "Group").map((engine) => engine.children.find((item) => item.type === "Group")).filter(Boolean);
  return aircraft;
}

export function createFlightScene(hero) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "flight-scene";
  renderer.domElement.setAttribute("aria-hidden", "true");
  hero.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8794a8, 0.0045);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 700);
  const aircraft = createAircraft();
  scene.add(aircraft);
  scene.add(new THREE.HemisphereLight(0xc9d6eb, 0x253449, 2.1));
  const sun = new THREE.DirectionalLight(0xe0e9f5, 2.8);
  sun.position.set(35, 50, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 130 });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const loader = new THREE.TextureLoader();
  let environment;
  let disposed = false;
  loader.load(new URL("./assets/pristine-skies-clouds-4k.webp", import.meta.url).href, (texture) => {
    if (disposed) { texture.dispose(); return; }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    environment = texture;
    scene.environment = texture;
  });
  // Transparent fractal cloud sheets surround the flight path instead of hiding a cutout.
  const cloudMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, dissolve: { value: 0 } },
    vertexShader: "varying vec2 uvCloud; void main(){uvCloud=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 uvCloud; uniform float time; uniform float dissolve;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=uvCloud*5.0+vec2(time*.025,0);float n=0.0,a=.5;
      for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+3.7;a*=.5;}
      float edge=smoothstep(0.0,.28,uvCloud.x)*smoothstep(0.0,.28,1.0-uvCloud.x)*smoothstep(0.0,.22,uvCloud.y)*smoothstep(0.0,.22,1.0-uvCloud.y);
      float alpha=smoothstep(.34,.7,n)*edge*.38*(1.0-dissolve);
      gl_FragColor=vec4(mix(vec3(.34,.4,.5),vec3(.7,.76,.84),n),alpha);}`
  });
  for (let i = 0; i < 5; i++) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(95, 35), cloudMaterial);
    cloud.position.set(i % 2 ? -20 : 24, -7 + i * 2, -15 - i * 38);
    scene.add(cloud);
  }
  let raf = 0;
  let startTime = 0;
  let duration = 6400;
  let running = false;
  let originY = 0;
  let lastProgress = 0;
  function resize() {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    const distance = Math.max(42 / camera.aspect, 29) / (2 * Math.tan(THREE.MathUtils.degToRad(18)));
    originY = distance * 0.1;
    camera.position.set(0, distance * 0.24, distance);
    camera.lookAt(0, originY, 0);
    camera.setViewOffset(rect.width, rect.height, 0, -rect.height * (camera.aspect < 1 ? 0.075 : 0.035), rect.width, rect.height);
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
    if (hero.classList.contains("flight-3d-active") && !running) drawFrame(lastProgress);
  }
  resize();
  window.addEventListener("resize", resize);
  function drawFrame(progress) {
    if (disposed) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    lastProgress = p;
    const turn = smooth(p / 0.55);
    const departure = Math.max(0, (p - 0.12) / 0.88);
    aircraft.rotation.set(0.03 + 0.06 * turn, -0.38 - (Math.PI - 0.38) * turn, -0.3 * Math.sin(turn * Math.PI));
    aircraft.position.set(-4 * Math.sin(turn * Math.PI), originY - 1 + 4 * departure, -340 * departure ** 2);
    aircraft.userData.fans.forEach((fan) => { fan.rotation.z = p * duration * 0.02; });
    cloudMaterial.uniforms.time.value = p * duration / 1000;
    cloudMaterial.uniforms.dissolve.value = 0.5 * smooth(p);
    renderer.render(scene, camera);
    renderer.domElement.dataset.depth = aircraft.position.z.toFixed(1);
    renderer.domElement.dataset.progress = p.toFixed(3);
    renderer.domElement.style.opacity = String(1 - smooth((p - 0.8) / 0.2));
  }
  function render(now) {
    const p = Math.min((now - startTime) / duration, 1);
    drawFrame(p);
    if (running && p < 1) raf = requestAnimationFrame(render);
  }
  return {
    // Fixed frames support repeatable visual regression checks without a running clock.
    seek(progress) {
      running = false;
      cancelAnimationFrame(raf);
      hero.classList.add("flight-3d-active");
      drawFrame(progress);
    },
    start(reduced) {
      if (disposed) return false;
      duration = reduced ? 3500 : 6400;
      startTime = performance.now();
      running = true;
      hero.classList.add("flight-3d-active");
      render(startTime);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      scene.traverse((item) => { item.geometry?.dispose(); });
      const materials = new Set();
      scene.traverse((item) => { if (item.material) materials.add(item.material); });
      materials.forEach((material) => material.dispose());
      environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

if (hero && !hero.hidden && !hero.hasAttribute("data-flight-preview")) {
  try { window.PristineFlight3D = createFlightScene(hero); }
  catch (error) { console.warn("3D flight unavailable; using depth fade.", error); }
}
