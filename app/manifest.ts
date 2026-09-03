import type { MetadataRoute } from "next";

// Lets a client "Add to Home Screen" and get a real app icon and name, opened
// full-screen without browser chrome. Colours follow the design tokens at the
// top of globals.css (--paper / --accent). Icons are app/icon.png (512) and
// app/apple-icon.png (180), both cut from the source logo onto the paper
// colour; the transparent mark used inside the app is public/brand/logo.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ironline",
    short_name: "Ironline",
    description: "Your training, check-ins and progress from your coach.",
    start_url: "/client",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f9fb",
    theme_color: "#2f5d8f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
