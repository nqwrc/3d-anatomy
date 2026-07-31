// Re-exports the GLB files with the dead weight removed.
//
// The Blender export carries a UV set nothing samples (there is not a single
// texture in the project) and marks every surface double sided, which doubles
// the fill rate. Run with: node tools/optimise-models.mjs
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const MODELS_DIR = path.resolve(process.env.MODELS_DIR || 'public/models');

// Surfaces that are genuinely one-sided sheets: keeping these double sided is
// correct, because you can see them from behind.
const KEEP_DOUBLE_SIDED = /fascia|membran|pleura|peritone|meninx|dura|arachnoid|pia mater|omentum|mesocolon|meso-|sheath|septum|aponeuros|retinacul|tentorium|falx|diaphragm/i;

async function build() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule()
    });

  const files = (await readdir(MODELS_DIR)).filter(name => name.endsWith('.glb'));
  const report = [];
  const survivors = new Map();

  for (const file of files) {
    const filePath = path.join(MODELS_DIR, file);
    const before = (await stat(filePath)).size;

    const document = await io.read(filePath);
    const root = document.getRoot();

    let uvsDropped = 0;
    root.listMeshes().forEach(mesh => {
      mesh.listPrimitives().forEach(primitive => {
        for (const semantic of primitive.listSemantics()) {
          if (semantic.startsWith('TEXCOORD')) {
            primitive.setAttribute(semantic, null);
            uvsDropped++;
          }
        }
      });
    });

    let singleSided = 0;
    root.listMaterials().forEach(material => {
      if (material.getDoubleSided() && !KEEP_DOUBLE_SIDED.test(material.getName() || '')) {
        material.setDoubleSided(false);
        singleSided++;
      }
    });

    await document.transform(dedup(), prune());

    // Re-apply Draco with the same settings the Blender export used.
    document.createExtension(KHRDracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        quantizationBits: { POSITION: 14, NORMAL: 10, COLOR: 8, TEX_COORD: 12, GENERIC: 12 }
      });

    await io.write(filePath, document);
    const after = (await stat(filePath)).size;

    // prune() drops nodes that carry no geometry — Z-Anatomy has a few curve
    // objects that exported empty. Record what actually survived so the index
    // cannot list structures the model does not contain.
    survivors.set(
      path.basename(file, '.glb'),
      root.listNodes()
        .map(node => node.getExtras()?.za_name)
        .filter(Boolean)
        .sort()
    );

    report.push({
      file,
      beforeMB: +(before / 1048576).toFixed(2),
      afterMB: +(after / 1048576).toFixed(2),
      saved: `${Math.round((1 - after / before) * 100)}%`,
      uvsDropped,
      singleSided
    });
  }

  const total = report.reduce((acc, row) => ({
    beforeMB: acc.beforeMB + row.beforeMB,
    afterMB: acc.afterMB + row.afterMB
  }), { beforeMB: 0, afterMB: 0 });

  console.table(report);
  console.log(`total ${total.beforeMB.toFixed(2)} MB -> ${total.afterMB.toFixed(2)} MB`);

  const indexPath = path.resolve('public/data/systems.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  let removed = 0;

  for (const [systemId, names] of survivors) {
    if (!index[systemId]) continue;
    removed += index[systemId].length - names.length;
    index[systemId] = names;
  }

  await writeFile(indexPath, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`systems.json rewritten from the models (${removed} empty node(s) dropped)`);
}

build().catch(error => {
  console.error(error);
  process.exit(1);
});
