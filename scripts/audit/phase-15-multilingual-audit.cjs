const fs=require("fs");
const ROOT="c:/Users/abhis/OneDrive/Desktop/emoji-website";
const EXPECTED=["en","es","fr","hi","de","ja","pt"];
const file=fs.readFileSync(ROOT+"/src/lib/content/localization/published-pages.ts","utf8");
const pages=[]; 
for (const line of file.split("\n")) {
  const m=line.match(/language:\s*"(\w+)".*slug:\s*"([^"]+)".*canonicalId:\s*"([^"]+)".*localizedTitle:\s*"([^"]+)".*localizedDescription:\s*"([^"]+)"/);
  if (m) pages.push({language:m[1],slug:m[2],canonicalId:m[3],title:m[4],desc:m[5]});
}
const cov={}; for (const l of EXPECTED) cov[l]={pages:0,slugs:[]};
for (const p of pages){ if(!cov[p.language]) cov[p.language]={pages:0,slugs:[]}; cov[p.language].pages++; cov[p.language].slugs.push(p.slug);} 
const slugs=[...new Set(pages.map(p=>p.slug))]; const matrix={};
for (const s of slugs){ matrix[s]={en:true}; for (const l of EXPECTED) if(l!=="en") matrix[s][l]=pages.some(p=>p.slug===s&&p.language===l);} 
const issues=[]; for (const p of pages){ if(p.language==="ja"&&p.desc.includes("affection")) issues.push({slug:p.slug,lang:p.language,issue:"English in JA description"}); if(p.language==="hi"&&/Thumbs|\u0925\u092e\u094d\u0938/.test(p.title)) issues.push({slug:p.slug,lang:p.language,issue:"Transliterated Hindi title"});} 
const report={generatedAt:new Date().toISOString(),publishedPageCount:pages.length,coverage:cov,hreflangMatrix:matrix,qualityIssues:issues};
fs.mkdirSync(ROOT+"/r2-export/manifests",{recursive:true});
fs.writeFileSync(ROOT+"/r2-export/manifests/phase-15-multilingual-audit.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

