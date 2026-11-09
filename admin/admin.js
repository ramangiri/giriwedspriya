"use strict";
const $ = selector => document.querySelector(selector);
const loginForm = $("#loginForm");
const loginMessage = $("#loginMessage");
const loginPanel = $("#loginPanel");
const dashboard = $("#dashboard");
const banner = $("#sourceBanner");
const countIds = ["peopleCount","yesCount","noCount","totalCount"];
let authorization = "";
let allEntries = [];
let source = "none";

function normalize(raw) {
  const response = String(raw.attendance || "").toLowerCase().trim();
  const attendance = response === "yes" || /^(accept|attending|joyfully|true)$/i.test(response)
    ? "yes" : response === "no" || /^(declin|not attending|false|sorry)/i.test(response)
    ? "no" : "unknown";
  const value = Number.parseInt(raw.guests, 10);
  const guests = attendance === "yes"
    ? Number.isFinite(value) ? Math.max(1, Math.min(15, value)) : 1
    : 0;
  return {
    id: String(raw.id || ""),
    name: String(raw.name || "").slice(0,100),
    contact: String(raw.contact || "").slice(0,140),
    message: String(raw.message || "").slice(0,500),
    attendance, guests,
    submitted: String(raw.submitted || "")
  };
}
function setBanner(message, good = false) {
  banner.textContent = message;
  banner.classList.toggle("good", good);
}
function summarize(entries) {
  return {
    people: entries.reduce((sum, x) => sum + (x.attendance === "yes" ? x.guests : 0), 0),
    yes: entries.filter(x => x.attendance === "yes").length,
    no: entries.filter(x => x.attendance === "no").length,
    total: entries.length
  };
}
function render() {
  const counts = summarize(allEntries);
  [counts.people,counts.yes,counts.no,counts.total].forEach((value, i) => {
    document.getElementById(countIds[i]).textContent = String(value);
  });
  $("#sourceTag").textContent = source === "live" ? "Netlify live responses"
    : source === "csv" ? "Locally imported CSV" : "No data loaded";
  const search = $("#search").value.trim().toLowerCase();
  const filter = $("#filter").value;
  const filtered = allEntries.filter(row =>
    (filter === "all" || row.attendance === filter) &&
    (!search || row.name.toLowerCase().includes(search) || row.contact.toLowerCase().includes(search))
  );
  const tbody = $("#rsvpRows");
  tbody.replaceChildren();
  for (const item of filtered) {
    const tr = document.createElement("tr");
    const guest = document.createElement("td");
    guest.textContent = item.name || "Unnamed guest";
    if (item.contact) {
      const contact = document.createElement("small");
      contact.textContent = item.contact;
      guest.appendChild(contact);
    }
    tr.appendChild(guest);
    const reply = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status " + item.attendance;
    badge.textContent = item.attendance === "yes" ? "Attending" :
      item.attendance === "no" ? "Declined" : "Unspecified";
    reply.appendChild(badge);
    tr.appendChild(reply);
    const guests = document.createElement("td");
    guests.textContent = String(item.guests);
    tr.appendChild(guests);
    const when = document.createElement("td");
    const date = new Date(item.submitted);
    when.textContent = Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(date)
      : item.submitted.slice(0,40);
    tr.appendChild(when);
    tbody.appendChild(tr);
  }
  $("#emptyState").hidden = filtered.length !== 0;
}
async function fetchResponses() {
  const response = await fetch("/.netlify/functions/rsvp-admin", {
    method: "GET",
    headers: { Authorization: "Basic " + authorization, Accept: "application/json" },
    cache: "no-store", credentials: "omit"
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Incorrect dashboard password.");
  if (!response.ok) throw new Error(payload.error === "TOKEN_NOT_AUTHORIZED"
    ? "The Netlify token is invalid or lacks access to the RSVP form."
    : "Could not reach the secure RSVP server. Try again.");
  return payload;
}
async function loadFromServer() {
  const payload = await fetchResponses();
  if (payload.connected) {
    source = "live";
    allEntries = (payload.entries || []).map(normalize);
    setBanner(payload.truncated
      ? "Live Netlify data loaded, but there are more than 5,000 responses. Review remaining replies in Netlify."
      : "Live responses loaded securely from Netlify Forms.", !payload.truncated);
  } else {
    source = "none";
    allEntries = [];
    setBanner("Live sync is not connected yet. Import the RSVP CSV below. The file stays on your device.");
  }
  render();
}
loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const pass = $("#password").value;
  if (!pass) return;
  authorization = btoa("admin:" + pass);
  $("#password").value = "";
  $("#loginButton").disabled = true;
  loginMessage.textContent = "Checking access…";
  try {
    await loadFromServer();
    loginPanel.hidden = true;
    dashboard.hidden = false;
    $("#logout").hidden = false;
    loginMessage.textContent = "";
  } catch (error) {
    authorization = "";
    loginMessage.textContent = error.message || "Could not unlock dashboard.";
  } finally {
    $("#loginButton").disabled = false;
  }
});
$("#logout").addEventListener("click", () => {
  authorization = "";
  allEntries = [];
  source = "none";
  dashboard.hidden = true;
  loginPanel.hidden = false;
  $("#logout").hidden = true;
  $("#csvFile").value = "";
  $("#loginMessage").textContent = "";
  $("#password").focus();
});
$("#refresh").addEventListener("click", async () => {
  if (!authorization) return;
  $("#refresh").disabled = true;
  try { await loadFromServer(); }
  catch(error) { setBanner(error.message || "Unable to refresh."); }
  finally { $("#refresh").disabled = false; }
});
$("#search").addEventListener("input", render);
$("#filter").addEventListener("change", render);

