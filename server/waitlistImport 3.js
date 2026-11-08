const categories=new Set(['watches','shop','bud']);
// RFC-style quoted fields, escaped quotes and CRLF; no formulas are evaluated.
export function parseWaitlistCsv(csv, defaultCategory='watches') {
  if(typeof csv!=='string'||Buffer.byteLength(csv)>100000)throw Error('Choose a CSV file under 100 KB.');
  if(!categories.has(defaultCategory))throw Error('Choose a valid default list.');
  csv=csv.replace(/^\uFEFF/,'');
  const rows=[];let row=[],value='',quoted=false,closed=false;
  for(let i=0;i<=csv.length;i++){
    const c=csv[i]??'\n';
    if(quoted){
      if(i===csv.length)throw Error('CSV has an unclosed quoted field.');
      if(c==='"'){if(csv[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
      else value+=c;
      continue;
    }
    if(c==='"'&&!value&&!closed){quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r'){
      row.push(value.trim());value='';closed=false;
      if(c!==','){if(row.some(Boolean))rows.push(row);row=[];if(c==='\r'&&csv[i+1]==='\n')i++;}
      if(rows.length>1001)throw Error('Import at most 1,000 entries at a time.');
    }else{
      if(closed&&c.trim())throw Error('Unexpected text after a quoted field.');
      if(c==='"')throw Error('CSV quotes must surround the entire field.');
      value+=c;
    }
  }
  const header=rows.shift()?.map(h=>h.toLowerCase());
  if(!header||header.filter(h=>h==='email').length!==1||header.filter(h=>h==='category').length>1)throw Error('CSV needs one email header and an optional category header.');
  const entries=[],invalid=[];
  rows.forEach((r,i)=>{
    const email=(r[header.indexOf('email')]||'').toLowerCase();
    const category=(header.includes('category')?r[header.indexOf('category')]:null)||defaultCategory;
    const reason=r.length!==header.length?'Column count does not match header.':
      email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Invalid email address.':
      !categories.has(category)?'Category must be watches, shop or bud.':null;
    if(reason)invalid.push({row:i+2,reason});else entries.push({email,category});
  });
  return {entries,invalid,total:rows.length};
}
export function registerWaitlistImport(app,{addToWaitlist}) {
  app.post('/api/admin/waitlist/import',async(req,res)=>{
    res.set('Cache-Control','no-store');
    let imported=0,duplicates=0;
    try {
      if(req.body?.consent!==true)throw Error('Confirm you have permission to import these email addresses.');
      const parsed=parseWaitlistCsv(req.body.csv,req.body.category);
      for(const entry of parsed.entries){
        const result=await addToWaitlist(entry.email,entry.category);
        if(result.added)imported++;else duplicates++;
      }
      res.json({imported,duplicates,invalid:parsed.invalid,total:parsed.total});
    }catch(e){res.status(400).json({error:e.message,imported,duplicates});}
  });
}
