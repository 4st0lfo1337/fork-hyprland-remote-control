from flask import Flask, render_template, jsonify, request, Response, send_file
import subprocess
import random
import os
import re
import json
from urllib.parse import unquote
import psutil

app = Flask(__name__)


@app.route('/')
def hello_world():
    return render_template('index.html')


# ---------- WORKSPACES ----------

@app.route('/workspace')
def current_workspace():
    try:
        result = subprocess.run(
            ['hyprctl', 'activeworkspace', '-j'],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(result.stdout)
        workspace_id = data.get('id')
        return jsonify({'workspace': workspace_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/workspace/switch', methods=['POST'])
def switch_workspace():
    workspace = request.json.get('workspace')
    if not workspace:
        return jsonify({'error': 'Workspace ID is required'}), 400
    try:
        subprocess.run(
            ['hyprctl', 'dispatch', 'workspace', str(workspace)],
            check=True
        )
        return jsonify({'message': f'Switched to workspace {workspace}'}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/monitors')
def get_monitors():
    try:
        result = subprocess.run(
            ['hyprctl', 'monitors', '-j'],
            capture_output=True,
            text=True,
            check=True
        )
        monitors = json.loads(result.stdout)
        output = []
        for m in monitors:
            output.append({
                'name': m.get('name'),
                'workspace': m.get('activeWorkspace', {}).get('id'),
                'focused': m.get('focused', False)
            })
        return jsonify(output), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------- SCREENSHOT ----------

@app.route('/screenshot/take', methods=['GET'])
def take_screenshot():
    filename = None
    try:
        filename = f'/tmp/screenshot_{random.randint(1000, 9999)}.png'
        command = f'hyprshot -m window -m active --raw >> {filename}'
        os.system(command)

        with open(filename, 'rb') as f:
            image_data = f.read()
        os.system(f'wl-copy < {filename}')
        return Response(image_data, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if filename and os.path.exists(filename):
            try:
                os.remove(filename)
            except OSError:
                pass


# ---------- VOLUME ----------

@app.route('/volume', methods=['GET'])
def get_volume():
    try:
        result = subprocess.run(
            ['pactl', 'get-sink-volume', '0'],
            capture_output=True,
            text=True,
            check=True
        )
        match = re.search(r'(\d+)%', result.stdout)
        volume = int(match.group(1)) if match else 0

        mute_result = subprocess.run(
            ['pactl', 'get-sink-mute', '0'],
            capture_output=True,
            text=True,
            check=True
        )
        muted = 'yes' in mute_result.stdout.lower()

        return jsonify({'volume': volume, 'muted': muted}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/volume/control', methods=['POST'])
def control_volume():
    data = request.json
    action = data.get('action')
    value = data.get('value')

    try:
        if action == 'up':
            step = value if value is not None else 5
            subprocess.run(['pactl', 'set-sink-volume', '0', f'+{step}%'], check=True)
        elif action == 'down':
            step = value if value is not None else 5
            subprocess.run(['pactl', 'set-sink-volume', '0', f'-{step}%'], check=True)
        elif action == 'set':
            if value is None:
                return jsonify({'error': 'Value required for set action'}), 400
            subprocess.run(['pactl', 'set-sink-volume', '0', f'{value}%'], check=True)
        elif action == 'toggle-mute':
            subprocess.run(['pactl', 'set-sink-mute', '0', 'toggle'], check=True)
        else:
            return jsonify({'error': 'Invalid action'}), 400

        return get_volume()
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------- LOCK SCREEN ----------

@app.route('/lock', methods=['POST'])
def lock_screen():
    try:
        subprocess.Popen(['hyprlock'], start_new_session=True)
        return jsonify({'message': 'Screen locked'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------- MEDIA CONTROL (playerctl) ----------

@app.route('/media/art')
def media_art():
    """Serve a imagem da capa a partir do caminho fornecido (ex: file:///...)."""
    path = request.args.get('path')
    if not path:
        return '', 404

    # Remove prefixo file:// e decodifica
    if path.startswith('file://'):
        path = path[7:]
    path = unquote(path)

    # Verifica se o arquivo existe e é uma imagem
    if os.path.isfile(path):
        return send_file(path, mimetype='image/jpeg')
    else:
        return '', 404


@app.route('/media', methods=['GET'])
def get_media():
    """Retorna informações da mídia atual e URL da capa (acessível via /media/art)."""
    try:
        # Tenta obter o título
        title_cmd = ['playerctl', 'metadata', '--format', '{{ title }}']
        title = subprocess.run(title_cmd, capture_output=True, text=True).stdout.strip()
        if not title:
            title = "Nenhuma mídia"

        # Artista
        artist_cmd = ['playerctl', 'metadata', '--format', '{{ artist }}']
        artist = subprocess.run(artist_cmd, capture_output=True, text=True).stdout.strip()
        if not artist:
            artist = "-"

        # Status (Playing, Paused, Stopped)
        status_cmd = ['playerctl', 'status']
        status = subprocess.run(status_cmd, capture_output=True, text=True).stdout.strip()
        if status not in ['Playing', 'Paused']:
            status = 'Stopped'

        # Tentar obter URL da capa (mpris:artUrl)
        art_cmd = ['playerctl', 'metadata', '--format', '{{ mpris:artUrl }}']
        art_url = subprocess.run(art_cmd, capture_output=True, text=True).stdout.strip()

        # Se for uma URL local (file://), criar caminho para nossa rota
        if art_url.startswith('file://'):
            art_url = f"/media/art?path={art_url}"
        # Se for uma URL http, manter como está
        elif art_url.startswith('http'):
            pass  # mantém a URL original
        else:
            art_url = ''  # se não tiver, vazio

        return jsonify({
            'title': title,
            'artist': artist,
            'status': status,
            'art_url': art_url
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/media/control', methods=['POST'])
def control_media():
    """Controla a mídia: play-pause, next, previous."""
    data = request.json
    action = data.get('action')
    if action not in ['play-pause', 'next', 'previous']:
        return jsonify({'error': 'Invalid action'}), 400

    try:
        subprocess.run(['playerctl', action], check=True)
        # Retorna o estado atualizado
        return get_media()
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500


# ---------- SYSTEM MONITOR ----------

@app.route('/system/stats')
def system_stats():
    """Retorna estatísticas do sistema: CPU, RAM, GPU (NVIDIA) e top processos."""
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.5)
        cpu_freq = psutil.cpu_freq()
        cpu_temp = None
        try:
            temps = psutil.sensors_temperatures()
            if 'coretemp' in temps:
                cpu_temp = temps['coretemp'][0].current
            elif 'k10temp' in temps:
                cpu_temp = temps['k10temp'][0].current
        except (AttributeError, KeyError):
            pass

        # RAM
        mem = psutil.virtual_memory()
        mem_used = round(mem.used / (1024**3), 1)
        mem_total = round(mem.total / (1024**3), 1)
        mem_percent = mem.percent

        # GPU (NVIDIA)
        gpu = None
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu',
                 '--format=csv,noheader,nounits'],
                capture_output=True, text=True, check=True, timeout=2
            )
            parts = result.stdout.strip().split(',')
            if len(parts) >= 4:
                gpu = {
                    'util': float(parts[0].strip()),
                    'vram_used': float(parts[1].strip()),
                    'vram_total': float(parts[2].strip()),
                    'temp': float(parts[3].strip())
                }
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Top processos (por memória)
        processes = []
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                processes.append({
                    'pid': p.info['pid'],
                    'name': p.info['name'] or '?',
                    'cpu': round(p.info['cpu_percent'] or 0, 1),
                    'mem': round(p.info['memory_percent'] or 0, 1)
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        processes.sort(key=lambda x: x['mem'], reverse=True)
        processes = processes[:10]

        return jsonify({
            'cpu': {
                'percent': round(cpu_percent, 1),
                'freq': round(cpu_freq.current / 1000, 2) if cpu_freq else None,
                'temp': round(cpu_temp, 1) if cpu_temp else None
            },
            'ram': {
                'used': mem_used,
                'total': mem_total,
                'percent': round(mem_percent, 1)
            },
            'gpu': gpu,
            'processes': processes
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------- MICROPHONE ----------

@app.route('/mic/status')
def mic_status():
    """Retorna status do microfone padrão: volume e mute."""
    try:
        # Volume
        result = subprocess.run(
            ['pactl', 'get-source-volume', '@DEFAULT_SOURCE@'],
            capture_output=True, text=True, check=True
        )
        match = re.search(r'(\d+)%', result.stdout)
        volume = int(match.group(1)) if match else 0

        # Mute
        mute_result = subprocess.run(
            ['pactl', 'get-source-mute', '@DEFAULT_SOURCE@'],
            capture_output=True, text=True, check=True
        )
        muted = 'yes' in mute_result.stdout.lower()

        return jsonify({'volume': volume, 'muted': muted}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mic/volume', methods=['POST'])
def mic_volume():
    """Ajusta o volume do microfone (0-150%)."""
    data = request.json
    pct = data.get('pct')
    if pct is None:
        return jsonify({'error': 'pct required'}), 400
    try:
        subprocess.run(
            ['pactl', 'set-source-volume', '@DEFAULT_SOURCE@', f'{int(pct)}%'],
            check=True
        )
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mic/mute', methods=['POST'])
def mic_mute():
    """Alterna o mute do microfone."""
    try:
        subprocess.run(
            ['pactl', 'set-source-mute', '@DEFAULT_SOURCE@', 'toggle'],
            check=True
        )
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mic/sources')
def mic_sources():
    """Lista todas as fontes de áudio disponíveis (entradas)."""
    try:
        result = subprocess.run(
            ['pactl', 'list', 'sources', 'short'],
            capture_output=True, text=True, check=True
        )
        sources = []
        for line in result.stdout.strip().splitlines():
            parts = line.split('\t')
            if len(parts) >= 2:
                sources.append({
                    'id': parts[0],
                    'name': parts[1]
                })
        return jsonify(sources), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mic/source', methods=['POST'])
def mic_set_source():
    """Define a fonte padrão."""
    source_id = request.json.get('id')
    if not source_id:
        return jsonify({'error': 'source id required'}), 400
    try:
        subprocess.run(
            ['pactl', 'set-default-source', source_id],
            check=True
        )
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
