from flask import Flask, render_template, jsonify, request, Response
import subprocess
import random
import os
import re
import json

app = Flask(__name__)


@app.route('/')
def hello_world():
    return render_template('index.html')


# ---------- WORKSPACES ----------

@app.route('/workspace')
def current_workspace():
    """Retorna apenas o ID do workspace ativo (focado)."""
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
    """
    Retorna informações de todos os monitores.
    Exemplo de saída:
    [
        {
            "name": "DP-1",
            "workspace": 1,
            "focused": true
        },
        ...
    ]
    """
    try:
        result = subprocess.run(
            ['hyprctl', 'monitors', '-j'],
            capture_output=True,
            text=True,
            check=True
        )
        monitors = json.loads(result.stdout)
        # Extrai apenas nome, workspace ativo e se está focado
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

        # Retorna o volume atualizado
        return get_volume()
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
