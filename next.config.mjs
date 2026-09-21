/** @type {import('next').NextConfig} */
const nextConfig = {
  // `pnpm build:native` sets this to emit a static site into out/ for Capacitor.
  // The Vercel web build keeps the default server output.
  ...(process.env.NEXT_PUBLIC_NATIVE === '1' ? { output: 'export' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
