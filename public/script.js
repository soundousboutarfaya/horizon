
const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const modal = document.getElementById("modal");
const form = document.getElementById("reportForm");
const submitBtn = document.getElementById("submitBtn");
const refreshBtn = document.getElementById("refreshBtn");
const reportsList = document.getElementById("reportsList");
const errorMsg = document.getElementById("errorMsg");
const reportDate = document.getElementById("reportDate");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchResult = document.getElementById("searchResult");
const successPanel = document.getElementById("successPanel");
const successCloseBtn = document.getElementById("successCloseBtn");
const statCount = document.getElementById("statCount");
const detailModal = document.getElementById("detailModal");
const detailTitle = document.getElementById("detailTitle");
const detailCount = document.getElementById("detailCount");
const detailFirstDate = document.getElementById("detailFirstDate");
const detailTopIssue = document.getElementById("detailTopIssue");
const detailReports = document.getElementById("detailReports");
const detailCloseBtn = document.getElementById("detailCloseBtn");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");

let allReports = [];
let allViolations = [];
let activeTypeFilter = "all";
let activeYearFilter = "all";
const activeSources = { reports: true, violations: true };
const filterTypeChips = document.getElementById("filterTypeChips");
const filterSourceChips = document.getElementById("filterSourceChips");
const filterYear = document.getElementById("filterYear");
const mapCount = document.getElementById("mapCount");
const statViolations = document.getElementById("statViolations");

function extractYear(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 4);
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(s)) return s.slice(-4);
  return "";
}

function getFilteredReports() {
  return allReports.filter((r) => {
    if (activeTypeFilter !== "all" && r.issueType !== activeTypeFilter) return false;
    if (activeYearFilter !== "all") {
      if (extractYear(r.reportDate) !== activeYearFilter) return false;
    }
    return true;
  });
}

function refreshYearOptions() {
  const reportYears = allReports.map((r) => extractYear(r.reportDate));
  const violationYears = allViolations.map((v) => extractYear(v.date_jugement));
  const years = [...new Set([...reportYears, ...violationYears].filter(Boolean))].sort().reverse();
  const current = filterYear.value;
  filterYear.innerHTML = `<option value="all">Toutes</option>` + years.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (years.includes(current)) filterYear.value = current;
}

const VIOLATION_TYPE_KEYWORDS = {
  "Humidité excessive": ["humidit", "etanch", "infiltration"],
  "Moisissure": ["moisissure"],
  "Mauvaise ventilation": ["ventil", "aeration"],
  "Infestation de nuisibles": ["insecte", "punaise", "vermine", "coquerelle", "rongeur", "proliferation"],
  "Insalubrité générale": ["malproprete", "deterioration", "encombrement", "pas maintenu", "mauvais etat", "ne rempli pas", "ne remplie pas"]
};

function violationMatchesType(violation, type) {
  if (type === "all") return true;
  const keywords = VIOLATION_TYPE_KEYWORDS[type];
  if (!keywords) return true;
  const haystack = String(violation.nature_infraction || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

function getFilteredViolations() {
  return allViolations.filter((v) => {
    if (!violationMatchesType(v, activeTypeFilter)) return false;
    if (activeYearFilter !== "all") {
      if (extractYear(v.date_jugement) !== activeYearFilter) return false;
    }
    return true;
  });
}

function applyFilters() {
  const filteredReports = activeSources.reports ? getFilteredReports() : [];
  const filteredViolations = activeSources.violations ? getFilteredViolations() : [];
  updateMap(filteredReports, filteredViolations);
  renderReportsList(filteredReports);
  if (mapCount) {
    const parts = [];
    if (activeSources.reports) parts.push(`<strong>${filteredReports.length}</strong> signalement(s)`);
    if (activeSources.violations) parts.push(`<strong>${filteredViolations.length}</strong> condamnation(s)`);
    mapCount.innerHTML = parts.join(" · ") || "Aucune source sélectionnée";
  }
}

filterTypeChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  filterTypeChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");
  activeTypeFilter = btn.dataset.filterType;
  applyFilters();
});

