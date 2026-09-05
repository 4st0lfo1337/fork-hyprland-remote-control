from flask import Flask, render_template, jsonify, request, Response
import subprocess
import random
import os
import re
import json
import base64
import tempfile

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


# ---------- MÍDIA (playerctl) ----------

def get_media_art(metadata):
    """
    Tenta extrair a arte do álbum dos metadados.
    Retorna uma string base64 da imagem ou None.
    """
    # playerctl pode fornecer a URL da arte via mpris:artUrl
    art_url = metadata.get('mpris:artUrl')
    if art_url and art_url.startswith('file://'):
        # caminho local
        art_path = art_url[7:]  # remove file://
        if os.path.exists(art_path):
            try:
                # Redimensiona para um tamanho razoável (ex: 200x200) para não pesar
                # Usamos ffmpeg para redimensionar e converter para PNG base64
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                    tmp_path = tmp.name
                cmd = ['ffmpeg', '-i', art_path, '-vf', 'scale=200:200', '-frames:v', '1', tmp_path, '-y']
                subprocess.run(cmd, capture_output=True, check=True)
                with open(tmp_path, 'rb') as f:
                    img_data = f.read()
                os.unlink(tmp_path)
                return base64.b64encode(img_data).decode('utf-8')
            except Exception:
                # Se falhar, tenta ler a imagem diretamente (sem redimensionar)
                try:
                    with open(art_path, 'rb') as f:
                        img_data = f.read()
                    return base64.b64encode(img_data).decode('utf-8')
                except Exception:
                    pass
    return None


@app.route('/media/status', methods=['GET'])
def media_status():
    """
    Retorna o status atual do player (playerctl).
    """
    try:
        # Verifica se algum player está rodando
        players = subprocess.run(
            ['playerctl', '-l'],
            capture_output=True,
            text=True,
            check=True
        )
        if not players.stdout.strip():
            return jsonify({'status': 'stopped', 'title': None, 'artist': None, 'album': None, 'art': None}), 200

        # Pega o player ativo (ou o primeiro da lista)
        player = players.stdout.strip().split('\n')[0]

        # Obtém metadados
        metadata_cmd = ['playerctl', '--player', player, 'metadata', '--format', '{{ title }}||{{ artist }}||{{ album }}||{{ mpris:artUrl }}']
        result = subprocess.run(metadata_cmd, capture_output=True, text=True, check=True)
        parts = result.stdout.strip().split('||')
        title = parts[0] if len(parts) > 0 else None
        artist = parts[1] if len(parts) > 1 else None
        album = parts[2] if len(parts) > 2 else None
        art_url = parts[3] if len(parts) > 3 else None

        # Status (playing, paused)
        status_cmd = ['playerctl', '--player', player, 'status']
        status_result = subprocess.run(status_cmd, capture_output=True, text=True, check=True)
        status = status_result.stdout.strip().lower()

        # Obter arte (se disponível)
        # Vamos montar um dicionário com os metadados completos para a função get_media_art
        metadata_dict = {'mpris:artUrl': art_url} if art_url else {}
        art_base64 = None
        if art_url and art_url.startswith('file://'):
            art_base64 = get_media_art(metadata_dict)

        return jsonify({
            'status': status,
            'title': title,
            'artist': artist,
            'album': album,
            'art': art_base64  # string base64 ou None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/media/control', methods=['POST'])
def media_control():
    """
    Ações: play-pause, next, previous, stop (opcional).
    """
    data = request.json
    action = data.get('action')
    if not action:
        return jsonify({'error': 'Action required'}), 400

    try:
        # Pega o player ativo
        players = subprocess.run(
            ['playerctl', '-l'],
            capture_output=True,
            text=True,
            check=True
        )
        if not players.stdout.strip():
            return jsonify({'error': 'No player running'}), 404
        player = players.stdout.strip().split('\n')[0]

        cmd = ['playerctl', '--player', player, action]
        subprocess.run(cmd, check=True)
        return jsonify({'message': f'{action} executed'}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
