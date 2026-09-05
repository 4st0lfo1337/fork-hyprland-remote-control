// ================================================================
// FUNÇÕES DE WORKSPACE E MONITORES
// ================================================================

function highlightWorkspaceButtons(monitors) {
    document.querySelectorAll(".workspace-btn").forEach((btn) => {
        btn.classList.remove("active-workspace", "focused-workspace");
    });

    monitors.forEach((mon) => {
        const wsId = mon.workspace;
        if (wsId !== undefined && wsId !== null) {
            const btn = document.getElementById(`workspace-${wsId}`);
            if (btn) {
                btn.classList.add("active-workspace");
                if (mon.focused) {
                    btn.classList.add("focused-workspace");
                }
            }
        }
    });
}

function updateMonitorsUI(monitors) {
    const container = document.getElementById("monitors-container");
    if (!container) return;

    if (!monitors || monitors.length === 0) {
        container.innerHTML =
            '<span class="text-muted" style="font-size:0.7rem;">no monitors found</span>';
        return;
    }

    let html = "";
    monitors.forEach((mon) => {
        const ws = mon.workspace !== undefined ? mon.workspace : "?";
        const focusedClass = mon.focused ? "focused" : "";
        html += `
            <div class="monitor-item">
                <span class="monitor-name">${mon.name}</span>
                <span class="monitor-ws ${focusedClass}">${ws}</span>
                ${
            mon.focused
                ? '<i class="fas fa-circle" style="color:var(--red);font-size:0.4rem;margin-left:0.2rem;"></i>'
                : ""
        }
            </div>
        `;
    });
    container.innerHTML = html;
}

function fetchMonitors() {
    fetch("/monitors")
        .then((res) => res.json())
        .then((data) => {
            if (Array.isArray(data)) {
                updateMonitorsUI(data);
                highlightWorkspaceButtons(data);
            } else {
                console.error("Unexpected monitors data:", data);
            }
        })
        .catch((err) => console.error("Error fetching monitors:", err));
}

function switchWorkspace(workspaceId) {
    const btn = document.getElementById(`workspace-${workspaceId}`);
    if (btn) {
        btn.classList.add("click-flash");
        setTimeout(() => btn.classList.remove("click-flash"), 700);
    }

    fetch("/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspaceId }),
    })
        .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then((data) => {
            console.log("Success:", data);
            fetchMonitors();
            getVolume();
            fetchMedia();
        })
        .catch((err) => console.error("Error switching workspace:", err));
}

// ================================================================
// FUNÇÕES DE VOLUME
// ================================================================

function getVolume() {
    fetch("/volume")
        .then((response) => response.json())
        .then((data) => {
            const display = document.getElementById("volume-display");
            if (data.volume !== undefined) {
                display.textContent = data.muted ? "MUTED" : data.volume + "%";
                const muteIcon = document.querySelector("#vol-mute-btn i");
                if (data.muted) {
                    muteIcon.className = "fas fa-volume-off";
                } else {
                    muteIcon.className = "fas fa-volume-mute";
                }
            }
        })
        .catch((err) => console.error("Erro ao obter volume:", err));
}

function adjustVolume(action) {
    fetch("/volume/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.volume !== undefined) {
                const display = document.getElementById("volume-display");
                display.textContent = data.muted ? "MUTED" : data.volume + "%";
            }
        })
        .catch((err) => console.error("Erro ao ajustar volume:", err));
}

function toggleMute() {
    fetch("/volume/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-mute" }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.volume !== undefined) {
                const display = document.getElementById("volume-display");
                display.textContent = data.muted ? "MUTED" : data.volume + "%";
                const muteIcon = document.querySelector("#vol-mute-btn i");
                if (data.muted) {
                    muteIcon.className = "fas fa-volume-off";
                } else {
                    muteIcon.className = "fas fa-volume-mute";
                }
            }
        })
        .catch((err) => console.error("Erro ao mutar/desmutar:", err));
}

// ================================================================
// FUNÇÕES DE MÍDIA (playerctl)
// ================================================================