filterYear.addEventListener("change", () => {
  activeYearFilter = filterYear.value;
  applyFilters();
});

if (filterSourceChips) {
  filterSourceChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".source-chip");
    if (!btn) return;
    const src = btn.dataset.source;
    activeSources[src] = !activeSources[src];
    btn.classList.toggle("active", activeSources[src]);
    btn.setAttribute("aria-pressed", String(activeSources[src]));
    applyFilters();
  });
}

function normalizeAddressKey(address) {
  return String(address || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function reportsAtSameAddress(report) {
  const key = normalizeAddressKey(report.address);
  return allReports.filter((r) => normalizeAddressKey(r.address) === key);
}

function mostCommonIssue(reports) {
  const counts = {};
  reports.forEach((r) => {
    counts[r.issueType] = (counts[r.issueType] || 0) + 1;
  });
  let top = "—";
  let max = 0;
  for (const [issue, count] of Object.entries(counts)) {
    if (count > max) {
      top = issue;
      max = count;
    }
  }
  return top;
}

function showDetailPanel(report) {
  const sameAddress = reportsAtSameAddress(report);
  if (sameAddress.length === 0) return;

  detailTitle.textContent = report.address;
  detailCount.textContent = sameAddress.length;

  const sortedDates = sameAddress
    .map((r) => r.reportDate)
    .filter(Boolean)
    .sort();
  detailFirstDate.textContent = sortedDates[0] || "—";
  detailTopIssue.textContent = mostCommonIssue(sameAddress);

  detailReports.innerHTML = sameAddress
    .map((r) => `
      <div class="detail-report">
        <h4>${esc(r.issueType)}</h4>
        <p><strong>Date :</strong> ${esc(r.reportDate)}</p>
        <p>${esc(r.description)}</p>
        ${r.photoPath ? `<img src="${esc(r.photoPath)}" alt="Photo du signalement" class="zoomable" data-src="${esc(r.photoPath)}">` : ""}
      </div>
    `)
    .join("");

  detailReports.querySelectorAll("img.zoomable").forEach((img) => {
    img.addEventListener("click", () => openLightbox(img.dataset.src || img.src));
    img.style.cursor = "zoom-in";
  });

  detailModal.classList.remove("hidden");
}

function hideDetailPanel() {
  detailModal.classList.add("hidden");
}

function openLightbox(src) {
  if (!src) return;
  lightboxImg.src = src;
  lightbox.classList.remove("hidden");
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
}

lightboxCloseBtn.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

detailModal.addEventListener("click", (e) => { if (e.target === detailModal) hideDetailPanel(); });

const map = L.map("map").setView([45.5017, -73.5673], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let violationsLayer = L.layerGroup().addTo(map);
const markersById = new Map();

const violationIcon = L.divIcon({
  className: "violation-marker-wrap",
  html: '<div class="violation-marker"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function showOnMap(report) {
  map.setView([report.latitude, report.longitude], 16);
  let marker = markersById.get(report.id);
  if (!marker) {
    marker = L.marker([report.latitude, report.longitude]).bindPopup(`
      <strong>${esc(report.address)}</strong><br>
      ${esc(report.issueType)}<br>
      ${esc(report.reportDate)}
    `);
    marker.addTo(markersLayer);
    markersById.set(report.id, marker);
  }
  marker.openPopup();
  document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function focusOnReport(report) {
  if (typeof report.latitude === "number" && typeof report.longitude === "number") {
    showOnMap(report);
    showDetailPanel(report);
    return;
  }

  try {
    const res = await fetch(`/api/reports/${report.id}/geocode`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.found) {
      alert("Impossible de localiser cette adresse sur la carte.");
      return;
    }
    const updated = { ...report, latitude: data.latitude, longitude: data.longitude };
    const idx = allReports.findIndex((r) => r.id === updated.id);
    if (idx >= 0) allReports[idx] = updated;
    showOnMap(updated);
    showDetailPanel(updated);
  } catch (e) {
    alert("Erreur réseau lors de la localisation.");
  }
}

function openModal() {
  modal.classList.remove("hidden");
  form.classList.remove("hidden");
  successPanel.classList.add("hidden");
  errorMsg.classList.add("hidden");
  form.reset();
  reportDate.valueAsDate = new Date();
}

function closeModal() {
  modal.classList.add("hidden");
}

function showSuccessPanel() {
  form.classList.add("hidden");
  errorMsg.classList.add("hidden");
  successPanel.classList.remove("hidden");
  successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateMap(reports, violations = []) {
  markersLayer.clearLayers();
  violationsLayer.clearLayers();
  markersById.clear();

  const validReports = reports.filter(
    (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
  );
  const validViolations = violations.filter(
    (v) => typeof v.latitude === "number" && typeof v.longitude === "number"
  );

  if (validReports.length === 0 && validViolations.length === 0) {
    map.setView([45.5017, -73.5673], 11);
    return;
  }

  const bounds = [];

  validReports.forEach((report) => {
    const sameCount = reportsAtSameAddress(report).length;
    const badge = sameCount > 1 ? `<span class="marker-count-badge">${sameCount} signalements</span>` : "";

    const marker = L.marker([report.latitude, report.longitude]).bindPopup(`
      <strong>${esc(report.address)}</strong>${badge}<br>
      ${esc(report.issueType)}<br>
      ${esc(report.reportDate)}<br>
      <span class="popup-link" data-report-id="${esc(report.id)}">Voir la fiche complète →</span>
    `);

    marker.on("popupopen", (e) => {
      const link = e.popup.getElement().querySelector(".popup-link");
      if (link) {
        link.addEventListener("click", () => showDetailPanel(report));
      }
    });

    marker.on("click", () => showDetailPanel(report));

    marker.addTo(markersLayer);
    markersById.set(report.id, marker);
    bounds.push([report.latitude, report.longitude]);
  });

  const groupedViolations = new Map();
  validViolations.forEach((v) => {
    const key = `${v.civic_no}|${v.street}|${v.arrondissement_code}`;
    if (!groupedViolations.has(key)) groupedViolations.set(key, []);
    groupedViolations.get(key).push(v);
  });

  groupedViolations.forEach((items) => {
    const v = items[0];
    const totalFines = items
      .map((it) => parseFloat(String(it.amende || "0").replace(/[^\d,.-]/g, "").replace(",", ".")))
      .filter((n) => !isNaN(n))
      .reduce((s, n) => s + n, 0);
    const fineLabel = totalFines > 0 ? `${totalFines.toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $ d'amendes` : "";
    const recent = items
      .map((it) => it.nature_infraction)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => `<li>${esc(n)}</li>`)
      .join("");

    const marker = L.marker([v.latitude, v.longitude], { icon: violationIcon }).bindPopup(`
      <strong>${esc(v.civic_no)} ${esc(v.street)}</strong><br>
      <em>${esc(v.arrondissement_name || "")}</em><br>
      <span class="violation-tag">Condamnation officielle Ville de Montréal</span><br>
      <strong>${items.length}</strong> infraction(s)${fineLabel ? ` · ${esc(fineLabel)}` : ""}
      ${recent ? `<ul class="violation-list">${recent}</ul>` : ""}
      <span class="muted">Source : données ouvertes Ville de Montréal</span>
    `);

    marker.addTo(violationsLayer);
    bounds.push([v.latitude, v.longitude]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

let chartTypes = null;
let chartMonths = null;

const CHART_COLORS = ["#2a63f6", "#d2461e", "#ffa53b", "#7a2ecc", "#14966a", "#d42a6a", "#1d7bd4"];

function renderDashboard() {
  if (typeof Chart === "undefined") return;

  const byType = {};
  const byMonth = {};

  allReports.forEach((r) => {
    byType[r.issueType] = (byType[r.issueType] || 0) + 1;
    const month = (r.reportDate || "").slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;
  });

  const typeLabels = Object.keys(byType);
  const typeValues = typeLabels.map((k) => byType[k]);
  const monthLabels = Object.keys(byMonth).sort();
  const monthValues = monthLabels.map((k) => byMonth[k]);

  const typesCtx = document.getElementById("chartTypes");
  const monthsCtx = document.getElementById("chartMonths");
  if (!typesCtx || !monthsCtx) return;

  if (chartTypes) chartTypes.destroy();
  if (chartMonths) chartMonths.destroy();

  chartTypes = new Chart(typesCtx, {
    type: "doughnut",
    data: {
      labels: typeLabels,
      datasets: [{ data: typeValues, backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "Inter, system-ui", size: 11 }, boxWidth: 12 } }
      }
    }
  });

  chartMonths = new Chart(monthsCtx, {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [{
        label: "Signalements",
        data: monthValues,
        backgroundColor: "rgba(42, 99, 246, 0.8)",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { family: "Inter, system-ui" } } },
        x: { ticks: { font: { family: "Inter, system-ui" } } }
      }
    }
  });
}

function renderReportsList(list) {
  if (list.length === 0) {
    reportsList.innerHTML = "<p class='empty'>Aucun signalement ne correspond aux filtres.</p>";
    return;
  }

  reportsList.innerHTML = list.map(report => `
    <div class="report" data-report-id="${esc(report.id)}" role="button" tabindex="0">
      <h3>${esc(report.address)}</h3>
      <p><strong>Problème :</strong> ${esc(report.issueType)}</p>
      <p><strong>Date :</strong> ${esc(report.reportDate)}</p>
      <p>${esc(report.description)}</p>
      ${report.photoPath ? `<img src="${esc(report.photoPath)}" alt="Photo" class="zoomable" data-src="${esc(report.photoPath)}">` : ""}
    </div>
  `).join("");

  reportsList.querySelectorAll("img.zoomable").forEach((img) => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      openLightbox(img.dataset.src || img.src);
    });
    img.style.cursor = "zoom-in";
  });

  reportsList.querySelectorAll(".report").forEach((card) => {
    const id = Number(card.dataset.reportId);
    const report = list.find((r) => r.id === id);
    if (!report) return;
    const activate = () => focusOnReport(report);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

function renderSkeleton(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line title"></div>
      <div class="skeleton skeleton-line medium"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line long"></div>
    </div>
  `).join("");
}

async function loadViolations() {
  try {
    const res = await fetch("/api/violations");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur violations.");
    allViolations = Array.isArray(data) ? data : [];
    if (statViolations) statViolations.textContent = allViolations.length;
  } catch (e) {
    allViolations = [];
    if (statViolations) statViolations.textContent = "0";
  }
}

async function loadReports() {
  reportsList.innerHTML = renderSkeleton(3);
  try {
    const [resReports] = await Promise.all([
      fetch("/api/reports"),
      loadViolations()
    ]);
    const data = await resReports.json();

    if (!resReports.ok) throw new Error(data.error || "Erreur.");

    allReports = Array.isArray(data) ? data : [];
    if (statCount) statCount.textContent = allReports.length;
    refreshYearOptions();
    applyFilters();
    renderDashboard();
  } catch (e) {
    reportsList.innerHTML = "Impossible de charger les signalements.";
  }
}

openBtn.addEventListener("click", openModal);
document.querySelectorAll("[data-open-modal]").forEach((el) => el.addEventListener("click", openModal));
closeBtn.addEventListener("click", closeModal);
refreshBtn.addEventListener("click", loadReports);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!lightbox.classList.contains("hidden")) { closeLightbox(); return; }
  if (!detailModal.classList.contains("hidden")) { hideDetailPanel(); return; }
  if (!modal.classList.contains("hidden")) { closeModal(); }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.classList.add("hidden");

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Envoi en cours...";

  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      body: new FormData(form)
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi.");

    await loadReports();
    showSuccessPanel();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

successCloseBtn.addEventListener("click", closeModal);
detailCloseBtn.addEventListener("click", hideDetailPanel);

const ISSUE_HEALTH_INFO = {
  "Humidité excessive": {
    title: "Risques pour la santé — Humidité excessive",
    text: "Favorise la prolifération d'acariens et de moisissures. Peut causer : rhinite allergique, exacerbation de l'asthme, infections respiratoires récurrentes, et dégradation matérielle du logement. Plus dangereux pour les enfants et les personnes asthmatiques."
  },
  "Moisissure": {
    title: "Risques pour la santé — Moisissure",
    text: "Les spores microscopiques attaquent les voies respiratoires : asthme (nouveau ou aggravé), bronchites, pneumonies, sinusites chroniques. Certaines moisissures produisent des mycotoxines cancérigènes. Consulte immédiatement le 811 si tu ressens des symptômes respiratoires."
  },
  "Mauvaise ventilation": {
    title: "Risques pour la santé — Mauvaise ventilation",
    text: "Accumulation de CO2, monoxyde de carbone, radon, composés organiques volatils (COV). Symptômes : maux de tête, fatigue, nausées, troubles de concentration. En cas de symptômes graves (étourdissement, perte de conscience), appelle le 911 immédiatement."
  },
  "Infestation de nuisibles": {
    title: "Risques pour la santé — Nuisibles (rongeurs, insectes)",
    text: "Transmission de maladies (salmonellose, leptospirose, hantavirus), allergies sévères aux déjections, piqûres et morsures infectieuses, impact majeur sur la santé mentale (stress, insomnie). Le propriétaire a l'obligation légale d'intervenir."
  },
  "Insalubrité générale": {
    title: "Risques pour la santé — Insalubrité générale",
    text: "Cumul de risques : bactéries, champignons, parasites, qualité de l'air dégradée. Impacts multiples sur la santé physique (infections, allergies, troubles respiratoires) et mentale (stress chronique, honte, isolement). Tu as le droit d'exiger un logement salubre."
  }
};

const issueSelect = document.getElementById("issueType");
const issueInfo = document.getElementById("issueInfo");

if (issueSelect && issueInfo) {
  issueSelect.addEventListener("change", () => {
    const info = ISSUE_HEALTH_INFO[issueSelect.value];
    if (!info) {
      issueInfo.classList.add("hidden");
      issueInfo.innerHTML = "";
      return;
    }
    issueInfo.innerHTML = `<strong>${esc(info.title)}</strong>${esc(info.text)}`;
    issueInfo.classList.remove("hidden");
  });
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

const siteNav = document.querySelector(".site-nav");
if (siteNav) {
  const onScroll = () => {
    siteNav.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = searchInput.value.trim();
  if (!address) return;

  searchResult.innerHTML = `<div class="result-card">Recherche en cours...</div>`;

  try {
    const res = await fetch(`/api/search?address=${encodeURIComponent(address)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erreur de recherche.");

    if (!data.found) {
      searchResult.innerHTML = `<div class="result-card">Aucune adresse trouvée pour « ${esc(address)} ».</div>`;
      return;
    }

    const matches = Array.isArray(data.matches) && data.matches.length ? data.matches : [data.data];
    const plural = matches.length > 1 ? `${matches.length} résultats` : "1 résultat";

    searchResult.innerHTML = `
      <p class="tag">${esc(plural)} — cliquer pour voir sur la carte</p>
      ${matches.map((r) => `
        <div class="result-card clickable" data-report-id="${esc(r.id)}" role="button" tabindex="0">
          <h3>${esc(r.address)}</h3>
          <p><strong>Problème :</strong> ${esc(r.issueType)}</p>
          <p><strong>Description :</strong> ${esc(r.description)}</p>
          <p><strong>Date :</strong> ${esc(r.reportDate)}</p>
          ${r.photoPath ? `<img src="${esc(r.photoPath)}" alt="Photo" class="zoomable" data-src="${esc(r.photoPath)}">` : ""}
        </div>
      `).join("")}
    `;

    searchResult.querySelectorAll(".result-card.clickable").forEach((card) => {
      const id = Number(card.dataset.reportId);
      const report = matches.find((r) => r.id === id);
      if (!report) return;
      const activate = () => focusOnReport(report);
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });

    searchResult.querySelectorAll("img.zoomable").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(img.dataset.src || img.src);
      });
      img.style.cursor = "zoom-in";
    });

    focusOnReport(matches[0]);
  } catch (err) {
    searchResult.innerHTML = `<div class="result-card">Problème réseau ou serveur indisponible. Réessaye plus tard.</div>`;
  }
});

loadReports();
