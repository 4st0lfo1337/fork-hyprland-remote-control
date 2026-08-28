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

## Firewall Configuration

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
sudo iptables-save > /etc/iptables/rules.v4Setup Instructions

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
