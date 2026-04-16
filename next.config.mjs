/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      '@react-pdf/layout',
      '@react-pdf/pdfkit',
      '@react-pdf/font',
    ],
    instrumentationHook: true,
  },
};

export default nextConfig;
