// app.js - نظام الحساب الواحد g000st
const API = ""; // فاضي لانه نفس السيرفر

function getSavedId() {
  return localStorage.getItem("g000st_id");
}

function saveId(id) {
  localStorage.setItem("g000st_id", id);
}

async function login(userId, name) {
  userId = String(userId || "").trim();
  if(!userId) return alert("اكتب الـ ID");
  
  try {
    let url = `/api/user/${encodeURIComponent(userId)}`;
    if(name) url += `?name=${encodeURIComponent(name)}`;
    
    let res = await fetch(url);
    let data = await res.json();
    
    if(data.ok) {
      saveId(data.id);
      console.log("تم تسجيل الدخول:", data);
      // هون بتحول المستخدم للصفحة الرئيسية
      if(window.updateUI) updateUI(data);
      return data;
    } else {
      alert("فشل تسجيل الدخول");
    }
  } catch(e) {
    console.error(e);
    alert("السيرفر مو شغال");
  }
}

async function getCurrentUser() {
  let id = getSavedId();
  if(!id) return null;
  let res = await fetch(`/api/user/${encodeURIComponent(id)}`);
  let data = await res.json();
  return data.ok ? data : null;
}

function logout() {
  localStorage.removeItem("g000st_id");
  location.reload();
}

// اذا في صفحة فيها input
document.addEventListener("DOMContentLoaded", async () => {
  let user = await getCurrentUser();
  if(user && window.updateUI) updateUI(user);
});

// مثال للاستخدام من الكونسول:
// login("test123", "احمد")
// login("رقم الموبايل")