function fetchMedia() {
    fetch("/media")
        .then((res) => {
            if (!res.ok) throw new Error("Erro ao buscar mídia");
            return res.json();
        })
        .then((data) => {
            updateMediaUI(data);
        })
        .catch((err) => {
            console.error("Erro ao buscar mídia:", err);
            updateMediaUI({
                title: "Nenhuma mídia",
                artist: "-",
                status: "Stopped",
                art_url: "",
            });
        });
}

function updateMediaUI(data) {
    const titleEl = document.getElementById("media-title");
    const artistEl = document.getElementById("media-artist");
    const statusEl = document.getElementById("media-status");
    const artEl = document.getElementById("media-art");
    const playBtn = document.getElementById("media-play-btn");

    titleEl.textContent = data.title || "Nenhuma mídia";
    artistEl.textContent = data.artist || "-";

    let statusText = "⏹ parado";
    if (data.status === "Playing") statusText = "▶ tocando";
    else if (data.status === "Paused") statusText = "⏸ pausado";
    statusEl.textContent = statusText;

    if (data.status === "Playing") {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    if (data.art_url && data.art_url.length > 0) {
        artEl.innerHTML =
            `<img src="${data.art_url}" alt="capa" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'>no cover</div>'" />`;
    } else {
        artEl.innerHTML = `<div class="placeholder">no cover</div>`;
    }
}

function mediaControl(action) {
    fetch("/media/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
    })
        .then((res) => res.json())
        .then((data) => {
            updateMediaUI(data);
        })
        .catch((err) => {
            console.error("Erro no controle de mídia:", err);
        });
}

// ================================================================
// LOCK SCREEN
// ================================================================

function lockScreen() {
    fetch("/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
        .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then((data) => {
            console.log("Lock screen:", data.message);
            document.getElementById("screenshot-result").textContent =
                "🔒 Screen locked!";
            setTimeout(() => {
                document.getElementById("screenshot-result").textContent = "";
            }, 3000);
        })
        .catch((err) => {
            console.error("Error locking screen:", err);
            document.getElementById("screenshot-result").textContent =
                "❌ Error locking screen";
        });
}

// ================================================================
// TABS
// ================================================================

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".tab-btn").forEach((b) =>
            b.classList.remove("active")
        );
        document.querySelectorAll(".tab-content").forEach((c) =>
            c.classList.remove("active")
        );
        this.classList.add("active");
        const tabId = this.dataset.tab;
        document.getElementById(tabId).classList.add("active");
    });
});

// ================================================================
// FUNÇÕES DE SISTEMA
// ================================================================

let sysInterval = null;

function fetchSystemStats() {
    fetch("/system/stats")
        .then((res) => res.json())
        .then((data) => {
            if (data.error) {
                document.getElementById("sys-cpu-pct").textContent = "--%";
                document.getElementById("sys-ram-pct").textContent = "--%";
                return;
            }
            document.getElementById("sys-cpu-pct").textContent =
                data.cpu.percent + "%";
            document.getElementById("sys-cpu-bar").style.width =
                data.cpu.percent + "%";
            document.getElementById("sys-cpu-temp").textContent =
                data.cpu.temp !== null ? data.cpu.temp + "°C" : "--°C";
            document.getElementById("sys-cpu-freq").textContent =
                data.cpu.freq !== null ? data.cpu.freq + " GHz" : "-- GHz";

            document.getElementById("sys-ram-pct").textContent =
                data.ram.percent + "%";
            document.getElementById("sys-ram-bar").style.width =
                data.ram.percent + "%";
            document.getElementById("sys-ram-used").textContent =
                data.ram.used + " / " + data.ram.total + " GB";

            const gpuContainer = document.getElementById("gpu-container");
            if (data.gpu) {
                gpuContainer.style.display = "block";
                document.getElementById("sys-gpu-pct").textContent =
                    data.gpu.util + "%";
                document.getElementById("sys-gpu-bar").style.width =
                    data.gpu.util + "%";
                document.getElementById("sys-gpu-vram").textContent = "VRAM " +
                    data.gpu.vram_used + " / " + data.gpu.vram_total + " MB";
                document.getElementById("sys-gpu-temp").textContent =
                    data.gpu.temp + "°C";
            } else {
                gpuContainer.style.display = "none";
            }

            const list = document.getElementById("sys-process-list");
            if (data.processes && data.processes.length) {
                list.innerHTML = data.processes
                    .map(
                        (p) =>
                            `<div class="flex justify-between border-b border-zinc-800 py-0.5">
                                <span class="truncate max-w-[60%]">${p.name}</span>
                                <span>${p.mem}% mem · ${p.cpu}% cpu</span>
                            </div>`,
                    )
                    .join("");
            } else {
                list.innerHTML =
                    '<span class="text-zinc-600">Nenhum processo</span>';
            }
        })
        .catch((err) => console.error("Erro ao buscar stats:", err));
}

