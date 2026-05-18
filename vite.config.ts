import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Allows importing with "@/..." instead of "../../..." relative paths
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Dev-only proxy: lets the browser fetch logged-out Instagram profile
      // pages same-origin so we can scrape `og:image` (the creator's avatar
      // CDN URL) at import time without tripping CORS. IG's saved-posts API
      // response does not include profile_pic_url, so enrichment has to come
      // from `instagram.com/{username}/`. Production builds (`vite build`)
      // do not include this proxy — IG enrichment silently no-ops there.
      '/ig-public-profile': {
        target:       'https://www.instagram.com',
        changeOrigin: true,
        secure:       true,
        rewrite:      (incomingPath) => incomingPath.replace(/^\/ig-public-profile/, ''),
      },
    },
  },
});
