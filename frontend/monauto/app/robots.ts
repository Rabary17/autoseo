import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Export statique (output: "export") : la route doit être figée au build.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
