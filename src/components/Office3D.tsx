"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Maqueta 3D del centre (una sola planta, vista isomètrica com les altres oficines de la lola).
// Al fons, les 3 cabines seguides amb la llitera i llum tènue; davant, el passadís,
// la recepció amb el taulell on seu l'Aura (l'agent de WhatsApp), plantes i la sala d'espera.

export type Look = "diana" | "montsant" | "client" | "aura" | "other";

export interface SceneCabin {
  roomId: number;
  title: string;
  subtitle?: string;
  occupied: boolean;
  pending?: boolean;
  clientName?: string;
  treatment?: string;
  color?: string;
  proName?: string;
  proLook?: Look;
  aptId?: number;
}

export interface ScenePerson {
  key: string;
  name: string;
  detail?: string;
  look: Look;
}

export interface OfficeSceneData {
  cabins: SceneCabin[]; // en ordre: Cabina 1, 2, 3
  freePros: ScenePerson[];
  waiting: ScenePerson[];
  pendingCount: number;
}

interface Props {
  data: OfficeSceneData;
  onCabinClick?: (cabin: SceneCabin) => void;
  onAuraClick?: () => void;
}

// ---------- Plànol (metres) ----------
const W = 30; // ample total
const CAB_D = 8; // fons de les cabines
const PASS_Z1 = 10.4; // final del passadís
const D = 17.5; // fons total
const ALTO = 1.3; // parets tallades, com una maqueta
const CABS = [0, 1, 2].map((i) => ({ x0: i * 10, x1: (i + 1) * 10, xc: i * 10 + 5 }));
const CAMILLA = { z: 3.4 }; // centre de la llitera
const DESK = { x: 7.5, z: 13.2 }; // taulell de recepció
const SOFA = { x: 24.5, z: 16.2 };

const LOOKS: Record<Look, { ropa: number; pelo: number; piel: number; pant: number; largo: boolean; ulleres?: boolean }> = {
  diana: { ropa: 0xf6f2ec, pelo: 0xeee8de, piel: 0xf0cfb2, pant: 0x3b3430, largo: true },
  montsant: { ropa: 0xf6f2ec, pelo: 0x5a3a26, piel: 0xe3b590, pant: 0x3b3430, largo: true, ulleres: true },
  client: { ropa: 0xd9c4a8, pelo: 0x7a5236, piel: 0xe8bf9c, pant: 0x6f6a72, largo: true },
  aura: { ropa: 0x25a865, pelo: 0x8e6cc8, piel: 0xf1d0b4, pant: 0x2f2b36, largo: true },
  other: { ropa: 0xc06a44, pelo: 0x3a2618, piel: 0xd9a77f, pant: 0x3b3430, largo: false },
};

