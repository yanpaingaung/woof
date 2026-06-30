import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WOOFonBASE",
    short_name: "WOOF",
    description: "WOOF Protocol is here to bring the meme meta back to Base.",
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
