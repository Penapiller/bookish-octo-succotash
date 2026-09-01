import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google account avatars, used as the default avatar for new users.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Supabase Storage, used for uploaded pet/item art in later phases.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      // placehold.co, used for placeholder species/zone/item art until
      // real art assets exist.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
