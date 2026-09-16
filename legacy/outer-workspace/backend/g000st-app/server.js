
const http=require('http');
const fs=require('fs');
const path=require('path');
const FILE='./codes.json';
let codes=new Set();
try{if(fs.existsSync(FILE))JSON.parse(fs.readFileSync(FILE,'utf8')).forEach(c=>codes.add(c));}catch(e){}
function save(){fs.writeFileSync(FILE,JSON.stringify([...codes]));}
function gen(){
  const ch='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let c='';for(let i=0;i<50;i++)c+=ch[Math.floor(Math.random()*ch.length)];
  return c;
}
function serveFile(res,filePath){
  try{
    const data=fs.readFileSync(filePath);
    const ext=path.extname(filePath);
    const map={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':map[ext]||'text/plain','Access-Control-Allow-Origin':'*'});
    res.end(data);
  }catch(e){res.writeHead(404);res.end('Not found');}
}
const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(200);return res.end();}
  if(req.url==='/'||req.url==='/index.html'){
    return serveFile(res,path.join(__dirname,'public','index.html'));
  }
  if(req.url==='/health'){
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ok:true,count:codes.size}));
  }
  if(req.url==='/generate-code'&&req.method==='POST'){
    let body='';
    req.on('data',chunk=>body+=chunk);
    req.on('end',()=>{
      const code=gen();codes.add(code);save();
      console.log('GEN',code);
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({code,valid:true}));
    });
    return;
  }
  if(req.url==='/check-code'&&req.method==='POST'){
    let body='';
    req.on('data',chunk=>body+=chunk);
    req.on('end',()=>{
      try{
        const {code}=JSON.parse(body||'{}');
        console.log('CHECK',code,'len',code?.length);
        if(!code||code.length!==50){
          res.writeHead(200,{'Content-Type':'application/json'});
          return res.end(JSON.stringify({valid:false,reason:'must be 50',got:code?.length||0}));
        }
        const valid=codes.has(code);
        console.log('CHECK result',valid);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({valid,source:'local'}));
      }catch(e){
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({valid:false,reason:'parse error'}));
      }
    });
    return;
  }
  // static public
  if(req.url.startsWith('/public/')||req.url.startsWith('/assets/')||req.url.includes('.')){
    const fp=path.join(__dirname,req.url);
    if(fs.existsSync(fp))return serveFile(res,fp);
  }
  // try public folder
  const tryFile=path.join(__dirname,'public',req.url);
  if(fs.existsSync(tryFile)&&fs.statSync(tryFile).isFile())return serveFile(res,tryFile);
  res.writeHead(404);res.end('Not found '+req.url);
});
const PORT = Number(process.env.PORT || 3000);
server.listen(PORT,()=>console.log('g000st NO-DEPS running on '+PORT+' - count '+codes.size));
