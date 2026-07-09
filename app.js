const STORAGE_KEY = "trade-note-records-v1";

const form = document.querySelector("#tradeForm");
const list = document.querySelector("#tradeList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const toast = document.querySelector("#toast");

let trades = loadTrades();

function loadTrades() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 2
  }).format(value);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function setDefaultDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.querySelector("#tradedAt").value = now.toISOString().slice(0, 16);
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = trades
    .filter((trade) => trade.symbol.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.tradedAt) - new Date(a.tradedAt));

  emptyState.classList.toggle("hidden", filtered.length > 0 || trades.length > 0);
  list.innerHTML = "";

  if (!filtered.length && trades.length) {
    list.innerHTML = '<div class="empty-state"><h3>該当する記録がありません</h3><p>検索語を変えてお試しください。</p></div>';
  } else {
    filtered.forEach((trade) => {
      const date = new Date(trade.tradedAt);
      const item = document.createElement("article");
      item.className = "trade-item";
      item.innerHTML = `
        <span class="side-badge ${trade.side === "sell" ? "sell" : ""}">${trade.side === "buy" ? "買い" : "売り"}</span>
        <div class="symbol">
          <strong>${escapeHtml(trade.symbol)}</strong>
          <small>${Number(trade.quantity).toLocaleString("ja-JP")}株 × ${yen(trade.price)}</small>
        </div>
        <div class="amount">
          <strong>${yen(trade.price * trade.quantity)}</strong>
          <small>約定金額</small>
        </div>
        <time class="date">${date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}<br>${date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time>
        <div class="actions">
          <button class="icon-button" type="button" data-edit="${trade.id}" aria-label="編集">✎</button>
          <button class="icon-button delete" type="button" data-delete="${trade.id}" aria-label="削除">×</button>
        </div>
        ${trade.memo ? `<p class="memo">${escapeHtml(trade.memo)}</p>` : ""}
      `;
      list.append(item);
    });
  }

  document.querySelector("#tradeCount").textContent = trades.length.toLocaleString("ja-JP");
  const buyTotal = trades.filter((t) => t.side === "buy").reduce((sum, t) => sum + t.price * t.quantity, 0);
  const sellTotal = trades.filter((t) => t.side === "sell").reduce((sum, t) => sum + t.price * t.quantity, 0);
  document.querySelector("#buyTotal").textContent = yen(buyTotal);
  document.querySelector("#sellTotal").textContent = yen(sellTotal);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function resetForm() {
  form.reset();
  document.querySelector("#tradeId").value = "";
  document.querySelector("#formTitle").textContent = "トレードを記録";
  document.querySelector("#submitLabel").textContent = "記録を保存";
  document.querySelector("#cancelEditButton").classList.add("hidden");
  setDefaultDate();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#tradeId").value;
  const trade = {
    id: id || crypto.randomUUID(),
    symbol: document.querySelector("#symbol").value.trim(),
    side: new FormData(form).get("side"),
    price: Number(document.querySelector("#price").value),
    quantity: Number(document.querySelector("#quantity").value),
    tradedAt: document.querySelector("#tradedAt").value,
    memo: document.querySelector("#memo").value.trim()
  };

  if (id) {
    trades = trades.map((item) => item.id === id ? trade : item);
    showToast("記録を更新しました");
  } else {
    trades.push(trade);
    showToast("トレードを保存しました");
  }

  saveTrades();
  resetForm();
  render();
});

list.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const trade = trades.find((item) => item.id === editId);
    document.querySelector("#tradeId").value = trade.id;
    document.querySelector("#symbol").value = trade.symbol;
    document.querySelector(`input[name="side"][value="${trade.side}"]`).checked = true;
    document.querySelector("#price").value = trade.price;
    document.querySelector("#quantity").value = trade.quantity;
    document.querySelector("#tradedAt").value = trade.tradedAt;
    document.querySelector("#memo").value = trade.memo;
    document.querySelector("#formTitle").textContent = "記録を編集";
    document.querySelector("#submitLabel").textContent = "変更を保存";
    document.querySelector("#cancelEditButton").classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (deleteId && confirm("このトレード記録を削除しますか？")) {
    trades = trades.filter((item) => item.id !== deleteId);
    saveTrades();
    render();
    showToast("記録を削除しました");
  }
});

document.querySelector("#cancelEditButton").addEventListener("click", resetForm);
searchInput.addEventListener("input", render);

document.querySelector("#exportButton").addEventListener("click", () => {
  if (!trades.length) {
    showToast("書き出す記録がありません");
    return;
  }
  const header = ["銘柄", "売買", "約定価格", "数量", "約定日時", "メモ"];
  const rows = trades.map((t) => [t.symbol, t.side === "buy" ? "買い" : "売り", t.price, t.quantity, t.tradedAt, t.memo]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trade-note-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSVを書き出しました");
});

setDefaultDate();
render();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./service-worker.js");
}
