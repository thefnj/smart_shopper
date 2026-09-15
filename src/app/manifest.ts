import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Shopper",
    short_name: "Smart Shopper",
    description: "Private grocery price tracker for the household.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#1e6b4e",
    lang: "en-IE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
