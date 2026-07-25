// Test model generator - creates simple GLB files for testing
// Run with: node generate-test-models.js

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

const exporter = new GLTFExporter();

function createMuscularModel() {
  const group = new THREE.Group();
  group.name = 'muscular';

  // Simple muscle representations using capsules/cylinders
  const muscleMaterial = new THREE.MeshStandardMaterial({
    color: 0xcc4444,
    roughness: 0.8,
    metalness: 0.1
  });

  const muscleData = [
    // Upper limb muscles
    { name: 'Biceps_brachii', position: [15, 25, 0], rotation: [0, 0, 0], scale: [3, 12, 3] },
    { name: 'Triceps_brachii', position: [-15, 25, 0], rotation: [0, 0, 0], scale: [3, 12, 3] },
    { name: 'Deltoid', position: [0, 38, 0], rotation: [0, 0, 0], scale: [8, 6, 6] },
    { name: 'Pectoralis_major', position: [0, 20, 10], rotation: [0, 0, 0], scale: [12, 8, 4] },
    { name: 'Latissimus_dorsi', position: [0, 10, -8], rotation: [0, 0, 0], scale: [14, 12, 4] },
    { name: 'Trapezius', position: [0, 35, -2], rotation: [0, 0, 0], scale: [12, 8, 6] },

    // Torso muscles
    { name: 'Rectus_abdominis', position: [0, 5, 8], rotation: [0, 0, 0], scale: [4, 18, 3] },
    { name: 'External_oblique', position: [8, 5, 5], rotation: [0, 0, 0], scale: [6, 18, 3] },

    // Lower limb (simplified)
    { name: 'Femur', position: [0, -20, 0], rotation: [0, 0, 0], scale: [4, 30, 4] },
    { name: 'Tibia', position: [0, -45, 0], rotation: [0, 0, 0], scale: [3, 25, 3] }
  ];

  muscleData.forEach(data => {
    const geometry = new THREE.CapsuleGeometry(data.scale[0], data.scale[1], 8, 16);
    const mesh = new THREE.Mesh(geometry, muscleMaterial.clone());
    mesh.name = data.name;
    mesh.position.set(...data.position);
    mesh.rotation.set(...data.rotation);
    mesh.scale.set(1, 1, 1);
    mesh.userData = { originalName: data.name };
    group.add(mesh);
  });

  return group;
}

function createSkeletalModel() {
  const group = new THREE.Group();
  group.name = 'skeletal';

  const boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc,
    roughness: 0.9,
    metalness: 0.0
  });

  const boneData = [
    // Upper limb
    { name: 'Humerus', position: [0, 25, 0], scale: [3, 25, 3] },
    { name: 'Radius', position: [5, 5, 0], scale: [2, 20, 2] },
    { name: 'Ulna', position: [-5, 5, 0], scale: [2, 20, 2] },
    { name: 'Scapula', position: [0, 35, -5], scale: [8, 6, 2] },
    { name: 'Clavicle', position: [0, 38, 8], scale: [12, 1, 1] },

    // Lower limb
    { name: 'Femur', position: [0, -20, 0], scale: [3, 30, 3] },
    { name: 'Tibia', position: [0, -45, 0], scale: [2, 25, 2] },

    // Spine & torso
    { name: 'Vertebral_column', position: [0, 5, 0], scale: [2, 45, 2] },
    { name: 'Rib_cage', position: [0, 15, 0], scale: [12, 20, 8] },
    { name: 'Skull', position: [0, 50, 0], scale: [8, 10, 8] }
  ];

  boneData.forEach(data => {
    const geometry = new THREE.CapsuleGeometry(data.scale[0], data.scale[1], 8, 16);
    const mesh = new THREE.Mesh(geometry, boneMaterial.clone());
    mesh.name = data.name;
    mesh.position.set(...data.position);
    mesh.userData = { originalName: data.name };
    group.add(mesh);
  });

  return group;
}

async function generateModels() {
  const outputDir = '/c/Users/nico/Desktop/3d-anatomy/public/models';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating muscular.glb...');
  const muscular = createMuscularModel();
  const muscularData = await new Promise((resolve, reject) => {
    exporter.parse(muscular, resolve, { binary: true });
  });
  fs.writeFileSync(path.join(outputDir, 'muscular.glb'), Buffer.from(muscularData));
  console.log('muscular.glb created');

  console.log('Generating skeletal.glb...');
  const skeletal = createSkeletalModel();
  const skeletalData = await new Promise((resolve, reject) => {
    exporter.parse(skeletal, resolve, { binary: true });
  });
  fs.writeFileSync(path.join(outputDir, 'skeletal.glb'), Buffer.from(skeletalData));
  console.log('skeletal.glb created');

  console.log('Done!');
  process.exit(0);
}

generateModels().catch(console.error);