// ================================================================
// FUNÇÕES DE MICROFONE
// ================================================================

let micInterval = null;
let isMicDragging = false;

function fetchMicStatus() {
    fetch("/mic/status")
        .then((res) => res.json())
        .then((data) => {
            if (data.error) return;
            const display = document.getElementById("mic-volume-display");
            const slider = document.getElementById("mic-slider");
            if (!isMicDragging) {
                display.textContent = data.muted ? "MUTED" : data.volume + "%";
                slider.value = data.volume;
            }
            const muteBtn = document.getElementById("mic-mute-btn");
            const icon = muteBtn.querySelector("i");
            if (data.muted) {
                icon.className = "fas fa-microphone-slash";
                muteBtn.style.color = "#ff5252";
                document.getElementById("mic-status-text").textContent =
                    "🔇 MUTADO";
            } else {
                icon.className = "fas fa-microphone";
                muteBtn.style.color = "";
                document.getElementById("mic-status-text").textContent =
                    "🔊 Ativo (" + data.volume + "%)";
            }
        })
        .catch((err) =>
            console.error("Erro ao buscar status do microfone:", err)
        );
}

function toggleMicMute() {
    fetch("/mic/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.ok) fetchMicStatus();
        })
        .catch((err) => console.error("Erro ao mutar microfone:", err));
}

function fetchMicSources() {
    fetch("/mic/sources")
        .then((res) => res.json())
        .then((sources) => {
            const list = document.getElementById("mic-source-list");
            if (!sources || !sources.length) {
                list.innerHTML =
                    '<span class="text-zinc-600">Nenhuma fonte encontrada</span>';
                return;
            }
            list.innerHTML = sources
                .map(
                    (s) =>
                        `<div class="flex justify-between border-b border-zinc-800 py-0.5 cursor-pointer hover:bg-zinc-800 source-item" data-id="${s.id}">
                            <span class="truncate">${s.name}</span>
                            <span class="text-[0.5rem] text-zinc-500">definir</span>
                        </div>`,
                )
                .join("");
            list.querySelectorAll(".source-item").forEach((el) => {
                el.addEventListener("click", function () {
                    const id = this.dataset.id;
                    fetch("/mic/source", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: id }),
                    })
                        .then((res) => res.json())
                        .then((data) => {
                            if (data.ok) {
                                fetchMicSources();
                                fetchMicStatus();
                            }
                        });
                });
            });
        })
        .catch((err) => console.error("Erro ao listar fontes:", err));
}

// Inicialização do slider
document.addEventListener("DOMContentLoaded", function () {
    const micSlider = document.getElementById("mic-slider");
    if (micSlider) {
        micSlider.addEventListener("pointerdown", () => {
            isMicDragging = true;
        });
        micSlider.addEventListener("input", function () {
            document.getElementById("mic-volume-display").textContent =
                this.value + "%";
        });
        micSlider.addEventListener("change", function () {
            isMicDragging = false;
            fetch("/mic/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pct: parseInt(this.value) }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.ok) fetchMicStatus();
                });
        });
    }
});

// ================================================================
// INICIALIZAÇÃO
// ================================================================

function init() {
    fetchMonitors();
    getVolume();
    fetchMedia();
    fetchSystemStats();
    fetchMicStatus();
    fetchMicSources();

    if (sysInterval) clearInterval(sysInterval);
    sysInterval = setInterval(fetchSystemStats, 2000);
    if (micInterval) clearInterval(micInterval);
    micInterval = setInterval(fetchMicStatus, 2000);
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("focus", init);

setInterval(() => {
    fetchMonitors();
    getVolume();
    fetchMedia();
}, 5000);

