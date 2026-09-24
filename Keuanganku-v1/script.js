const STORAGE_KEY = "keuanganku_transactions_v1";
const THEME_KEY = "keuanganku_theme_v1";

const categories = {
  expense: [
    ["food", "🍚", "Makan"],
    ["transport", "🚆", "Transportasi"],
    ["indonesia", "🇮🇩", "Kirim ke Indonesia"],
    ["saving", "💰", "Tabungan"],
    ["shopping", "🛒", "Belanja"],
    ["bill", "📱", "Tagihan"],
    ["other", "📦", "Lainnya"]
  ],
  income: [
    ["salary", "💼", "Gaji"],
    ["bonus", "🎁", "Bonus"],
    ["other_income", "💴", "Pemasukan lain"]
  ]
};

let transactions = loadData();
let currentType = "expense";
let chart = null;

const $ = id => document.getElementById(id);

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function yen(n) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = today()) {
  return date.slice(0, 7);
}

function monthName(key) {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
    .format(new Date(Number(y), Number(m) - 1, 1));
}

function categoryInfo(type, id) {
  const list = categories[type] || [];
  return list.find(x => x[0] === id) || ["other", "📦", "Lainnya"];
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = $(page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (page === "dashboard") renderDashboard();
  if (page === "transactions") renderTransactions();
}

function openAdd(type = "expense") {
  showPage("add");
  $("editId").value = "";
  $("formTitle").textContent = "Tambah transaksi";
  $("amount").value = "";
  $("description").value = "";
  $("date").value = today();
  $("cancelEdit").classList.add("hidden");
  setType(type);
}

function setType(type) {
  currentType = type;
  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  $("category").innerHTML = categories[type]
    .map(([id, icon, name]) => `<option value="${id}">${icon} ${name}</option>`)
    .join("");
}

function categoryName(type, id) {
  const [_, icon, name] = categoryInfo(type, id);
  return `${icon} ${name}`;
}

function renderDashboard() {
  const key = monthKey();
  $("monthLabel").textContent = monthName(key);

  const monthTx = transactions.filter(t => t.date.startsWith(key));
  const income = monthTx.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);
  const saving = monthTx.filter(t => t.type === "expense" && t.category === "saving").reduce((s,t) => s + t.amount, 0);
  const transfer = monthTx.filter(t => t.type === "expense" && t.category === "indonesia").reduce((s,t) => s + t.amount, 0);
  const balance = transactions.reduce((s,t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  $("balance").textContent = yen(balance);
  $("income").textContent = yen(income);
  $("expense").textContent = yen(expense);
  $("saving").textContent = yen(saving);
  $("transfer").textContent = yen(transfer);

  renderChart(monthTx);
  renderRecent();
}

function renderChart(monthTx) {
  const expenseTx = monthTx.filter(t => t.type === "expense");
  const grouped = {};
  expenseTx.forEach(t => {
    const [id, icon, name] = categoryInfo(t.type, t.category);
    grouped[name] = (grouped[name] || 0) + t.amount;
  });

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  $("emptyChart").classList.toggle("hidden", labels.length > 0);

  if (chart) chart.destroy();

  chart = new Chart($("expenseChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { color: getComputedStyle(document.body).getPropertyValue("--text") } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${yen(ctx.raw)}`
          }
        }
      },
      cutout: "65%"
    }
  });
}

function transactionHTML(t) {
  const [id, icon, name] = categoryInfo(t.type, t.category);
  const sign = t.type === "income" ? "+" : "-";
  const cls = t.type === "income" ? "tx-income" : "tx-expense";
  const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(t.date + "T00:00:00"));

  return `
    <div class="transaction">
      <div class="tx-icon">${icon}</div>
      <div class="tx-main">
        <strong>${escapeHTML(name)}</strong>
        <small>${date}${t.description ? " • " + escapeHTML(t.description) : ""}</small>
      </div>
      <div class="tx-amount">
        <strong class="${cls}">${sign}${yen(t.amount)}</strong>
        <div class="tx-actions">
          <button class="mini-btn" onclick="editTransaction('${t.id}')">Edit</button>
          <button class="mini-btn" onclick="deleteTransaction('${t.id}')">Hapus</button>
        </div>
      </div>
    </div>
  `;
}

