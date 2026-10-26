(() => {
  "use strict";

  const STORAGE_KEY = "siaga-fire-reports-v1";
  const pages = {
    beranda: "Halaman Utama",
    pendaftaran: "Pendaftaran",
    antrean: "Antrean Laporan",
    admin: "Admin"
  };
  const statusValues = ["Menunggu", "Ditangani", "Selesai"];
  const toast = document.getElementById("toast");
  let reports = loadReports();
  let toastTimer;

  function loadReports() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error("Format data laporan tidak valid.");
      return parsed.filter((report) =>
        report && typeof report.id === "string" &&
        typeof report.reporter === "string" &&
        typeof report.phone === "string" &&
        typeof report.location === "string" &&
        typeof report.type === "string" &&
        statusValues.includes(report.status)
      );
    } catch (error) {
      console.error("Gagal membaca data laporan:", error);
      return [];
    }
  }

  function saveReports() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      return true;
    } catch (error) {
      console.error("Gagal menyimpan data laporan:", error);
      showToast("Data gagal disimpan. Periksa ruang penyimpanan browser.", true);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function initials(value) {
    return String(value || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function formatDate(value, withTime = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const options = withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
      : { day: "2-digit", month: "short", year: "numeric" };
    return new Intl.DateTimeFormat("id-ID", options).format(date).replace(/\./g, ":");
  }

  function sortedReports() {
    return [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function statusClass(status) {
    return `status-${status.toLowerCase()}`;
  }

  function statusMarkup(status) {
    return `<span class="status-pill ${statusClass(status)}">${escapeHTML(status)}</span>`;
  }

  function priorityMarkup(priority) {
    const priorityClass = `priority-${String(priority || "Sedang").toLowerCase()}`;
    return `<span class="priority-pill ${priorityClass}">${escapeHTML(priority || "Sedang")}</span>`;
  }

  function personMarkup(report, index) {
    return `<div class="reporter-cell"><span class="reporter-avatar color-${index % 4}">${escapeHTML(initials(report.reporter))}</span><span class="reporter-info"><strong>${escapeHTML(report.reporter)}</strong><small>${escapeHTML(report.location)}</small></span></div>`;
  }

  function counts() {
    return {
      total: reports.length,
      waiting: reports.filter((report) => report.status === "Menunggu").length,
      progress: reports.filter((report) => report.status === "Ditangani").length,
      completed: reports.filter((report) => report.status === "Selesai").length
    };
  }

  function renderStats() {
    const summary = counts();
    document.getElementById("stat-total").textContent = summary.total;
    document.getElementById("stat-pending").textContent = summary.waiting;
    document.getElementById("stat-progress").textContent = summary.progress;
    document.getElementById("stat-completed").textContent = summary.completed;
    document.getElementById("nav-pending-count").textContent = summary.waiting;
    document.getElementById("queue-waiting-count").textContent = summary.waiting;
    document.getElementById("queue-progress-count").textContent = summary.progress;
    document.getElementById("queue-completed-count").textContent = summary.completed;
    document.getElementById("admin-total").textContent = summary.total;
    document.getElementById("admin-pending").textContent = summary.waiting;
    document.getElementById("admin-progress").textContent = summary.progress;
    document.getElementById("admin-completed").textContent = summary.completed;
  }

  function renderRecent() {
    const tbody = document.getElementById("recent-table");
    const recent = sortedReports().slice(0, 5);
    tbody.innerHTML = recent.map((report, index) => `<tr>
      <td>${personMarkup(report, index)}</td>
      <td>${escapeHTML(report.type)}</td>
      <td class="date-cell">${escapeHTML(formatDate(report.createdAt))}</td>
      <td>${statusMarkup(report.status)}</td>
    </tr>`).join("");
    document.getElementById("recent-empty").classList.toggle("visible", recent.length === 0);
    document.querySelector(".recent-panel .table-wrap table").hidden = recent.length === 0;
  }

  function filterReports(query) {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    return sortedReports().filter((report) => [
      report.id, report.reporter, report.phone, report.location, report.type, report.status, report.priority
    ].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(normalized)));
  }

  function renderQueue() {
    const matches = filterReports(document.getElementById("queue-search").value);
    const tbody = document.getElementById("queue-table");
    tbody.innerHTML = matches.map((report, index) => `<tr>
      <td><span class="report-id">${escapeHTML(report.id)}</span></td>
      <td>${personMarkup(report, index)}</td>
      <td>${escapeHTML(report.type)}</td>
      <td class="date-cell">${escapeHTML(formatDate(report.createdAt, true))}</td>
      <td>${statusMarkup(report.status)}</td>
      <td>${priorityMarkup(report.priority)}</td>
    </tr>`).join("");
    document.getElementById("queue-empty").classList.toggle("visible", matches.length === 0);
    document.querySelector("#page-antrean .table-wrap table").hidden = matches.length === 0;
    document.getElementById("queue-result-count").textContent = `${matches.length} dari ${reports.length} laporan`;
  }

  function renderAdmin() {
    const matches = filterReports(document.getElementById("admin-search").value);
    const tbody = document.getElementById("admin-table");
    tbody.innerHTML = matches.map((report, index) => `<tr>
      <td><span class="report-id">${escapeHTML(report.id)}</span></td>
      <td>${personMarkup(report, index)}</td>
      <td>${escapeHTML(report.type)}</td>
      <td class="date-cell">${escapeHTML(formatDate(report.createdAt, true))}</td>
      <td><select class="status-select" data-status-id="${escapeHTML(report.id)}" aria-label="Ubah status laporan ${escapeHTML(report.id)}">
        ${statusValues.map((status) => `<option value="${status}" ${report.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select></td>
      <td><div class="row-actions">
        <button type="button" class="action-button" data-edit-id="${escapeHTML(report.id)}" aria-label="Edit laporan ${escapeHTML(report.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg></button>
        <button type="button" class="action-button delete" data-delete-id="${escapeHTML(report.id)}" aria-label="Hapus laporan ${escapeHTML(report.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg></button>
      </div></td>
    </tr>`).join("");
    document.getElementById("admin-empty").classList.toggle("visible", matches.length === 0);
    document.querySelector("#page-admin .table-wrap table").hidden = matches.length === 0;
  }

  function render() {
    renderStats();
    renderRecent();
    renderQueue();
    renderAdmin();
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function navigate() {
    const page = location.hash.slice(1) || "beranda";
    const selectedPage = Object.hasOwn(pages, page) ? page : "beranda";
    document.querySelectorAll(".page-view").forEach((view) => {
      view.classList.toggle("active", view.id === `page-${selectedPage}`);
    });
    document.querySelectorAll(".nav-link").forEach((link) => {
      const active = link.dataset.page === selectedPage;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.getElementById("breadcrumb-current").textContent = pages[selectedPage];
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }

  function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach((error) => {
      error.textContent = "";
      error.classList.remove("visible");
    });
    form.querySelectorAll("[aria-invalid='true']").forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function validateForm(form) {
    clearErrors(form);
    let firstInvalid = null;
    for (const input of form.querySelectorAll("[required]")) {
      let message = "";
      if (!input.value.trim()) message = "Bagian ini wajib diisi.";
      else if (input.name === "phone" && !/^[0-9+()\-\s]{8,20}$/.test(input.value.trim())) {
        message = "Masukkan nomor telepon yang valid.";
      }
      if (message) {
        input.setAttribute("aria-invalid", "true");
        const error = input.parentElement.querySelector(".field-error");
        if (error) {
          error.textContent = message;
          error.classList.add("visible");
        }
        firstInvalid ||= input;
      }
    }
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function createReport(form) {
    if (!validateForm(form)) return;
    const data = new FormData(form);
    const now = new Date();
    const report = {
      id: `LPR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      reporter: String(data.get("reporter")).trim(),
      phone: String(data.get("phone")).trim(),
      location: String(data.get("location")).trim(),
      type: String(data.get("type")),
      priority: String(data.get("priority") || "Sedang"),
      description: String(data.get("description") || "").trim(),
      status: "Menunggu",
      createdAt: now.toISOString()
    };
    reports.unshift(report);
    if (!saveReports()) {
      reports.shift();
      return;
    }
    form.reset();
    render();
    showToast(`Laporan ${report.id} berhasil didaftarkan.`);
    location.hash = "antrean";
  }

  const editDialog = document.getElementById("edit-dialog");
  const editForm = document.getElementById("edit-form");

  function openEdit(id) {
    const report = reports.find((item) => item.id === id);
    if (!report) {
      showToast("Laporan tidak ditemukan.", true);
      return;
    }
    for (const [key, value] of Object.entries(report)) {
      const field = editForm.elements.namedItem(key);
      if (field) field.value = value;
    }
    editDialog.showModal();
  }

  function updateReport(form) {
    if (!form.reporter.value.trim() || !form.phone.value.trim() || !form.location.value.trim() || !form.type.value) {
      showToast("Lengkapi semua informasi wajib sebelum menyimpan.", true);
      return;
    }
    if (!/^[0-9+()\-\s]{8,20}$/.test(form.phone.value.trim())) {
      showToast("Masukkan nomor telepon yang valid.", true);
      form.phone.focus();
      return;
    }
    const index = reports.findIndex((report) => report.id === form.id.value);
    if (index < 0) {
      showToast("Laporan tidak ditemukan.", true);
      editDialog.close();
      return;
    }
    const previous = reports[index];
    reports[index] = {
      ...previous,
      reporter: form.reporter.value.trim(),
      phone: form.phone.value.trim(),
      location: form.location.value.trim(),
      type: form.type.value,
      priority: form.priority.value,
      status: form.status.value,
      description: form.description.value.trim()
    };
    if (!saveReports()) {
      reports[index] = previous;
      return;
    }
    editDialog.close();
    render();
    showToast(`Laporan ${previous.id} berhasil diperbarui.`);
  }

  function deleteReport(id) {
    const report = reports.find((item) => item.id === id);
    if (!report) {
      showToast("Laporan tidak ditemukan.", true);
      return;
    }
    if (!window.confirm(`Hapus laporan ${id} dari ${report.reporter}? Data yang dihapus tidak dapat dipulihkan.`)) return;
    const previousReports = reports;
    reports = reports.filter((item) => item.id !== id);
    if (!saveReports()) {
      reports = previousReports;
      return;
    }
    render();
    showToast(`Laporan ${id} berhasil dihapus.`);
  }

  function changeStatus(id, status) {
    if (!statusValues.includes(status)) {
      showToast("Status laporan tidak valid.", true);
      renderAdmin();
      return;
    }
    const report = reports.find((item) => item.id === id);
    if (!report) {
      showToast("Laporan tidak ditemukan.", true);
      renderAdmin();
      return;
    }
    const previousStatus = report.status;
    report.status = status;
    if (!saveReports()) {
      report.status = previousStatus;
      render();
      return;
    }
    render();
    showToast(`Status laporan ${id} diperbarui menjadi ${status}.`);
  }

  document.getElementById("report-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createReport(event.currentTarget);
  });
  document.getElementById("report-form").addEventListener("reset", (event) => {
    const form = event.currentTarget;
    window.setTimeout(() => clearErrors(form), 0);
  });
  document.getElementById("queue-search").addEventListener("input", renderQueue);
  document.getElementById("admin-search").addEventListener("input", renderAdmin);
  document.getElementById("admin-table").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-id]");
    const deleteButton = event.target.closest("[data-delete-id]");
    if (editButton) openEdit(editButton.dataset.editId);
    if (deleteButton) deleteReport(deleteButton.dataset.deleteId);
  });
  document.getElementById("admin-table").addEventListener("change", (event) => {
    const select = event.target.closest("[data-status-id]");
    if (select) changeStatus(select.dataset.statusId, select.value);
  });
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateReport(editForm.elements);
  });
  document.getElementById("dialog-close").addEventListener("click", () => editDialog.close());
  document.getElementById("dialog-cancel").addEventListener("click", () => editDialog.close());
  editDialog.addEventListener("click", (event) => {
    if (event.target === editDialog) editDialog.close();
  });
  document.getElementById("menu-toggle").addEventListener("click", (event) => {
    const sidebar = document.getElementById("sidebar");
    const isOpen = sidebar.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  });
  window.addEventListener("hashchange", navigate);

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date());
  navigate();
  render();
})();
