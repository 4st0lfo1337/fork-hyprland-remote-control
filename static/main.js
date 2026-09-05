// =========================================================
// WORKSPACE FUNCTIONS
// =========================================================

function highlightWorkspaceButton(workspaceId) {
    document.querySelectorAll("button").forEach((button) => {
        button.classList.remove("bg-blue-700");
        button.classList.add("bg-blue-500");
    });
    const button = document.getElementById(`workspace-${workspaceId}`);
    if (button) {
        button.classList.remove("bg-blue-500");
        button.classList.add("bg-blue-700");
    }
}

function switchWorkspace(workspaceId) {
    fetch("/workspace/switch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            workspace: workspaceId,
        }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            console.log("Success:", data);
            init();
        })
        .catch((error) => console.error("Error switching workspace:", error));
}

function init() {
    fetch("/workspace")
        .then((response) => response.json())
        .then((data) => {
            if (data.workspace) {
                highlightWorkspaceButton(data.workspace || 1);
            }
        })
        .catch((error) =>
            console.error("Error fetching current workspace:", error)
        );
}

// =========================================================
// VOLUME FUNCTIONS
// =========================================================

function getVolume() {
    fetch("/volume")
        .then((response) => response.json())
        .then((data) => {
            const display = document.getElementById("volume-display");
            if (data.volume !== undefined) {
                display.textContent = data.muted ? "MUTED" : data.volume + "%";
                // Atualiza ícone do mute
                const muteIcon = document.querySelector("#vol-mute i");
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
                // Atualiza ícone do mute
                const muteIcon = document.querySelector("#vol-mute i");
                if (data.muted) {
                    muteIcon.className = "fas fa-volume-off";
                } else {
                    muteIcon.className = "fas fa-volume-mute";
                }
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
                const muteIcon = document.querySelector("#vol-mute i");
                if (data.muted) {
                    muteIcon.className = "fas fa-volume-off";
                } else {
                    muteIcon.className = "fas fa-volume-mute";
                }
            }
        })
        .catch((err) => console.error("Erro ao mutar/desmutar:", err));
}

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    init();
    getVolume();
});

window.addEventListener("focus", () => {
    init();
    getVolume();
});

// Atualiza volume a cada 5 segundos (opcional)
setInterval(getVolume, 5000);

