import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const exporter = new GLTFExporter();

function createMuscularModel() {
  const group = new THREE.Group();
  group.name = 'muscular';

  const muscleMaterial = new THREE.MeshStandardMaterial({
    color: 0xcc4444,
    roughness: 0.8,
    metalness: 0.1
  });

  const muscleData = [
    { name: 'Biceps_brachii', position: [15, 25, 0], rotation: [0, 0, 0], scale: [3, 12, 3] },
    { name: 'Triceps_brachii', position: [-15, 25, 0], rotation: [0, 0, 0], scale: [3, 12, 3] },
    { name: 'Deltoid', position: [0, 38, 0], rotation: [0, 0, 0], scale: [8, 6, 6] },
    { name: 'Pectoralis_major', position: [0, 20, 10], rotation: [0, 0, 0], scale: [12, 8, 4] },
    { name: 'Latissimus_dorsi', position: [0, 10, -8], rotation: [0, 0, 0], scale: [14, 12, 4] },
    { name: 'Trapezius', position: [0, 35, -2], rotation: [0, 0, 0], scale: [12, 8, 6] },
    { name: 'Rectus_abdominis', position: [0, 5, 8], rotation: [0, 0, 0], scale: [4, 18, 3] },
    { name: 'External_oblique', position: [8, 5, 5], rotation: [0, 0, 0], scale: [6, 18, 3] },
    { name: 'Femur', position: [0, -20, 0], rotation: [0, 0, 0], scale: [4, 30, 4] },
    { name: 'Tibia', position: [0, -45, 0], rotation: [0, 0, 0], scale: [3, 25, 3] }
  ];

  muscleData.forEach(data => {
    const geometry = new THREE.CapsuleGeometry(data.scale[0], data.scale[1], 8, 16);
    const mesh = new THREE.Mesh(geometry, muscleMaterial.clone());
    mesh.name = data.name;
    mesh.position.set(...data.position);
    mesh.rotation.set(...data.rotation);
    mesh.userData = { originalName: data.name, system: 'muscular' };
    group.add(mesh);
  });

  return group;
}

async function generate() {
  console.log('Creating muscular model...');
  const muscular = createMuscularModel();
  console.log(`Muscular model: ${muscular.children.length} meshes`);

  console.log('Exporting muscular.glb...');
  const result = await new Promise((resolve, reject) => {
    exporter.parse(muscular, resolve, reject, { binary: true });
  });

  console.log('Export result type:', typeof result);
  console.log('Export result constructor:', result?.constructor?.name);
  console.log('Export result keys:', result ? Object.keys(result).slice(0, 20) : 'null');
  console.log('Has slice:', typeof result?.slice);
  console.log('ByteLength:', result?.byteLength ?? result?.size ?? 'unknown');

  // Try to save as file
  try {
    const fs = await import('fs');
    let buffer;
    if (ArrayBuffer.isView(result)) {
      buffer = Buffer.from(result.buffer || result);
    } else if (result instanceof ArrayBuffer) {
      buffer = Buffer.from(result);
    } else if (result?.slice) {
      buffer = Buffer.from(result.slice(0));
    } else {
      buffer = Buffer.from(JSON.stringify(result));
    }
    fs.writeFileSync('public/models/muscular.glb', buffer);
    console.log('muscular.glb saved, size:', buffer.length);
  } catch (e) {
    console.log('Save error:', e.message);
    console.log('Result preview:', result);
  }
}

generate().catch(console.error);
