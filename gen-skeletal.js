import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

const exporter = new GLTFExporter();

function createSkeletalModel() {
  const group = new THREE.Group();
  group.name = 'skeletal';

  const boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f0e1,
    roughness: 0.9,
    metalness: 0.0
  });

  const bones = [
    { name: 'Skull', position: [0, 42, 0], scale: [8, 8, 8], type: 'sphere' },
    { name: 'Vertebral_column', position: [0, 5, 0], scale: [2, 40, 2], type: 'capsule' },
    { name: 'Rib_cage', position: [0, 20, 0], scale: [14, 12, 10], type: 'box' },
    { name: 'Scapula_left', position: [-12, 30, -4], scale: [6, 8, 2], type: 'box' },
    { name: 'Scapula_right', position: [12, 30, -4], scale: [6, 8, 2], type: 'box' },
    { name: 'Clavicle_left', position: [-8, 38, 6], scale: [10, 1, 1], type: 'capsule' },
    { name: 'Clavicle_right', position: [8, 38, 6], scale: [10, 1, 1], type: 'capsule' },
    { name: 'Humerus_left', position: [-18, 25, 0], scale: [3, 26, 3], type: 'capsule' },
    { name: 'Humerus_right', position: [18, 25, 0], scale: [3, 26, 3], type: 'capsule' },
    { name: 'Radius_left', position: [-20, 5, 2], scale: [2, 20, 2], type: 'capsule' },
    { name: 'Radius_right', position: [20, 5, 2], scale: [2, 20, 2], type: 'capsule' },
    { name: 'Ulna_left', position: [-22, 5, -2], scale: [2, 20, 2], type: 'capsule' },
    { name: 'Ulna_right', position: [22, 5, -2], scale: [2, 20, 2], type: 'capsule' },
    { name: 'Pelvis', position: [0, -8, 0], scale: [16, 6, 10], type: 'box' },
    { name: 'Femur_left', position: [-8, -20, 0], scale: [3, 34, 3], type: 'capsule' },
    { name: 'Femur_right', position: [8, -20, 0], scale: [3, 34, 3], type: 'capsule' },
    { name: 'Patella_left', position: [-8, -38, 6], scale: [3, 3, 2], type: 'box' },
    { name: 'Patella_right', position: [8, -38, 6], scale: [3, 3, 2], type: 'box' },
    { name: 'Tibia_left', position: [-8, -48, 0], scale: [2, 30, 2], type: 'capsule' },
    { name: 'Tibia_right', position: [8, -48, 0], scale: [2, 30, 2], type: 'capsule' },
    { name: 'Fibula_left', position: [-10, -48, 0], scale: [1.5, 30, 1.5], type: 'capsule' },
    { name: 'Fibula_right', position: [10, -48, 0], scale: [1.5, 30, 1.5], type: 'capsule' },
    { name: 'Hand_left', position: [-15, -8, 0], scale: [4, 3, 3], type: 'box' },
    { name: 'Hand_right', position: [15, -8, 0], scale: [4, 3, 3], type: 'box' },
    { name: 'Foot_left', position: [-8, -65, 5], scale: [4, 2, 8], type: 'box' },
    { name: 'Foot_right', position: [8, -65, 5], scale: [4, 2, 8], type: 'box' }
  ];

  bones.forEach(b => {
    let geometry;
    switch (b.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(b.scale[0], b.scale[1], b.scale[2]);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(b.scale[0], 16, 16);
        break;
      case 'capsule':
      default:
        geometry = new THREE.CapsuleGeometry(b.scale[0], b.scale[1], 8, 16);
        break;
    }

    const mesh = new THREE.Mesh(geometry, boneMaterial.clone());
    mesh.name = b.name;
    mesh.position.set(...b.position);
    mesh.userData = { originalName: b.name, system: 'skeletal' };
    group.add(mesh);
  });

  return group;
}

async function generate() {
  console.log('Creating skeletal model...');
  const skeletal = createSkeletalModel();
  console.log(`Skeletal model: ${skeletal.children.length} meshes`);

  const skeletalData = await new Promise((resolve, reject) => {
    exporter.parse(skeletal, resolve, { binary: true });
  });

  fs.writeFileSync(path.join('public/models/skeletal.glb'), Buffer.from(skeletalData));
  console.log('skeletal.glb saved!');
  process.exit(0);
}

generate().catch(console.error);
