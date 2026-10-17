import { defineConfig } from "astro/config";
import profile from "./src/data/profile.json" with { type: "json" };

export default defineConfig({
  site: profile.siteUrl,
});
