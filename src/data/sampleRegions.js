// Sample data structure for regions.json
// This will be loaded from /public/data/regions.json

export const sampleRegionsData = {
  "head": [
    "Skull",
    "Brain"
  ],
  "neck": [
    "Trapezius"
  ],
  "thorax": [
    "Pectoralis_major",
    "Latissimus_dorsi",
    "Trapezius",
    "Vertebral_column",
    "Rib_cage",
    "Heart",
    "Lung_Right",
    "Lung_Left",
    "Spinal_cord"
  ],
  "abdomen": [
    "Rectus_abdominis",
    "External_oblique",
    "Liver",
    "Stomach",
    "Kidney_Right"
  ],
  "upper_limb": [
    "Deltoid",
    "Biceps_brachii",
    "Triceps_brachii",
    "Pectoralis_major",
    "Latissimus_dorsi",
    "Humerus",
    "Radius",
    "Ulna",
    "Scapula",
    "Clavicle"
  ],
  "lower_limb": [
    "Femur",
    "Tibia",
    "Sciatic_nerve"
  ]
};

export const regionLabels = {
  it: {
    head: "Capo",
    neck: "Collo",
    thorax: "Torace",
    abdomen: "Addome",
    upper_limb: "Arto superiore",
    lower_limb: "Arto inferiore"
  },
  en: {
    head: "Head",
    neck: "Neck",
    thorax: "Thorax",
    abdomen: "Abdomen",
    upper_limb: "Upper limb",
    lower_limb: "Lower limb"
  }
};

export const regionOrder = [
  "head",
  "neck",
  "thorax",
  "abdomen",
  "upper_limb",
  "lower_limb"
];

export default { sampleRegionsData, regionLabels, regionOrder };