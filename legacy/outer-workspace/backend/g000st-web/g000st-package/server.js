const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const FILE = path.join(__dirname, 'users.json');
function load(){ try { return JSON.parse(fs.readFileSync(FILE,'utf8')); } catch(e){ return {}; } }
function save(db){ fs.writeFileSync(FILE, JSON.stringify(db)); }
function keep(id, name){
  id = String(id||'').trim();
  if(!id) return null;
  const db = load();
  if(!db[id]) db[id] = { id, name: name||'g000st user', at: Date.now() };
  save(db);
  return db[id];
}
app.get('/get-id', (req,res)=>{
  const u = keep(req.query.userId||req.query.id, req.query.name);
  if(!u) return res.json({ok:false});
  res.json({ok:true,userId:u.id,id:u.id,name:u.name});
});
app.get('/lookup', (req,res)=>{
  const id = String(req.query.userId||req.query.id||'').trim();
  const u = load()[id];
  if(!u) return res.json({ok:false});
  res.json({ok:true,userId:u.id,id:u.id,name:u.name});
});
app.post('/register', (req,res)=>{
  const b = req.body||{};
  const u = keep(b.userId||b.id, b.name);
  if(!u) return res.json({ok:false});
  res.json({ok:true,userId:u.id,id:u.id,name:u.name});
});
app.use(express.static('public'));
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});
app.listen(3000, ()=>console.log('g000st users ready'));
