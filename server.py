from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    """Главная страница Mini App"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Остальные файлы (CSS, JS)"""
    return send_from_directory('static', path)

if __name__ == '__main__':
    # Render сам задаёт порт через переменную PORT
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)