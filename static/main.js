function highlightWorkspaceButton(workspaceId) {
    // Remove highlight from all buttons
    document.querySelectorAll('button').forEach(button => {
        button.classList.remove('bg-blue-700');
        button.classList.add('bg-blue-500');
    });
    // Highlight the selected workspace button
    const button = document.getElementById(`workspace-${workspaceId}`);
    if (button) {
        button.classList.remove('bg-blue-500');
        button.classList.add('bg-blue-700');
    }
}


function switchWorkspace(workspaceId) {
    fetch('/workspace/switch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            workspace: workspaceId
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            init();
        })
}

function init() {
    // Fetch the current workspace from the server
    fetch('/workspace')
        .then(response => response.json())
        .then(data => {
            if (data.workspace) {
                highlightWorkspaceButton(data.workspace || 1);
            }
        })
        .catch(error => console.error('Error fetching current workspace:', error));
}

// Initialize the UI on page load
document.addEventListener('DOMContentLoaded', init);

// Add event listener to run on window focus
window.addEventListener('focus', () => {
    init();
})