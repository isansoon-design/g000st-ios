const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.post("/api/ai", async (req,res)=>{
  try{
    const {prompt, context} = req.body;
    const c = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {role:"system", content: "You are Ghost AI for g000st. Answer in ENGLISH ONLY. Context: "+(context||"")},
        {role:"user", content: prompt}
      ],
      max_tokens: 500
    });
    res.json({answer: c.choices[0].message.content});
  }catch(e){ res.json({error:e.message}); }
});
app.listen(3001, ()=>console.log("Ghost AI brain on 3001 - ENGLISH ONLY"));
