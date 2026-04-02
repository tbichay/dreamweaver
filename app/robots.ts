import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/story", "/geschichten", "/api"],
    },
    sitemap: "https://koalatree.com/sitemap.xml",
  };
}
