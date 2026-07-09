import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting ingredient cleanup...\n');

  await prisma.$transaction(async (tx) => {

    // ── A. MERGE DUPLIKAT ────────────────────────────────────────────────────
    const merges = [
      { from: 'ing_B001',                  to: 'cmrauefuh0000yswpvt7b70me', label: 'Susu Freshmilk' },
      { from: 'ing_B051',                  to: 'cmrauekch005kyswpwg8xi2f0',  label: 'Bawang Merah' },
      { from: 'ing_B050',                  to: 'cmrauek9v005gyswpzsuycgjd',  label: 'Bawang Putih' },
      { from: 'ing_B037',                  to: 'cmraueiwi0040yswpu873f5no',  label: 'Daging Giling' },
      { from: 'cmraueji3004oyswpe6sxwdun', to: 'ing_B043',                   label: 'Cabai Cayenne' },
      { from: 'cmrauejod004wyswpgb76nzdz', to: 'ing_B045',                   label: 'Smoke Powder' },
      { from: 'cmrauehuu002syswphaqgyko0', to: 'ing_B026',                   label: 'Anaerobic Idjen' },
    ];

    for (const m of merges) {
      const [fromIng, toIng] = await Promise.all([
        tx.ingredient.findUnique({ where: { id: m.from } }),
        tx.ingredient.findUnique({ where: { id: m.to } }),
      ]);
      if (!fromIng) { console.log(`  ⚠ Skip: ${m.label} from=${m.from} not found`); continue; }
      if (!toIng)   { console.log(`  ⚠ Skip: ${m.label} to=${m.to} not found`); continue; }

      await (tx as any).recipeItem.updateMany({ where: { ingredientId: m.from }, data: { ingredientId: m.to } });
      await (tx as any).stockMovement.updateMany({ where: { ingredientId: m.from }, data: { ingredientId: m.to } });
      await (tx as any).purchaseOrderItem.updateMany({ where: { ingredientId: m.from }, data: { ingredientId: m.to } });
      await (tx as any).stockLevel.deleteMany({ where: { ingredientId: m.from } });
      await (tx as any).stockOpnameItem.deleteMany({ where: { ingredientId: m.from } });
      await (tx as any).productionOrderItem?.deleteMany({ where: { ingredientId: m.from } }).catch(() => {});
      await tx.ingredient.delete({ where: { id: m.from } });
      console.log(`  ✓ Merged: ${m.label}`);
    }

    // ── B. HAPUS TOTAL ───────────────────────────────────────────────────────
    const toDelete = [
      { id: 'cmrauegqj0018yswpbs4wy9fj', name: 'Flavour Baileys' },
      { id: 'cmrauefxi0004yswpaerawjh4',  name: 'Creamer Bubuk' },
    ];
    for (const d of toDelete) {
      const ing = await tx.ingredient.findUnique({ where: { id: d.id } });
      if (!ing) { console.log(`  ⚠ Skip delete: ${d.name} not found`); continue; }
      const usage = await (tx as any).recipeItem.count({ where: { ingredientId: d.id } });
      if (usage > 0) { console.log(`  ⚠ Skip delete: ${d.name} masih di ${usage} recipe`); continue; }
      await (tx as any).stockLevel.deleteMany({ where: { ingredientId: d.id } });
      await (tx as any).stockOpnameItem.deleteMany({ where: { ingredientId: d.id } });
      await (tx as any).stockMovement.deleteMany({ where: { ingredientId: d.id } });
      await tx.ingredient.delete({ where: { id: d.id } });
      console.log(`  ✓ Deleted: ${d.name}`);
    }

    // ── C. UPDATE FIELDS & HARGA ─────────────────────────────────────────────
    const updates: Array<{ id: string; label: string; data: Record<string, any> }> = [
      { id: 'cmraueiwi0040yswpu873f5no', label: 'Daging Giling',        data: { latestPrice: 85 } },
      { id: 'cmraueiyy0044yswpuht70snc', label: 'Telur',                data: { purchaseUnit: 'Kg', conversionRate: 60, unit: 'pcs', latestPrice: 1667 } },
      { id: 'cmrauejrt0050yswpk2jku6nk', label: 'Margarin',             data: { unit: 'g', latestPrice: 95 } },
      { id: 'cmraueicg003cyswp3t3axc77', label: 'Mineral Galon',        data: { unit: 'ml', conversionRate: 19000, latestPrice: 1.05 } },
      { id: 'cmrauegda000oyswpp27670ds', label: 'Teh Tong Dji',         data: { unit: 'g', purchaseUnit: 'Pack', conversionRate: 250, latestPrice: 100, name: 'Teh Tong Dji Jasmine' } },
      { id: 'cmrauelo50070yswplnyqtyzm', label: 'Burger Bun',           data: { latestPrice: 3000, name: 'Burger Bun Butterfield' } },
      { id: 'cmrauegij000wyswpqx70mtqj', label: 'Tonic',                data: { latestPrice: 23.33, name: 'Tonic Sweppes' } },
      { id: 'cmrauegg9000syswplukipdd5', label: 'Soda',                 data: { latestPrice: 20, name: 'Soda Zoda' } },
      { id: 'cmrauefuh0000yswpvt7b70me', label: 'Susu Freshmilk',       data: { latestPrice: 25.55, purchaseUnit: 'pack', conversionRate: 946, name: 'Susu Freshmilk Diamond' } },
      { id: 'cmraueh32001oyswp8ne1fmen', label: 'Flavour Pandan',       data: { unit: 'ml', conversionRate: 750, name: 'Flavour Pandan Foya' } },
      { id: 'cmraueg4d000cyswpv9brdb78', label: 'Susu Evaporasi',       data: { latestPrice: 61.73, name: 'Susu Evaporasi Carnation' } },
      { id: 'cmraueg0s0008yswpfm6lcq6p', label: 'Susu SKM',             data: { latestPrice: 54.05, name: 'Susu SKM Carnation' } },
      { id: 'cmrauehsd002oyswp2y5qf2le', label: 'House Blend Beans',    data: { latestPrice: 240, name: 'House Blend Beans 60:40' } },
      { id: 'cmrauei3n0030yswpne5ix06v', label: 'Specialty Beans',      data: { latestPrice: 500 } },
      { id: 'cmrauehmj002gyswpoafwcvcb', label: 'Berry Juice',          data: { latestPrice: 39.43, name: 'Berry Juice Diamond' } },
      { id: 'cmrauehqb002kyswp2vprw6h1', label: 'Orange Juice',         data: { latestPrice: 95, name: 'Orange Juice Sunquick' } },
      { id: 'cmrauehke002cyswpktb3ycv3', label: 'Sea Salt',             data: { latestPrice: 166.67 } },
      { id: 'cmrauei790034yswp9y6h5y8b', label: 'Nanas',                data: { latestPrice: 20 } },
      { id: 'cmraueifr003gyswp0nnjcmm5', label: 'Oat Milk',             data: { latestPrice: 35, name: 'Oat Milk Oat Side' } },
      { id: 'cmraueiis003kyswpkffug8iw', label: 'Beras',                data: { latestPrice: 25, name: 'Beras Setra Ramos' } },
      { id: 'cmraueite003wyswpm2gfnrug', label: 'Daging Has Dalam',     data: { latestPrice: 160 } },
      { id: 'cmrauej6o0048yswpycyvz6dp', label: 'Sayap Ayam',           data: { latestPrice: 45 } },
      { id: 'cmraueiqb003syswp63jv73qy', label: 'Kulit Ayam',           data: { latestPrice: 38 } },
      { id: 'cmraueimn003oyswpubv8xhz7', label: 'Paha Ayam Fillet',     data: { latestPrice: 52 } },
      { id: 'cmrauej9d004cyswp5hdyvwlg', label: 'Kentang Dieng',        data: { latestPrice: 20 } },
      { id: 'cmrauejtu0054yswpgn5fhz0f', label: 'Romaine Lettuce',      data: { latestPrice: 20, name: 'Romaine Lettuce (Selada)' } },
      { id: 'cmrauejxo0058yswpbwy3paeo', label: 'Minyak Sawit',         data: { latestPrice: 24, name: 'Minyak Sawit Minyakita' } },
      { id: 'cmrauekit005syswpdbl0cbe0', label: 'Mayonaise',            data: { latestPrice: 26, name: 'Mayonaise Mamayo' } },
      { id: 'cmrauekch005kyswpwg8xi2f0', label: 'Bawang Merah',         data: { latestPrice: 40 } },
      { id: 'cmrauek9v005gyswpzsuycgjd', label: 'Bawang Putih',         data: { latestPrice: 38 } },
      { id: 'cmrauell3006wyswp9tj1eqgi', label: 'Kecap Manis',          data: { latestPrice: 47.62, name: 'Kecap Manis Bango' } },
      { id: 'cmrauelby006kyswp8jkt70l8', label: 'Penyedap Rasa',        data: { latestPrice: 125, name: 'Penyedap Rasa Knorr' } },
      { id: 'cmrauel1h0064yswpwmdouhq2', label: 'Cabai Hijau Besar',    data: { latestPrice: 23 } },
      { id: 'cmrauejkw004syswprjm3avb4', label: 'Cajun Seasoning',      data: { latestPrice: 115 } },
      { id: 'cmraueklv005wyswp3y5ox8cd', label: 'Saus BBQ',             data: { latestPrice: 35, name: 'Saus BBQ Smoky' } },
      { id: 'cmrauel3g0068yswp3wf0f97n', label: 'Saus Tiram',           data: { latestPrice: 100, name: 'Saus Tiram Cap Panda' } },
      { id: 'cmraueket005oyswpz6dd4cz5', label: 'Saus Cabai',           data: { latestPrice: 322.92, name: 'Saus Cabai Del Monte' } },
      { id: 'cmrauelfd006oyswpxtw54ikm', label: 'Tepung Maizena',       data: { latestPrice: 28 } },
      { id: 'cmrauekys0060yswpj80jmfsx', label: 'Red Cheddar',          data: { latestPrice: 2142.86 } },
      { id: 'cmraueg7y000gyswplw1knpdr', label: 'Gula Aren',            data: { latestPrice: 55, name: 'Gula Aren Foya' } },
      { id: 'cmrauegaq000kyswp20mxeele', label: 'Gula Pasir',           data: { latestPrice: 18, name: 'Gula Pasir Gulaku' } },
      { id: 'ing_B026',                  label: 'Anaerobic Idjen',       data: { latestPrice: 400, name: 'Anaerobic Idjen Gemilang' } },
      { id: 'ing_B043',                  label: 'Cabai Cayenne',         data: { latestPrice: 82, name: 'Cabai Cayenne' } },
      { id: 'ing_B045',                  label: 'Smoke Powder',          data: { latestPrice: 380, name: 'Smoke Powder' } },
    ];

    let updatedCount = 0;
    for (const u of updates) {
      const ing = await tx.ingredient.findUnique({ where: { id: u.id } });
      if (!ing) { console.log(`  ⚠ Skip: ${u.label} (${u.id}) not found`); continue; }
      await tx.ingredient.update({ where: { id: u.id }, data: u.data });
      updatedCount++;
    }
    console.log(`  ✓ Updated ${updatedCount} ingredients`);

    // ── D. TAMBAH BAWANG BOMBAY ──────────────────────────────────────────────
    const existBB = await tx.ingredient.findFirst({ where: { name: { contains: 'Bawang Bombay' } } });
    if (!existBB) {
      const bb = await tx.ingredient.create({
        data: { name: 'Bawang Bombay', type: 'RAW', unit: 'g', purchaseUnit: 'Kg', conversionRate: 1000, latestPrice: 30, minStock: 200, active: true },
      });
      await (tx as any).stockLevel.createMany({
        data: ['GUDANG','BAR','KITCHEN'].map(loc => ({ ingredientId: bb.id, location: loc, quantity: 0 })),
        skipDuplicates: true,
      });
      console.log(`  ✓ Created: Bawang Bombay (${bb.id})`);
    } else {
      console.log(`  ⚠ Bawang Bombay sudah ada`);
    }

    // ── E. FIX PREMIX yieldQty ───────────────────────────────────────────────
    const premix = await tx.ingredient.findFirst({ where: { name: { contains: 'PREMIX', mode: 'insensitive' } } });
    if (premix) {
      const recipe = await (tx as any).recipe.findFirst({ where: { ingredientId: premix.id } });
      if (recipe && (!recipe.yieldQty || recipe.yieldQty < 100)) {
        await (tx as any).recipe.update({ where: { id: recipe.id }, data: { yieldQty: 3847 } });
        console.log(`  ✓ Fixed ${premix.name} yieldQty → 3847`);
      }
    }

  }, { timeout: 30000 });

  console.log('\n✅ Cleanup selesai!');
  console.log('💡 Jalankan "Recalculate HPP" di Products setelah ini.');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
