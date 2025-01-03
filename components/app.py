from flask import Flask
from components.models import db
from routes import app as routes_app

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///recycling.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
app.register_blueprint(routes_app)

if __name__ == "__main__":
    app.run(debug=True) 