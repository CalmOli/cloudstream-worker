/**
 * Test all providers
 */
import { providers } from './src/providers/index.js';

async function testProvider(name, provider) {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Testing: ${name.padEnd(31)}║`);
  console.log(`╚══════════════════════════════════════╝`);

  // Test mainpage
  console.log(`\n--- Mainpage ---`);
  try {
    const mainpage = await provider.mainpage();
    console.log(`  Sections: ${mainpage.sections.length}`);
    for (const section of mainpage.sections) {
      console.log(`  ✅ ${section.name}: ${section.items.length} items`);
      if (section.items.length > 0) {
        const first = section.items[0];
        console.log(`     First: "${(first.title || '?').substring(0, 60)}"`);
        console.log(`     URL: ${(first.url || '?').substring(0, 80)}`);
        console.log(`     Poster: ${first.poster ? '✅ ' + first.poster.substring(0, 80) : '❌ none'}`);
      } else {
        console.log(`     ⚠️  No items found!`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }

  // Test search
  console.log(`\n--- Search ---`);
  try {
    const search = await provider.search('big', 1);
    console.log(`  Found ${search.items.length} items`);
    if (search.items.length > 0) {
      console.log(`  First: "${(search.items[0].title || '?').substring(0, 60)}"`);
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }

  // Test load + loadlinks with first item
  try {
    const mainpage = await provider.mainpage();
    let videoUrl = null;
    for (const section of mainpage.sections) {
      if (section.items.length > 0) {
        videoUrl = section.items[0].url;
        break;
      }
    }

    if (videoUrl) {
      console.log(`\n--- Load (Video Details) ---`);
      console.log(`  URL: ${videoUrl.substring(0, 80)}`);
      const details = await provider.load(videoUrl);
      console.log(`  Title: ${details.title ? '✅ ' + details.title.substring(0, 60) : '❌ none'}`);
      console.log(`  Poster: ${details.poster ? '✅ ' + details.poster.substring(0, 80) : '❌ none'}`);
      console.log(`  Description: ${details.description ? '✅ ' + details.description.substring(0, 60) : '⚠️  none'}`);

      console.log(`\n--- LoadLinks (Video Sources) ---`);
      const result = await provider.loadlinks(videoUrl);
      console.log(`  Found ${result.sources.length} sources`);
      for (const s of result.sources.slice(0, 5)) {
        console.log(`  ${s.quality}: ${s.url.substring(0, 100)}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Error in load/loadlinks: ${err.message}`);
  }
}

async function main() {
  const toTest = ['analdin', 'bingato', 'fullvideos', 'hardsexvids', 'hdporn'];
  for (const name of toTest) {
    await testProvider(name, providers[name]);
  }
  console.log(`\n=== All Tests Complete ===`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
