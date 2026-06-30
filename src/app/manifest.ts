import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WOOFonBASE",
    short_name: "WOOF",
    description: "Translate English to Woof and back. Est. 1998.",
    start_url: "/",
    display: "standalone",
    background_color: "#008080",
    theme_color: "#008080",
    icons: [
      {
        src: "/woofhead.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/woofhead.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
