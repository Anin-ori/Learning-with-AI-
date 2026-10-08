// Serves the page's Google Fonts from a local copy (test machines can't reach Google), so screenshots show the real type.
const fs = require("fs");
const GF = process.env.GF_DIR || "/home/claude/fonts/gf/ofl";
const FACES = [
  ["Barlow", 400, "barlow/Barlow-Regular.ttf"], ["Barlow", 500, "barlow/Barlow-Medium.ttf"], ["Barlow", 600, "barlow/Barlow-SemiBold.ttf"],
  ["Barlow Condensed", 500, "barlowcondensed/BarlowCondensed-Medium.ttf"], ["Barlow Condensed", 600, "barlowcondensed/BarlowCondensed-SemiBold.ttf"],
  ["Cormorant Garamond", "500 600", "cormorantgaramond/CormorantGaramond[wght].ttf"], ["JetBrains Mono", "400 500", "jetbrainsmono/JetBrainsMono[wght].ttf"], ["Manrope", "200 800", "manrope/Manrope[wght].ttf"], ["Michroma", 400, "michroma/Michroma-Regular.ttf"], ["Barlow", 700, "barlow/Barlow-Bold.ttf"], ["Barlow Condensed", 400, "barlowcondensed/BarlowCondensed-Regular.ttf"], ["Barlow Condensed", 700, "barlowcondensed/BarlowCondensed-Bold.ttf"],
  ["Montserrat", "100 900", "montserrat/Montserrat[wght].ttf"], ["Noto Sans SC", "100 900", "notosanssc/NotoSansSC[wght].ttf"],
];
const have = fs.existsSync(GF);
const css = FACES.map(([f, w, file], i) => `@font-face{font-family:"${f}";font-weight:${w};font-style:normal;font-display:block;src:url(https://fonts.gstatic.com/local/${i}.ttf) format("truetype")}`).join("\n");
module.exports = function fontRoute(D3) {
  return (r) => {
    const u = r.request().url();
    if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" });
    if (have && u.startsWith("https://fonts.googleapis.com/css2")) return r.fulfill({ body: css, contentType: "text/css", headers: { "access-control-allow-origin": "*" } });
    const m = u.match(/fonts\.gstatic\.com\/local\/(\d+)\.ttf/);
    if (have && m) return r.fulfill({ body: fs.readFileSync(GF + "/" + FACES[+m[1]][2]), contentType: "font/ttf", headers: { "access-control-allow-origin": "*" } });
    if (u.startsWith("file:")) return r.continue();
    return r.abort();
  };
};
