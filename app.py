from flask import Flask, render_template, jsonify, request, Response
import subprocess
import random
import os
app = Flask(__name__)


@app.route('/')
def hello_world():  # put application's code here
    # return <index>.html from templates folder
    return render_template('index.html')

@app.route('/workspace')
def current_workspace():
    # execute this following command "hyprctl activeworkspace -j | jq '.id'"
    try:
        result = subprocess.run(
            ['hyprctl', 'activeworkspace', '-j'],
            capture_output=True,
            text=True,
            check=True
        )
        # run jq to extract the 'id' field
        result = subprocess.run(
            ['jq', '.id'],
            input=result.stdout,
            capture_output=True,
            text=True,
            check=True
        )
        workspace_id = result.stdout.strip()
        return jsonify({'workspace': workspace_id}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/workspace/switch', methods=['POST'])
def switch_workspace():
    # validate "workspace"
    workspace = request.json.get('workspace')
    if not workspace:
        return jsonify({'error': 'Workspace ID is required'}), 400
    try:
        # execute the command to switch workspace
        subprocess.run(
            ['hyprctl', 'dispatch', 'workspace', str(workspace)],
            check=True
        )
        return jsonify({'message': f'Switched to workspace {workspace}'}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/screenshot/take', methods=['GET'])
def take_screenshot():
    filename = None
    try:
        # Generate a unique filename
        filename = f'/tmp/screenshot_{random.randint(1000, 9999)}.png'

        # Use shell redirection
        # hyprshot -m window -m active --clipboard-only --raw
        # run using os.system
        command = f'hyprshot -m window -m active  --raw >> {filename}'
        os.system(command)


        # Read the image file
        with open(filename, 'rb') as f:
            image_data = f.read()
        # copy the image to clipboard using wl-copy
        os.system(f'wl-copy < {filename}')
        return Response(image_data, mimetype='image/png')

    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the file
        if filename and os.path.exists(filename):
            try:
                os.remove(filename)
            except OSError:
                pass
if __name__ == '__main__':
    app.run(debug=True,host='0.0.0.0', port=8000)