function renderRecent() {
  const list = [...transactions].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  $("recentTransactions").innerHTML = list.length
    ? list.map(transactionHTML).join("")
    : `<div class="settings-card"><p class="muted">Belum ada transaksi. Tekan tombol ＋ untuk mulai.</p></div>`;
}

function renderTransactions() {
  const type = $("filterType").value;
  const category = $("filterCategory").value;

  const filtered = [...transactions]
    .filter(t => type === "all" || t.type === type)
    .filter(t => category === "all" || t.category === category)
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  $("allTransactions").innerHTML = filtered.length
    ? filtered.map(transactionHTML).join("")
    : `<div class="settings-card"><p class="muted">Tidak ada transaksi yang cocok.</p></div>`;
}

function updateCategoryFilter() {
  const all = [...categories.expense, ...categories.income];
  const unique = [...new Map(all.map(x => [x[0], x])).values()];
  $("filterCategory").innerHTML = `<option value="all">Semua kategori</option>` +
    unique.map(([id, icon, name]) => `<option value="${id}">${icon} ${name}</option>`).join("");
}

function editTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  showPage("add");
  $("editId").value = t.id;
  $("formTitle").textContent = "Edit transaksi";
  $("amount").value = t.amount;
  $("date").value = t.date;
  $("description").value = t.description || "";
  setType(t.type);
  $("category").value = t.category;
  $("cancelEdit").classList.remove("hidden");
}

function deleteTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`Hapus transaksi ${yen(t.amount)}?`)) return;
  transactions = transactions.filter(x => x.id !== id);
  saveData();
  renderDashboard();
  renderTransactions();
  toast("Transaksi dihapus");
}

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;

$("transactionForm").addEventListener("submit", e => {
  e.preventDefault();

  const amount = Number($("amount").value);
  if (!amount || amount <= 0) return toast("Nominal harus lebih dari 0");

  const id = $("editId").value;
  const item = {
    id: id || crypto.randomUUID(),
    type: currentType,
    amount,
    category: $("category").value,
    date: $("date").value,
    description: $("description").value.trim(),
    createdAt: id ? (transactions.find(t => t.id === id)?.createdAt || Date.now()) : Date.now()
  };

  if (id) {
    transactions = transactions.map(t => t.id === id ? item : t);
    toast("Transaksi diperbarui");
  } else {
    transactions.push(item);
    toast("Transaksi berhasil disimpan");
  }

  saveData();
  updateCategoryFilter();
  $("transactionForm").reset();
  showPage("dashboard");
});

$("cancelEdit").addEventListener("click", () => openAdd("expense"));

document.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.page === "add") openAdd();
    else showPage(btn.dataset.page);
  });
});

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => setType(btn.dataset.type));
});

$("addBtn").addEventListener("click", () => openAdd());
$("addBtn2").addEventListener("click", () => openAdd());
$("filterType").addEventListener("change", renderTransactions);
$("filterCategory").addEventListener("change", renderTransactions);

$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  $("themeBtn").textContent = document.body.classList.contains("dark") ? "🌙" : "☀️";
  renderDashboard();
});

$("clearBtn").addEventListener("click", () => {
  if (!transactions.length) return toast("Data sudah kosong");
  if (!confirm("Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.")) return;
  transactions = [];
  saveData();
  renderDashboard();
  renderTransactions();
  toast("Semua data dihapus");
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `keuanganku-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Data berhasil diexport");
});

$("importInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error();
      transactions = data;
      saveData();
      updateCategoryFilter();
      renderDashboard();
      renderTransactions();
      toast("Data berhasil diimport");
    } catch {
      toast("File JSON tidak valid");
    }
  };
  reader.readAsText(file);
});

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").classList.add("show");
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2200);
}

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  $("themeBtn").textContent = "🌙";
}

$("date").value = today();
updateCategoryFilter();
setType("expense");
renderDashboard();
