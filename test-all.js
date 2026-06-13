/**
 * Comprehensive test for all 20 providers
 */
import { providers } from './src/providers/index.js';

const results = { passed: 0, failed: 0, errors: [] };

async function testProvider(name, provider) {
  const prefix = `[${name}]`;
  
  // Test 1: Mainpage sections
  try {
    const mainpage = await provider.mainpage();
    let hasItems = false;
    for (const section of mainpage.sections) {
      if (section.items.length > 0) {
        hasItems = true;
        break;
      }
    }
    if (hasItems) {
      results.passed++;
      const totalItems = mainpage.sections.reduce((sum, s) => sum + s.items.length, 0);
      const sections = mainpage.sections.length;
      console.log(`✅ ${prefix} Mainpage: ${sections} sections, ${totalItems} total items`);
      
      // Check first item has all fields
      for (const section of mainpage.sections) {
        for (const item of section.items.slice(0, 2)) {
          if (!item.title) console.log(`   ⚠️  Missing title in ${name}:${section.name}`);
          if (!item.url) console.log(`   ⚠️  Missing url in ${name}:${section.name}`);
          if (!item.poster) console.log(`   ⚠️  Missing poster in ${name}:${section.name}`);
        }
      }
    } else {
      results.failed++;
      console.log(`❌ ${prefix} Mainpage: NO ITEMS`);
    }
  } catch (err) {
    results.failed++;
    results.errors.push(`${name} mainpage: ${err.message}`);
    console.log(`❌ ${prefix} Mainpage ERROR: ${err.message.substring(0, 100)}`);
    return; // Skip remaining tests for this provider
  }

  // Test 2: Search
  try {
    const search = await provider.search('big', 1);
    if (search.items.length > 0) {
      results.passed++;
      console.log(`✅ ${prefix} Search: ${search.items.length} items`);
    } else {
      console.log(`⚠️  ${prefix} Search: 0 results`);
    }
  } catch (err) {
    console.log(`⚠️  ${prefix} Search ERROR: ${err.message.substring(0, 80)}`);
  }

  // Test 3: Load + LoadLinks
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
      // Test load
      try {
        const details = await provider.load(videoUrl);
        if (details.title) {
          results.passed++;
          console.log(`✅ ${prefix} Load: title="${details.title.substring(0, 50)}"`);
        } else {
          console.log(`⚠️  ${prefix} Load: no title`);
        }
        if (details.poster) {
          results.passed++;
          console.log(`✅ ${prefix} Poster: ${details.poster.substring(0, 60)}`);
        }
      } catch (err) {
        console.log(`⚠️  ${prefix} Load ERROR: ${err.message.substring(0, 80)}`);
      }

      // Test loadlinks
      try {
        const result = await provider.loadlinks(videoUrl);
        if (result.sources.length > 0) {
          results.passed++;
          console.log(`✅ ${prefix} LoadLinks: ${result.sources.length} sources`);
          for (const s of result.sources.slice(0, 2)) {
            console.log(`   ${s.quality}: ${s.url.substring(0, 80)}`);
          }
        } else {
          console.log(`⚠️  ${prefix} LoadLinks: 0 sources`);
        }
      } catch (err) {
        console.log(`⚠️  ${prefix} LoadLinks ERROR: ${err.message.substring(0, 80)}`);
      }
    }
  } catch (err) {
    console.log(`⚠️  ${prefix} load/loadlinks ERROR: ${err.message.substring(0, 80)}`);
  }

  console.log(); // blank line between providers
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Comprehensive Provider Test - Cloudflare Worker API   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  const names = Object.keys(providers);
  console.log(`Testing ${names.length} providers...\n`);

  for (const name of names) {
    await testProvider(name, providers[name]);
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`Results: ${results.passed} passed, ${results.failed} failed`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of results.errors) {
      console.log(`  ❌ ${err}`);
    }
  }
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
