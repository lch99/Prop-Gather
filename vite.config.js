import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Root, because the live site (propgather.com.my) serves the app from the
  // domain root. GitHub Pages serves from a subpath instead, so `npm run deploy`
  // overrides this with `--base=/Prop-Gather/` — see predeploy in package.json.
  //
  // This used to be hardcoded to the Pages subpath, which meant the VPS checkout
  // had to carry a permanent local edit to vite.config.js. That edit collides
  // with every `git pull`, so the deploy target belongs in the build command,
  // not in the working tree.
  //
  // Anything referencing an asset at runtime must use `import.meta.env.BASE_URL`
  // (as Layout.jsx:55 does) so it stays correct under both bases.
  base: '/',
  server: {
    port: 5173
  }
})