export function Office3D({ data, onCabinClick, onAuraClick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ setData: (d: OfficeSceneData) => void; rotate: (a: number) => void; center: () => void } | null>(null);
  const currentData = useRef<OfficeSceneData | null>(null);
  const cbRef = useRef({ onCabinClick, onAuraClick });
  useEffect(() => {
    cbRef.current = { onCabinClick, onAuraClick };
  });

  // Muntar l'escena un sol cop
  useEffect(() => {
    const host = hostRef.current!, canvas = canvasRef.current!, labels = labelsRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      labels.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-sm text-stone-300 p-6 text-center">Aquest navegador no pot mostrar la vista 3D.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x221b17);

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = 1.15;
    controls.enableZoom = false; // la roda del ratolí ha de fer scroll de la pàgina
    controls.enablePan = false;
    const TARGET = new THREE.Vector3(W / 2, 0, D / 2);
    const HOME = new THREE.Vector3(-14, 26, 30);
    camera.position.copy(TARGET.clone().add(HOME));
    controls.target.copy(TARGET);

    const fit = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      const aspect = r.width / r.height;
      const h = Math.max(20, 35 / aspect);
      camera.left = (-h * aspect) / 2;
      camera.right = (h * aspect) / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    fit();

    // ---------- Llums: suau i càlida ----------
    const hemi = new THREE.HemisphereLight(0xf3e6d6, 0x3a2e26, 0.75);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe7cc, 1.0);
    sun.position.set(-8, 30, 26);
    sun.target.position.set(W / 2, 0, D / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);

    // ---------- Materials i textures ----------
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const canvasTex = (w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      paint(c.getContext("2d")!, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const TEX = {
      roure: canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#b8916a";
        g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 32)
          for (let x = ((y / 32) % 2) * 64; x < w + 128; x += 128) {
            g.fillStyle = `hsl(30, 34%, ${50 + rnd() * 8}%)`;
            g.fillRect(x, y + 1, 126, 30);
          }
      }),
      cabina: canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#9c7a5c";
        g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 32)
          for (let x = ((y / 32) % 2) * 64; x < w + 128; x += 128) {
            g.fillStyle = `hsl(26, 28%, ${40 + rnd() * 6}%)`;
            g.fillRect(x, y + 1, 126, 30);
          }
      }),
      pedra: canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = "#d8cfc2";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1400; i++) {
          g.fillStyle = `rgba(80,60,40,${rnd() * 0.06})`;
          g.fillRect(rnd() * w, rnd() * h, 2, 2);
        }
        g.strokeStyle = "rgba(120,100,80,.15)";
        g.strokeRect(0, 0, w, h);
      }),
      catifa: canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = "#c9b79c";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1600; i++) {
          g.fillStyle = `rgba(255,255,255,${rnd() * 0.08})`;
          g.fillRect(rnd() * w, rnd() * h, 1, 1);
        }
      }),
    };
    Object.values(TEX).forEach((t) => (t.wrapS = t.wrapT = THREE.RepeatWrapping));

    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.03, ...extra });
    const M = {
      paret: mat(0xeee5d8),
      canto: mat(0xa8957e),
      vidre: new THREE.MeshStandardMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.22, roughness: 0.1 }),
      marc: mat(0x4a3f37, { metalness: 0.4, roughness: 0.45 }),
      fusta: mat(0x8a5d3b),
      fustaClara: mat(0xc9a47a),
      marbre: mat(0xf3efe9, { roughness: 0.35 }),
      blanc: mat(0xf7f4ef),
      llitera: mat(0xefe6da, { roughness: 0.7 }),
      potes: mat(0xb9b2a8, { metalness: 0.6, roughness: 0.35 }),
      negre: mat(0x1d1a18),
      test: mat(0xd9cdbd),
      testFosc: mat(0x6b5a4c),
      fulla: mat(0x5f7d4a),
      fulla2: mat(0x7a9660),
      sofa: mat(0xb9a58c),
      coixi: mat(0xd8c8b0),
      llum: new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc27a, emissiveIntensity: 2.2 }),
      espelma: new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffb860, emissiveIntensity: 1.4 }),
      tovallola: mat(0xf2ece3, { roughness: 0.95 }),
    };

    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, shadow = true) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = shadow;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, seg = 16) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    const ball = (r: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
      const o = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    const group = (x: number, z: number, rot = 0, parent: THREE.Object3D = scene) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      parent.add(g);
      return g;
    };
    const floor = (x0: number, x1: number, z0: number, z1: number, tex: THREE.Texture, y = 0) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set((x1 - x0) / 4, (z1 - z0) / 4);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      m.receiveShadow = true;
      scene.add(m);
    };
    // Paret amb forats de porta (posicions al llarg de la paret, porta d'1,4 m)
    const wall = (x0: number, z0: number, x1: number, z1: number, glass = false, gaps: number[] = [], gapW = 1.4) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const horiz = z0 === z1;
      const parts: [number, number][] = [];
      let start = 0;
      for (const g of [...gaps].sort((a, b) => a - b)) {
        parts.push([start, g - gapW / 2]);
        start = g + gapW / 2;
      }
      parts.push([start, len]);
      for (const [a, b] of parts) {
        if (b - a < 0.05) continue;
        const c = (a + b) / 2, l = b - a;
        const x = horiz ? Math.min(x0, x1) + c : x0;
        const z = horiz ? z0 : Math.min(z0, z1) + c;
        if (glass) {
          box(horiz ? l : 0.06, 1.1, horiz ? 0.06 : l, M.vidre, x, 0.55, z, scene, false);
          box(horiz ? l : 0.08, 0.04, horiz ? 0.08 : l, M.marc, x, 0.02, z);
        } else {
          box(horiz ? l : 0.18, ALTO, horiz ? 0.18 : l, M.paret, x, ALTO / 2, z);
          box(horiz ? l : 0.2, 0.04, horiz ? 0.2 : l, M.canto, x, ALTO + 0.02, z, scene, false);
        }
      }
    };
    const plant = (x: number, z: number, h = 1.1, potMat = M.test) => {
      cyl(0.26, 0.2, 0.46, potMat, x, 0.23, z);
      for (let k = 0; k < 6; k++) {
        const o = ball(0.24 + rnd() * 0.12, k % 2 ? M.fulla : M.fulla2, x + (rnd() - 0.5) * 0.36, 0.5 + h * (0.3 + rnd() * 0.5), z + (rnd() - 0.5) * 0.36);
        o.scale.y = 1.3;
      }
    };
    const smallPlant = (x: number, y: number, z: number) => {
      cyl(0.09, 0.07, 0.14, M.test, x, y + 0.07, z);
      for (let k = 0; k < 4; k++) ball(0.07 + rnd() * 0.03, k % 2 ? M.fulla : M.fulla2, x + (rnd() - 0.5) * 0.1, y + 0.2 + rnd() * 0.08, z + (rnd() - 0.5) * 0.1);
    };
    const floorText = (text: string, x: number, z: number, w: number, color = "rgba(70,50,35,.75)") => {
      const tex = canvasTex(1024, 96, (g, cw, ch) => {
        g.clearRect(0, 0, cw, ch);
        g.font = '600 44px "Inter", "Segoe UI", sans-serif';
        g.fillStyle = color;
        g.textBaseline = "middle";
        g.fillText(text.toUpperCase(), 10, ch / 2);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 96) / 1024), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.012, z);
      scene.add(m);
    };

    // ---------- Edifici ----------
    box(W + 0.6, 0.4, D + 0.6, mat(0x3a2f28), W / 2, -0.21, D / 2, scene, false);
    for (const c of CABS) floor(c.x0, c.x1, 0, CAB_D, TEX.cabina, 0.002);
    floor(0, W, CAB_D, PASS_Z1, TEX.pedra, 0.001);
    floor(0, 19, PASS_Z1, D, TEX.roure, 0.001);
    floor(19, W, PASS_Z1, D, TEX.catifa, 0.001);
    // Perímetre
    wall(0, 0, W, 0);
    wall(0, 0, 0, D);
    wall(W, 0, W, D);
    wall(0, D, W, D, true, [DESK.x + 0.5], 2.2); // aparador de vidre amb la porta d'entrada
    // Cabines: parets entre elles i cap al passadís amb porta
    for (const c of CABS) {
      if (c.x0 > 0) wall(c.x0, 0, c.x0, CAB_D);
      wall(c.x0, CAB_D, c.x1, CAB_D, false, [c.xc + 2.6 - c.x0]);
    }
    // Sala d'espera separada amb vidre
    wall(19, PASS_Z1, 19, D, true, [1.6], 1.6);
    // Estora d'entrada
    box(2.0, 0.02, 1.0, mat(0x6b5a4c), DESK.x + 0.5, 0.012, D - 0.7, scene, false);

    // ---------- Cabines: llitera, tamboret, carro, prestatge, llum tènue ----------
    const sheets: THREE.MeshStandardMaterial[] = [];
    const cabinLights: THREE.PointLight[] = [];
    CABS.forEach((c, i) => {
      const g = group(c.xc, CAMILLA.z);
      // Llitera (al llarg de l'eix x)
      box(2.1, 0.16, 0.8, M.llitera, 0, 0.72, 0, g);
      box(2.0, 0.05, 0.74, M.tovallola, 0, 0.82, 0, g);
      box(0.4, 0.1, 0.6, M.blanc, -0.78, 0.87, 0, g); // coixí
      for (const sx of [-0.85, 0.85]) for (const sz of [-0.3, 0.3]) cyl(0.035, 0.035, 0.64, M.potes, sx, 0.32, sz, g, 8);
      // Llençol del color del tractament (es pinta quan hi ha clienta)
      const sheet = mat(0xe6dccd, { roughness: 0.95 });
      sheets.push(sheet);
      const sh = box(1.15, 0.05, 0.84, sheet, 0.35, 0.86, 0, g);
      sh.name = "sheet";
      // Tamboret de la professional
      cyl(0.22, 0.22, 0.08, M.negre, -0.2, 0.55, 1.15, g, 16);
      cyl(0.03, 0.03, 0.5, M.potes, -0.2, 0.28, 1.15, g, 8);
      // Carro amb productes
      const k = group(c.x1 - 1.3, 1.2);
      box(0.7, 0.04, 0.5, M.blanc, 0, 0.85, 0, k);
      box(0.7, 0.04, 0.5, M.blanc, 0, 0.45, 0, k);
      for (const sx of [-0.32, 0.32]) for (const sz of [-0.22, 0.22]) cyl(0.02, 0.02, 0.85, M.potes, sx, 0.43, sz, k, 6);
      const colors = [0xd8b4a0, 0xb7c4a5, 0xe8d6b8, 0xc9a0a0];
      colors.forEach((col, j) => cyl(0.05, 0.05, 0.16 + (j % 2) * 0.06, mat(col, { roughness: 0.4 }), -0.22 + j * 0.15, 0.96, -0.05, k, 10));
      // Toalles enrotllades al prestatge de la paret del fons
      box(2.2, 0.06, 0.4, M.fustaClara, c.x0 + 2.2, 1.0, 0.3);
      for (let j = 0; j < 5; j++) {
        const t = cyl(0.09, 0.09, 0.36, M.tovallola, c.x0 + 1.35 + j * 0.38, 1.12, 0.3, scene, 10);
        t.rotation.x = Math.PI / 2;
      }
      // Tauleta amb espelmes i llum càlida
      box(0.6, 0.6, 0.5, M.fusta, c.x0 + 1.0, 0.3, CAB_D - 1.2);
      cyl(0.04, 0.04, 0.1, M.espelma, c.x0 + 0.85, 0.65, CAB_D - 1.25, scene, 10);
      cyl(0.04, 0.04, 0.14, M.espelma, c.x0 + 1.05, 0.67, CAB_D - 1.15, scene, 10);
      cyl(0.04, 0.04, 0.08, M.espelma, c.x0 + 1.2, 0.64, CAB_D - 1.3, scene, 10);
      // Làmpada de terra
      cyl(0.02, 0.02, 1.5, M.marc, c.x1 - 0.6, 0.75, 0.6, scene, 6);
      const lampada = cyl(0.22, 0.28, 0.32, M.llum, c.x1 - 0.6, 1.6, 0.6, scene, 16);
      lampada.castShadow = false;
      const pl = new THREE.PointLight(0xffb366, 9, 9, 1.4);
      pl.position.set(c.xc, 2.6, CAMILLA.z + 0.6);
      scene.add(pl);
      cabinLights.push(pl);
      // Planta a la cantonada
      plant(c.x1 - 0.6, CAB_D - 0.7, 0.9, M.testFosc);
      // Nom de la cabina a terra
      floorText(`Cabina ${i + 1}`, c.x0 + 0.5 + 1.6, CAB_D - 0.45, 3.2);
    });

    // ---------- Recepció ----------
    // Taulell en L, de fusta amb sobre de marbre i el nom del centre al davant
    const rec = group(DESK.x, DESK.z);
    box(4.2, 1.05, 0.6, M.fusta, 0, 0.525, 0.25, rec);
    box(4.4, 0.06, 0.8, M.marbre, 0, 1.08, 0.2, rec);
    box(0.6, 1.05, 1.6, M.fusta, 2.1, 0.525, -0.5, rec);
    box(0.8, 0.06, 1.8, M.marbre, 2.1, 1.08, -0.5, rec);
    box(4.0, 0.06, 0.55, M.fustaClara, 0, 0.75, -0.25, rec); // taula de treball de dins
    const sign = canvasTex(1024, 160, (g, w, h) => {
      g.fillStyle = "#7a5134";
      g.fillRect(0, 0, w, h);
      g.font = 'italic 600 78px Georgia, "Times New Roman", serif';
      g.fillStyle = "#f3e2c4";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("Estètica Diana", w / 2, h / 2 + 4);
    });
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.53), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 }));
    signM.position.set(0, 0.6, 0.56);
    rec.add(signM);
    // Pantalla de l'Aura amb el WhatsApp
    const chat = canvasTex(256, 170, (g, w, h) => {
      g.fillStyle = "#efe7dc";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1f9d57";
      g.fillRect(0, 0, w, 22);
      const bub = (x: number, y: number, bw: number, c: string) => {
        g.fillStyle = c;
        g.beginPath();
        g.roundRect(x, y, bw, 22, 8);
        g.fill();
      };
      bub(10, 34, 140, "#ffffff");
      bub(100, 64, 146, "#d6f5c9");
      bub(10, 94, 120, "#ffffff");
      bub(116, 124, 130, "#d6f5c9");
    });
    const monitor = group(-0.6, -0.3, Math.PI, rec);
    box(0.95, 0.6, 0.05, M.negre, 0, 1.15, 0, monitor);
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.53),
      new THREE.MeshStandardMaterial({ map: chat, emissive: 0xffffff, emissiveMap: chat, emissiveIntensity: 0.55 })
    );
    scr.position.set(0, 1.15, -0.03);
    scr.rotation.y = Math.PI;
    monitor.add(scr);
    box(0.06, 0.3, 0.06, M.potes, 0, 0.92, 0.03, monitor);
    // Cadira de l'Aura
    const ch = group(-0.6, -0.95, 0, rec);
    box(0.5, 0.08, 0.5, mat(0x6a5545), 0, 0.5, 0, ch);
    box(0.5, 0.55, 0.07, mat(0x6a5545), 0, 0.82, -0.24, ch);
    cyl(0.03, 0.03, 0.45, M.potes, 0, 0.24, 0, ch, 8);
    // Flors, telèfon i targetes al taulell
    smallPlant(DESK.x - 1.8, 1.11, DESK.z + 0.3);
    smallPlant(DESK.x + 2.1, 1.11, DESK.z - 1.1);
    box(0.22, 0.05, 0.14, M.negre, DESK.x + 0.8, 1.13, DESK.z + 0.25);
    box(0.3, 0.03, 0.2, M.blanc, DESK.x + 1.3, 1.12, DESK.z + 0.3);
    // Llums penjants damunt del taulell
    for (const dx of [-1.2, 0.2, 1.6]) {
      cyl(0.008, 0.008, 1.0, M.negre, DESK.x + dx, 2.7, DESK.z + 0.1, scene, 4);
      const b = ball(0.14, M.llum, DESK.x + dx, 2.15, DESK.z + 0.1);
      b.castShadow = false;
    }
    const recLight = new THREE.PointLight(0xffd29a, 22, 14, 1.4);
    recLight.position.set(DESK.x, 3, DESK.z + 0.6);
    scene.add(recLight);
    // Plantes de la recepció
    plant(0.7, PASS_Z1 + 0.7, 1.3);
    plant(0.7, D - 0.7, 1.4);
    plant(DESK.x + 3.3, D - 0.7, 1.2);
    plant(17.8, D - 0.7, 1.3);
    plant(17.8, PASS_Z1 + 0.7, 1.0);
    // Prestatge de productes a la venda
    const shelf = group(14.5, D - 0.35, 0);
    box(3.0, 1.6, 0.4, M.fustaClara, 0, 0.8, 0, shelf);
    for (let r = 0; r < 3; r++)
      for (let j = 0; j < 7; j++)
        cyl(0.06, 0.06, 0.18, mat([0xe8d6b8, 0xd8b4a0, 0xb7c4a5, 0xf3efe9][(r + j) % 4], { roughness: 0.4 }), -1.2 + j * 0.4, 0.45 + r * 0.5, -0.25, shelf, 10);

    // ---------- Sala d'espera ----------
    const sofa = group(SOFA.x, SOFA.z, 0);
    box(4.2, 0.42, 0.9, M.sofa, 0, 0.21, 0, sofa);
    box(4.2, 0.6, 0.25, M.sofa, 0, 0.6, 0.42, sofa);
    for (let k = 0; k < 3; k++) box(1.3, 0.12, 0.7, M.coixi, (k - 1) * 1.38, 0.48, -0.05, sofa);
    box(0.25, 0.6, 0.9, M.sofa, -2.1, 0.4, 0, sofa);
    box(0.25, 0.6, 0.9, M.sofa, 2.1, 0.4, 0, sofa);
    // Tauleta amb revistes
    cyl(0.6, 0.6, 0.06, M.fustaClara, SOFA.x, 0.45, SOFA.z - 1.5, scene, 24);
    cyl(0.05, 0.05, 0.42, M.potes, SOFA.x, 0.22, SOFA.z - 1.5, scene, 8);
    box(0.4, 0.02, 0.3, mat(0xc06a44), SOFA.x - 0.15, 0.49, SOFA.z - 1.55);
    box(0.4, 0.02, 0.3, mat(0x7c8c6b), SOFA.x + 0.2, 0.5, SOFA.z - 1.4);
    smallPlant(SOFA.x + 0.05, 0.48, SOFA.z - 1.75);
    plant(W - 0.7, PASS_Z1 + 0.7, 1.4);
    plant(W - 0.7, D - 0.7, 1.2);
    plant(19.8, D - 0.7, 1.0);
    // Dispensador d'aigua
    box(0.4, 1.1, 0.4, M.blanc, W - 0.6, 0.55, PASS_Z1 + 2.2);
    cyl(0.16, 0.16, 0.45, new THREE.MeshStandardMaterial({ color: 0x9fd0e6, transparent: true, opacity: 0.6 }), W - 0.6, 1.33, PASS_Z1 + 2.2, scene, 14);
    floorText("Sala d'espera", 20.0 + 1.5, PASS_Z1 + 0.5, 3.0);
    floorText("Recepció", 1.2 + 1.2, PASS_Z1 + 0.5, 2.4);

    // ---------- Persones ----------
    const people = new THREE.Group();
    scene.add(people);
    type Animated = { body: THREE.Group; arms: THREE.Group[]; mode: "massage" | "type" | "idle" | "sit" | "lie"; phase: number };
    let animated: Animated[] = [];

    const makePerson = (look: Look) => {
      const L = LOOKS[look];
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);
      const ropa = mat(L.ropa, { roughness: 0.75 }), piel = mat(L.piel, { roughness: 0.6 }), pelo = mat(L.pelo, { roughness: 0.9 }), pant = mat(L.pant);
      const legs = [-0.11, 0.11].map((sx) => {
        const p = new THREE.Group();
        p.position.set(sx, 0.92, 0);
        body.add(p);
        cyl(0.075, 0.065, 0.86, pant, 0, -0.43, 0, p, 10);
        box(0.12, 0.08, 0.26, M.negre, 0, -0.88, -0.05, p);
        return p;
      });
      box(0.36, 0.16, 0.22, pant, 0, 0.95, 0, body);
      const torso = cyl(0.2, 0.17, 0.58, ropa, 0, 1.3, 0, body, 14);
      torso.scale.z = 0.7;
      ball(0.1, ropa, -0.2, 1.53, 0, body).scale.set(1, 0.8, 0.8);
      ball(0.1, ropa, 0.2, 1.53, 0, body).scale.set(1, 0.8, 0.8);
      const arms = [-0.24, 0.24].map((sx) => {
        const b = new THREE.Group();
        b.position.set(sx, 1.52, 0);
        body.add(b);
        cyl(0.055, 0.048, 0.56, ropa, 0, -0.28, 0, b, 10);
        ball(0.05, piel, 0, -0.6, 0, b);
        return b;
      });
      cyl(0.05, 0.055, 0.1, piel, 0, 1.64, 0, body, 10);
      const head = ball(0.125, piel, 0, 1.8, 0, body);
      head.scale.set(0.92, 1.08, 0.98);
      ball(0.133, pelo, 0, 1.84, 0.015, body).scale.set(0.95, 0.95, 1);
      if (L.largo) box(0.24, 0.3, 0.1, pelo, 0, 1.7, 0.1, body);
      if (L.ulleres) {
        box(0.07, 0.05, 0.02, M.negre, -0.05, 1.8, -0.125, body);
        box(0.07, 0.05, 0.02, M.negre, 0.05, 1.8, -0.125, body);
      }
      if (look === "aura") {
        const hs = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 24, Math.PI), M.negre);
        hs.position.set(0, 1.84, 0);
        hs.rotation.z = 0;
        body.add(hs);
        box(0.04, 0.08, 0.06, M.negre, -0.14, 1.8, 0, body);
        box(0.04, 0.08, 0.06, M.negre, 0.14, 1.8, 0, body);
        const mic = box(0.02, 0.02, 0.14, M.negre, -0.12, 1.72, -0.08, body);
        mic.rotation.y = -0.4;
      }
      return { root, body, legs, arms };
    };

    const cabinHit: THREE.Object3D[] = [];
    const labelEls: { el: HTMLElement; pos: THREE.Vector3 }[] = [];
    const clearPeople = () => {
      people.clear();
      animated = [];
      labelEls.forEach((l) => l.el.remove());
      labelEls.length = 0;
      cabinHit.length = 0;
    };
    const addLabel = (html: string, pos: THREE.Vector3, cls: string, onClick?: () => void) => {
      const el = document.createElement("div");
      el.className = `office-label ${cls}`;
      el.innerHTML = html;
      if (onClick) {
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.addEventListener("click", onClick);
      }
      labels.appendChild(el);
      labelEls.push({ el, pos });
    };
    const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

    const setData = (d: OfficeSceneData) => {
      clearPeople();
      d.cabins.slice(0, 3).forEach((cab, i) => {
        const c = CABS[i];
        const sheet = sheets[i];
        const light = cabinLights[i];
        light.intensity = cab.occupied ? 16 : 6;
        sheet.color.set(cab.occupied && cab.color ? cab.color : 0xe6dccd);
        if (cab.occupied) {
          // Clienta estirada a la llitera, amb el cap al coixí
          const cl = makePerson("client");
          cl.body.rotation.x = -Math.PI / 2;
          cl.root.position.set(c.xc + 0.95, 0.98, CAMILLA.z);
          cl.root.rotation.y = Math.PI / 2;
          cl.arms.forEach((a) => (a.rotation.x = 0.05));
          people.add(cl.root);
          // La professional de peu al costat de la llitera, mirant-la
          const pr = makePerson(cab.proLook || "other");
          pr.root.position.set(c.xc - 0.1, 0, CAMILLA.z + 0.85);
          people.add(pr.root);
          animated.push({ body: pr.body, arms: pr.arms, mode: "massage", phase: i * 1.7 });
          const open = () => cbRef.current.onCabinClick?.(cab);
          const dot = `<i style="background:${esc(cab.color || "#E67C73")}"></i>`;
          addLabel(
            `${dot}<b>${esc(cab.clientName || "")}</b><span class="t">${esc(cab.treatment || "")}</span><em>${esc(cab.proName || "")}</em>`,
            new THREE.Vector3(c.xc, 2.25, CAMILLA.z + 0.3),
            cab.pending ? "pending" : "",
            open
          );
        } else {
          addLabel(`<span>Lliure</span>`, new THREE.Vector3(c.xc, 1.2, CAMILLA.z), "free");
        }
      });

      // Professionals lliures: al passadís, davant la seva cabina habitual
      d.freePros.forEach((p, i) => {
        const pr = makePerson(p.look);
        const x = 11.5 + i * 1.6, z = (CAB_D + PASS_Z1) / 2;
        pr.root.position.set(x, 0, z);
        pr.root.rotation.y = Math.PI;
        people.add(pr.root);
        animated.push({ body: pr.body, arms: pr.arms, mode: "idle", phase: i });
        addLabel(`<b>${esc(p.name)}</b>${p.detail ? `<span>${esc(p.detail)}</span>` : ""}`, new THREE.Vector3(x, 2.15, z), "pro");
      });

      // Aura asseguda al taulell
      const au = makePerson("aura");
      au.root.position.set(DESK.x - 0.6, 0, DESK.z - 0.95);
      au.root.rotation.y = Math.PI;
      au.body.position.y = -0.44;
      au.legs.forEach((l) => (l.rotation.x = Math.PI / 2));
      people.add(au.root);
      animated.push({ body: au.body, arms: au.arms, mode: "type", phase: 0 });
      const n = d.pendingCount;
      addLabel(
        `<i style="background:#25D366"></i><b>Aura</b><span>${n ? `${n} per confirmar` : "Tot al dia"}</span>`,
        new THREE.Vector3(DESK.x - 0.6, 2.0, DESK.z - 0.95),
        n ? "aura alert" : "aura",
        () => cbRef.current.onAuraClick?.()
      );

      // Clientes a la sala d'espera, assegudes al sofà
      d.waiting.slice(0, 3).forEach((w, i) => {
        const cl = makePerson("client");
        const x = SOFA.x + (i - 1) * 1.38;
        cl.root.position.set(x, 0, SOFA.z - 0.1);
        cl.body.position.y = -0.4;
        cl.legs.forEach((l) => (l.rotation.x = Math.PI / 2));
        cl.arms.forEach((a) => (a.rotation.x = 0.35));
        people.add(cl.root);
        animated.push({ body: cl.body, arms: cl.arms, mode: "sit", phase: i * 2 });
        addLabel(`<b>${esc(w.name)}</b>${w.detail ? `<span>${esc(w.detail)}</span>` : ""}`, new THREE.Vector3(x, 1.6, SOFA.z - 0.1), "wait");
      });
    };

    // ---------- Bucle ----------
    const v = new THREE.Vector3();
    let raf = 0;
    let anim: { t0: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
    const loop = (now: number) => {
      const t = now / 1000;
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / 700);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        camera.position.lerpVectors(anim.from, anim.to, e);
        if (k >= 1) anim = null;
      }
      const mv = reduced ? 0 : 1;
      for (const a of animated) {
        if (a.mode === "massage") {
          const s = Math.sin(t * 2.2 + a.phase) * 0.12 * mv;
          a.arms[0].rotation.x = 0.95 + s;
          a.arms[1].rotation.x = 0.95 - s;
          a.body.rotation.x = -0.12;
        } else if (a.mode === "type") {
          const s = Math.sin(t * 12 + a.phase) * 0.05 * mv;
          a.arms[0].rotation.x = 1.1 + s;
          a.arms[1].rotation.x = 1.1 - s;
        } else if (a.mode === "idle") {
          a.arms[1].rotation.x = 0.2 + Math.sin(t * 0.8 + a.phase) * 0.1 * mv;
          a.body.position.y = Math.sin(t * 1.3 + a.phase) * 0.006 * mv;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      const r = host.getBoundingClientRect();
      for (const l of labelEls) {
        v.copy(l.pos).project(camera);
        const out = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
        l.el.style.display = out ? "none" : "flex";
        l.el.style.left = `${((v.x + 1) / 2) * r.width}px`;
        l.el.style.top = `${((1 - v.y) / 2) * r.height}px`;
        l.el.style.zIndex = String(Math.round((1 - v.z) * 1000));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Clic a una cabina (a la maqueta) obre la cita
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return;
      if (hit.z >= 0 && hit.z <= CAB_D) {
        const i = Math.floor(hit.x / 10);
        const cab = currentData.current?.cabins[i];
        if (cab?.occupied) cbRef.current.onCabinClick?.(cab);
      } else if (Math.abs(hit.x - DESK.x) < 2.6 && Math.abs(hit.z - DESK.z) < 1.4) {
        cbRef.current.onAuraClick?.();
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    apiRef.current = {
      setData: (d) => {
        currentData.current = d;
        setData(d);
      },
      rotate: (a) => {
        const off = camera.position.clone().sub(controls.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        anim = { t0: performance.now(), from: camera.position.clone(), to: controls.target.clone().add(off) };
      },
      center: () => {
        anim = { t0: performance.now(), from: camera.position.clone(), to: TARGET.clone().add(HOME) };
      },
    };
    if (currentData.current) apiRef.current.setData(currentData.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      controls.dispose();
      clearPeople();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mm = m.material as THREE.Material | THREE.Material[];
          (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      apiRef.current = null;
    };
  }, []);

  // Quan canvien les dades, es tornen a col·locar les persones
  const sig = JSON.stringify(data);
  useEffect(() => {
    currentData.current = data;
    apiRef.current?.setData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <div ref={hostRef} className="relative w-full rounded-2xl overflow-hidden border border-stone-700 bg-[#221b17] aspect-[16/10] max-sm:aspect-square">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      <div className="absolute right-2.5 top-2.5 flex gap-1.5">
        <button onClick={() => apiRef.current?.rotate(-Math.PI / 4)} className="office-btn" title="Girar a l'esquerra">⟲</button>
        <button onClick={() => apiRef.current?.rotate(Math.PI / 4)} className="office-btn" title="Girar a la dreta">⟳</button>
        <button onClick={() => apiRef.current?.center()} className="office-btn">Centrar</button>
      </div>
      <p className="absolute left-3 bottom-2.5 text-[10px] text-stone-400">Arrossega per girar · toca una cabina per obrir la cita</p>
    </div>
  );
}
