import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// The version in package.json is the single source of truth: it is baked into the
// game as __APP_VERSION__ and published as /version.json, which running games poll
// to notice that a newer build is online.
const readVersion = () => JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

function versionFile() {
  return {
    name: 'version-file',
    configureServer(server) {
      server.middlewares.use('/version.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ version: readVersion() }));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: readVersion(), built: new Date().toISOString() }) });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(readVersion()) },
  plugins: [versionFile()],
});