// RFC 4180-style CSV parser. All imported content stays in this browser's
// memory; it is never uploaded, cached, or written to localStorage.
function parseCSV(sourceText) {
  const text = sourceText.replace(/^\uFEFF/,"");
  const rows = []; let row = [], field = "", quoted = false;
  for(let i=0;i<text.length;i++) {
    const c = text[i];
    if(quoted){
      if(c === '"' && text[i+1] === '"'){field += '"';i++;}
      else if(c === '"') quoted = false;
      else field += c;
    } else if(c === '"') quoted = true;
    else if(c === ','){row.push(field);field="";}
    else if(c === "\n" || c === "\r"){
      if(c === "\r" && text[i+1] === "\n")i++;
      row.push(field);field="";
      if(row.some(x=>x.trim()))rows.push(row);
      row=[];
    } else field += c;
  }
  row.push(field);
  if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function parseEntriesFromCSV(text) {
  const rows = parseCSV(text);
  if(rows.length === 0)throw new Error("This CSV is empty.");
  const headers = rows.shift().map(x=>x.toLowerCase().trim());
  const field = (row,names) => {
    for(const name of names){
      let index=headers.indexOf(name);
      if(index === -1)index=headers.indexOf("data."+name);
      if(index >= 0)return String(row[index] || "");
    }
    return "";
  };
  if (!["guest_name","attendance"].every(name =>
    headers.includes(name) || headers.includes("data."+name)
  ))throw new Error("Choose the wedding-rsvp CSV from Netlify Forms. It needs guest_name and attendance columns.");
  return rows.map(row=>normalize({
    name:field(row,["guest_name","name"]),
    attendance:field(row,["attendance"]),
    guests:field(row,["guests"]),
    contact:field(row,["contact"]),
    message:field(row,["message"]),
    submitted:field(row,["created_at","submitted","date"]),
    id:field(row,["id","submission_id"])
  }));
}
$("#csvFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if(!file)return;
  const feedback = $("#importMessage");
  feedback.textContent = "Reading your CSV locally…";
  try{
    if(file.size > 5_000_000)throw new Error("This CSV is too large (5 MB maximum).");
    const entries = parseEntriesFromCSV(await file.text());
    allEntries = entries;
    source = "csv";
    feedback.textContent = String(entries.length) + " RSVP responses imported from your device.";
    setBanner("CSV imported locally. Counts reflect this file, not automatically updated Netlify submissions.", true);
    render();
  }catch(error){feedback.textContent = error.message || "Could not import this CSV.";}
});
