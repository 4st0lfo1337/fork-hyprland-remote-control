"""
Ponte de notificações desktop <-> painel (via dbus-monitor, parser robusto).
"""

import json
import os
import re
import subprocess
import threading
import time
from datetime import datetime

NOTIFICATIONS_FILE = os.path.join(os.path.dirname(__file__), 'notifications.json')
_lock = threading.Lock()
_watcher_thread = None
_stop_event = threading.Event()


def _load_notifications():
    if os.path.exists(NOTIFICATIONS_FILE):
        try:
            with open(NOTIFICATIONS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save_notifications(notifications):
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)


def _parse_block(block: str):
    strings = re.findall(r'string "((?:[^"\\]|\\.)*)"', block)
    if len(strings) < 4:
        print(f"[DEBUG] _parse_block falhou: encontrou {len(strings)} strings")
        return None
    app_name = strings[0] if strings[0] else "Sistema"
    summary = strings[2] if len(strings) > 2 else ""
    body = strings[3] if len(strings) > 3 else ""
    if not summary:
        return None
    return {
        "summary": summary,
        "body": body,
        "app_name": app_name,
        "timestamp": datetime.now().isoformat(),
        "read": False,
        "id": int(time.time() * 1000),
    }


def _dbus_command():
    return [
        "dbus-monitor",
        "--session",
        "type='method_call',interface='org.freedesktop.Notifications',member='Notify'",
    ]


def _watch_loop(stop_event):
    try:
        proc = subprocess.Popen(_dbus_command(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        print("[notifications_bridge] dbus-monitor iniciado")
    except FileNotFoundError:
        print("[notifications_bridge] dbus-monitor não encontrado; monitoramento desativado.")
        return

    block = []
    in_block = False

    while not stop_event.is_set():
        line = proc.stdout.readline()
        if not line:
            break
        line_str = line.decode(errors="ignore").rstrip("\n")

        # Log para depuração (remova depois)
        if line_str.strip():
            print(f"[DBG] Line: {line_str[:80]}")

        # Se começa um novo method call
        if line_str.startswith("method call") and "member=Notify" in line_str:
            # Se já estávamos acumulando um bloco, processa o anterior
            if in_block:
                block_text = "\n".join(block)
                print(f"[DEBUG] Processando bloco anterior:\n{block_text}")
                notif = _parse_block(block_text)
                if notif:
                    with _lock:
                        notifications = _load_notifications()
                        notifications.append(notif)
                        notifications = notifications[-100:]
                        _save_notifications(notifications)
                        print(f"[DEBUG] Notificação salva: {notif['summary']}")
                else:
                    print("[DEBUG] Bloco descartado (parse falhou)")
            # Inicia novo bloco
            in_block = True
            block = [line_str]
            continue

        # Se estamos dentro de um bloco e a linha é argumento (espaço/tab)
        if in_block and (line_str.startswith(" ") or line_str.startswith("\t")):
            block.append(line_str)
            continue

        # Se estamos dentro de um bloco e encontramos linha não-argumento (fim do bloco)
        if in_block:
            block_text = "\n".join(block)
            print(f"[DEBUG] Finalizando bloco:\n{block_text}")
            notif = _parse_block(block_text)
            if notif:
                with _lock:
                    notifications = _load_notifications()
                    notifications.append(notif)
                    notifications = notifications[-100:]
                    _save_notifications(notifications)
                    print(f"[DEBUG] Notificação salva: {notif['summary']}")
            else:
                print("[DEBUG] Bloco descartado (parse falhou)")
            in_block = False
            block = []

    proc.terminate()


def start_watcher():
    global _watcher_thread
    if _watcher_thread and _watcher_thread.is_alive():
        return
    _stop_event.clear()
    _watcher_thread = threading.Thread(target=_watch_loop, args=(_stop_event,), daemon=True)
    _watcher_thread.start()


def stop_watcher():
    global _watcher_thread
    if _watcher_thread and _watcher_thread.is_alive():
        _stop_event.set()
        _watcher_thread.join(timeout=2)


def send_notification(summary, body="", urgency="normal"):
    if not summary:
        return {"ok": False, "error": "summary é obrigatório"}
    cmd = ["notify-send", "--urgency", urgency, summary]
    if body:
        cmd.append(body)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return {"ok": result.returncode == 0}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except FileNotFoundError:
        return {"ok": False, "error": "notify-send não encontrado"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
