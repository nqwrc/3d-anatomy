// Model generator - runs in browser
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

  const bones = [
    { name: 'Skull', position: [0, 42, 0], scale: [8, 8, 8], type: 'sphere' },
    { name: 'Vertebral_column', position: [0, 5, 0], scale: [4, 40, 4], type: 'capsule' },
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

async function generateAndDownload() {
  const btn = document.getElementById('generateBtn');
  const log = document.getElementById('log');

  function addLog(msg) {
    log.textContent += msg + '\n';
    log.scrollTop = log.scrollHeight;
  }

  btn.disabled = true;
  btn.textContent = 'Generating...';
  addLog('Starting model generation...');

  try {
    addLog('Creating muscular model...');
    const muscular = createMuscularModel();
    addLog(`Muscular model: ${muscular.children.length} meshes`);

    addLog('Exporting muscular.glb...');
    const muscularData = await new Promise((resolve, reject) => {
      exporter.parse(muscular, resolve, { binary: true });
    });

    const muscularBlob = new Blob([muscularData], { type: 'model/gltf-binary' });
    const muscularUrl = URL.createObjectURL(muscularBlob);
    const a = document.createElement('a');
    a.href = muscularUrl;
    a.download = 'muscular.glb';
    a.click();
    URL.revokeObjectURL(muscularUrl);
    addLog('muscular.glb downloaded!');

    addLog('Creating skeletal model...');
    const skeletal = createSkeletalModel();
    addLog(`Skeletal model: ${skeletal.children.length} meshes`);

    addLog('Exporting skeletal.glb...');
    const skeletalData = await new Promise((resolve, reject) => {
      exporter.parse(skeletal, resolve, { binary: true });
    });

    const skeletalBlob = new Blob([skeletalData], { type: 'model/gltf-binary' });
    const skeletalUrl = URL.createObjectURL(skeletalBlob);
    const b = document.createElement('a');
    b.href = skeletalUrl;
    b.download = 'skeletal.glb';
    b.click();
    URL.revokeObjectURL(skeletalUrl);
    addLog('skeletal.glb downloaded!');

    addLog('Done! Move the downloaded files to public/models/');
  } catch (error) {
    addLog('Error: ' + error.message);
    console.error(error);
  }

  btn.disabled = false;
  btn.textContent = 'Generate muscular.glb & skeletal.glb';
}

document.getElementById('generateBtn').addEventListener('click', generateAndDownload);