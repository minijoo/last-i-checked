import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next auto-links it. Making the app installable
// is a prerequisite for Periodic Background Sync (see docs/autocheck.md, Phase B)
// and gives it a home-screen icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Last I Checked",
    short_name: "Last I Checked",
    description:
      "How your stocks, weather, and sportsbook odds have changed since the last time you checked.",
    start_url: "/stocks",
    display: "standalone",
    background_color: "#090b0c",
    theme_color: "#090b0c",
    icons: [
      {
        src: "/logos/liclogo_400_x_400.png",
        sizes: "400x400",
        type: "image/png",
      },
      {
        src: "/logos/liclogo_400_x_400.png",
        sizes: "400x400",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
