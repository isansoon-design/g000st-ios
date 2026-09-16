/** @type {import('next').NextConfig} */
const path = require('node:path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
};

module.exports = nextConfig;
