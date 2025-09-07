import type { NextConfig } from 'next';
import os from 'node:os';

function discoverLanOrigins(port = '3000') {
  try {
    const nets = os.networkInterfaces();
    const addrs: string[] = [];
    for (const name of Object.keys(nets)) {
      for (const ni of nets[name] || []) {
        if (!ni || (ni as any).internal) continue;
        const family = typeof (ni as any).family === 'string' ? (ni as any).family : ((ni as any).family === 4 ? 'IPv4' : 'IPv6');
        if (family === 'IPv4' && (ni as any).address) {
          addrs.push(`http://${(ni as any).address}:${port}`);
        }
      }
    }
    return Array.from(new Set(addrs));
  } catch {
    return [];
  }
}

const PORT = process.env.PORT || '3000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    ...discoverLanOrigins(PORT),
  ],
};

export default nextConfig;
