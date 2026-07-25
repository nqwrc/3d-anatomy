// Sample data structure for systems.json
// This will be loaded from /public/data/systems.json

export const sampleSystemsData = {
  "muscular": [
    "Biceps_brachii",
    "Triceps_brachii",
    "Deltoid",
    "Pectoralis_major",
    "Latissimus_dorsi",
    "Trapezius",
    "Rectus_abdominis",
    "External_oblique"
  ],
  "skeletal": [
    "Femur",
    "Tibia",
    "Humerus",
    "Radius",
    "Ulna",
    "Scapula",
    "Clavicle",
    "Skull",
    "Vertebral_column",
    "Rib_cage"
  ],
  "cardiovascular": [
    "Heart"
  ],
  "respiratory": [
    "Lung_Right",
    "Lung_Left"
  ],
  "digestive": [
    "Liver",
    "Stomach"
  ],
  "urinary": [
    "Kidney_Right"
  ],
  "nervous": [
    "Brain",
    "Spinal_cord",
    "Sciatic_nerve"
  ]
};

export const systemLabels = {
  it: {
    muscular: "Sistema muscolare",
    skeletal: "Sistema scheletrico",
    cardiovascular: "Sistema cardiovascolare",
    respiratory: "Sistema respiratorio",
    digestive: "Sistema digerente",
    urinary: "Sistema urinario",
    nervous: "Sistema nervoso",
    joints: "Articolazioni",
    lymphatic: "Organi linfatici"
  },
  en: {
    muscular: "Muscular system",
    skeletal: "Skeletal system",
    cardiovascular: "Cardiovascular system",
    respiratory: "Respiratory system",
    digestive: "Digestive system",
    urinary: "Urinary system",
    nervous: "Nervous system",
    joints: "Joints",
    lymphatic: "Lymphatic organs"
  }
};

export const systemIcons = {
  muscular: "💪",
  skeletal: "🦴",
  cardiovascular: "❤️",
  respiratory: "🫁",
  digestive: "🫃",
  urinary: "🫘",
  nervous: "🧠",
  joints: "🦵",
  lymphatic: "🫧"
};

export const systemOrder = [
  "muscular",
  "skeletal",
  "cardiovascular",
  "respiratory",
  "digestive",
  "urinary",
  "nervous",
  "joints",
  "lymphatic"
];

export default { sampleSystemsData, systemLabels, systemIcons, systemOrder };