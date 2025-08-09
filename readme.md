# Hyprland Remote Control

A web-based remote control interface for managing Hyprland window manager workspaces and taking screenshots from any device on your network.

## 🖥️ Features

- **Workspace Management**: Switch between workspaces 1-10 with a clean web interface
- **Real-time Workspace Display**: Shows currently active workspace with visual highlighting
- **Screenshot Capture**: Take screenshots of the active window and automatically copy to clipboard
- **Cross-device Access**: Control your Hyprland desktop from any device with a web browser

## ⚠️ System Requirements

**This application is ONLY compatible with systems running Hyprland window manager.**

### Required Dependencies

Before running this application, you must install the following system dependencies:

1. **hyprshot** - Screenshot utility for Hyprland
2. **wl-copy** - Wayland clipboard utility
3. **jq** - JSON processor (for parsing hyprctl output)

### Installation Commands

```bash
# On Arch Linux / Arch-based distributions
sudo pacman -S hyprshot wl-clipboard jq

# On Ubuntu/Debian (you may need to build hyprshot from source)
sudo apt install wl-clipboard jq
# For hyprshot, visit: https://github.com/hyprwm/hyprshot

# On Fedora
sudo dnf install wl-clipboard jq
# For hyprshot, visit: https://github.com/hyprwm/hyprshot
```

## 🔥 Firewall Configuration

**Important**: You must configure your firewall to allow access to port 8000 for HTTP traffic.

### UFW (Ubuntu/Debian)
```bash
sudo ufw allow 8000/tcp
sudo ufw reload
```

### Firewalld (Fedora/RHEL/CentOS)
```bash
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### iptables (Manual configuration)
```bash
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

## 🚀 Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hyprland-remote-control
```

### 2. Install Python Dependencies
```bash
# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install required packages
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

The application will start on `http://0.0.0.0:8000` and will be accessible from any device on your network.

## 🌐 Usage

1. **Access the Interface**: Open a web browser and navigate to `http://YOUR_IP_ADDRESS:8000`
2. **Switch Workspaces**: Click on any workspace button (1-10) to switch to that workspace
3. **Take Screenshots**: Click the "Take Screenshot" button to capture the active window
   - Screenshots are automatically copied to your system clipboard
   - The image is also served directly to your browser

## 🔧 API Endpoints

- `GET /` - Main web interface
- `GET /workspace` - Get current active workspace ID
- `POST /workspace/switch` - Switch to a specific workspace
- `GET /screenshot/take` - Take a screenshot and return the image. This endpoint also copies the screenshot to the host's clipboard.

## 🛠️ Technical Details

- **Backend**: Flask (Python)
- **Frontend**: HTML, JavaScript, Tailwind CSS
- **Hyprland Integration**: Uses `hyprctl` commands for workspace management
- **Screenshot Tool**: Integrates with `hyprshot` for window captures
- **Clipboard**: Uses `wl-copy` for Wayland clipboard integration

## 🔒 Security Notes

- The application runs on all network interfaces (`0.0.0.0`) for remote access
- Ensure your network is trusted when using this application
- Consider using a VPN or restricting access to specific IP ranges if needed

## 🐛 Troubleshooting

### Common Issues

1. **"Command not found" errors**: Ensure all system dependencies are installed
2. **Permission denied**: Make sure your user has access to Hyprland commands
3. **Network access issues**: Check firewall settings and ensure port 8000 is open
4. **Screenshot failures**: Verify `hyprshot` and `wl-copy` are properly installed

### Debug Mode

The application runs in debug mode by default. Check the terminal output for detailed error messages.

## 📱 Mobile Friendly

The web interface is responsive and works well on mobile devices, making it easy to control your desktop from your phone or tablet.

---

**Note**: This project is specifically designed for Hyprland window manager and will not work with other window managers or desktop environments.
