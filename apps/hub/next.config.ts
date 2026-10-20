import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@leeos/core', '@leeos/ui', '@leeos/database', '@leeos/providers', '@leeos/executors', '@leeos/agents'], poweredByHeader: false, async headers(){return [{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'}]},{source:'/offline.html',headers:[{key:'Cache-Control',value:'no-cache'}]}];} };
export default config;
