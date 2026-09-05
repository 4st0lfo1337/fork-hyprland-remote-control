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
// FUNÇÕES DE MÍDIA
// ================================================================

function updateMediaUI(data) {
    const titleEl = document.getElementById("media-title");
    const artistEl = document.getElementById("media-artist");
    const statusEl = document.getElementById("media-status");
    const artContainer = document.getElementById("media-art");
    const playBtn = document.getElementById("media-play-btn");

    if (data.error) {
        titleEl.textContent = "Erro";
        artistEl.textContent = "-";
        statusEl.textContent = "⚠ erro";
        return;
    }

    if (data.status === "stopped" || !data.title) {
        titleEl.textContent = "Nenhuma mídia";
        artistEl.textContent = "-";
        statusEl.textContent = "⏹ parado";
        // Limpa arte
        artContainer.innerHTML = '<div class="placeholder">no cover</div>';
        // Ícone play
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        return;
    }

    // Preenche informações
    titleEl.textContent = data.title || "Desconhecido";
    artistEl.textContent = data.artist || "Artista desconhecido";

    // Status
    let statusText = "";
    if (data.status === "playing") {
        statusText = "▶ tocando";
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else if (data.status === "paused") {
        statusText = "⏸ pausado";
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        statusText = "⏹ parado";
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    statusEl.textContent = statusText;

    // Arte
    if (data.art) {
        artContainer.innerHTML =
            `<img src="data:image/png;base64,${data.art}" alt="capa do álbum" />`;
    } else {
        artContainer.innerHTML = '<div class="placeholder">no cover</div>';
    }
}

function fetchMediaStatus() {
    fetch("/media/status")
        .then((res) => res.json())
        .then((data) => updateMediaUI(data))
        .catch((err) => console.error("Erro ao buscar status da mídia:", err));
}

function mediaControl(action) {
    fetch("/media/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("Media control:", data);
            // Atualiza status após ação
            fetchMediaStatus();
        })
        .catch((err) => console.error("Erro no controle de mídia:", err));
}

// ================================================================
// INICIALIZAÇÃO
// ================================================================

function init() {
    fetchMonitors();
    getVolume();
    fetchMediaStatus();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("focus", init);

// Atualiza periodicamente
setInterval(() => {
    fetchMonitors();
    getVolume();
    fetchMediaStatus();
}, 5000);

