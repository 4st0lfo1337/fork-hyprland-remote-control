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
            // Fallback: mostrar dados vazios
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

    // Título e artista
    titleEl.textContent = data.title || "Nenhuma mídia";
    artistEl.textContent = data.artist || "-";

    // Status
    let statusText = "⏹ parado";
    if (data.status === "Playing") statusText = "▶ tocando";
    else if (data.status === "Paused") statusText = "⏸ pausado";
    statusEl.textContent = statusText;

    // Ícone do play/pause
    if (data.status === "Playing") {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    // Arte (capa)
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
        // Remove active de todos os botões e conteúdos
        document.querySelectorAll(".tab-btn").forEach((b) =>
            b.classList.remove("active")
        );
        document.querySelectorAll(".tab-content").forEach((c) =>
            c.classList.remove("active")
        );

        // Ativa o botão clicado
        this.classList.add("active");

        // Ativa o conteúdo correspondente
        const tabId = this.dataset.tab;
        document.getElementById(tabId).classList.add("active");
    });
});

// ================================================================
// INICIALIZAÇÃO
// ================================================================

function init() {
    fetchMonitors();
    getVolume();
    fetchMedia();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("focus", init);

setInterval(() => {
    fetchMonitors();
    getVolume();
    fetchMedia();
}, 5000);

