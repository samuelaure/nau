#!/usr/bin/env node
// Patches expo-modules-core@1.11.14's ExpoModulesCorePlugin.gradle for AGP 8.x compatibility.
// - useExpoPublishing: components.release not available during afterEvaluate in AGP 8.x
// - useDefaultAndroidSdkVersions: missing from this version, required by expo-crypto and others
const fs = require('fs');
const path = require('path');

function findPlugin() {
  const nmRoots = [
    path.resolve(__dirname, '../node_modules'),
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../../node_modules'),
  ];
  for (const root of nmRoots) {
    // flat / npm / pnpm-hoisted
    const flat = path.join(root, 'expo-modules-core/android/ExpoModulesCorePlugin.gradle');
    if (fs.existsSync(flat)) return flat;
    // pnpm nested: node_modules/.pnpm/expo-modules-core@<version>/node_modules/expo-modules-core/
    const pnpmDir = path.join(root, '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      try {
        const match = fs.readdirSync(pnpmDir)
          .filter(d => d.startsWith('expo-modules-core@'))
          .sort().reverse()[0];
        if (match) {
          const p = path.join(pnpmDir, match, 'node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle');
          if (fs.existsSync(p)) return p;
        }
      } catch (_) {}
    }
  }
  return null;
}

const pluginPath = findPlugin();

if (!pluginPath) {
  console.log('[patch-expo-modules] expo-modules-core plugin not found in any candidate path');
  process.exit(0);
}
console.log('[patch-expo-modules] Found plugin at:', pluginPath);

let content = fs.readFileSync(pluginPath, 'utf8');

let modified = false;

// Fix 1: Add useDefaultAndroidSdkVersions if missing
if (!content.includes('useDefaultAndroidSdkVersions')) {
  content = content.replace(
    /ext\.useCoreDependencies\s*=\s*\{/,
    `ext.useDefaultAndroidSdkVersions = {
  android {
    compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)
    defaultConfig {
      minSdkVersion project.ext.safeExtGet("minSdkVersion", 23)
      targetSdkVersion project.ext.safeExtGet("targetSdkVersion", 34)
    }
  }
}

ext.useCoreDependencies = {`
  );
  console.log('[patch-expo-modules] Added useDefaultAndroidSdkVersions');
  modified = true;
} else {
  console.log('[patch-expo-modules] useDefaultAndroidSdkVersions already present');
}

// Fix 2: Fix useExpoPublishing to defer components.release assignment
if (content.includes('from components.release')) {
  // Replace the entire useExpoPublishing body: move android{} block before afterEvaluate,
  // and defer from(components.release) via whenObjectAdded
  content = content.replace(
    /ext\.useExpoPublishing\s*=\s*\{[\s\S]*?\n\}/,
    `ext.useExpoPublishing = {
  if (!project.plugins.hasPlugin('maven-publish')) {
    apply plugin: 'maven-publish'
  }

  android {
    publishing {
      singleVariant("release") {
        withSourcesJar()
      }
    }
  }

  afterEvaluate {
    publishing {
      publications {
        release(MavenPublication) {
        }
      }
      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    }
    project.components.whenObjectAdded { component ->
      if (component.name == 'release') {
        publishing.publications.release.from(component)
      }
    }
  }
}`
  );
  console.log('[patch-expo-modules] Fixed useExpoPublishing for AGP 8.x');
  modified = true;
} else {
  console.log('[patch-expo-modules] useExpoPublishing already fixed');
}

if (modified) {
  fs.writeFileSync(pluginPath, content, 'utf8');
  console.log('[patch-expo-modules] Patch applied successfully');
} else {
  console.log('[patch-expo-modules] No changes needed');
}
