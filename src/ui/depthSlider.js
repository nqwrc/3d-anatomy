// Depth control: one slider that fades the body away layer by layer, from the
// most superficial system inwards.
//
// Zygote dissolves skin -> deep with several co-visible translucent layers.
// This dataset has no skin, no subcutaneous fat and no superficial fascia, and
// lumps respiratory, digestive and urinary into one visceral model, so a
// faithful continuous dissolve is not possible. Seven cross-faded steps is what
// the data supports, and it still beats seven checkboxes.
import { state, translate } from '../state/store.js';
import { setSystemTransparency, showSystem, hideSystem } from '../viewer/visibility.js';

// Superficial first, deepest last.
const DEPTH_ORDER = [
  'muscular',
  'lymphatic',
  'cardiovascular',
  'nervous',
  'visceral',
  'joints',
  'skeletal'
];

const MIN_VISIBLE_OPACITY = 0.05;

let slider = null;

function applyDepth(value) {
  const loaded = DEPTH_ORDER.filter(id => state.loadedSystems.includes(id));
  if (!loaded.length) return;

  // How many layers the slider has eaten through, as a fractional position.
  const progress = (value / 100) * loaded.length;

  loaded.forEach((systemId, index) => {
    const opacity = Math.min(Math.max(1 - (progress - index), 0), 1);

    if (opacity <= MIN_VISIBLE_OPACITY) {
      hideSystem(systemId);
    } else {
      showSystem(systemId);
      if (opacity < 1) setSystemTransparency(systemId, opacity);
    }
  });
}

export function initDepthSlider() {
  const container = document.getElementById('viewerContainer');
  if (!container || slider) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'depth-control';
  wrapper.innerHTML = `
    <label class="depth-label" for="depthSlider">${translate('depth')}</label>
    <input type="range" id="depthSlider" class="depth-slider" min="0" max="100" value="0" step="1"
           orient="vertical" aria-label="${translate('depth')}">
  `;
  container.appendChild(wrapper);

  slider = wrapper.querySelector('#depthSlider');
  slider.addEventListener('input', event => applyDepth(Number(event.target.value)));

  return wrapper;
}

// Toggling a system by hand invalidates the slider's picture of the scene.
export function resetDepthSlider() {
  if (slider) slider.value = 0;
}
