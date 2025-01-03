from flask import Flask, request, jsonify
from components.models import db, Seller, Transaction

app = Flask(__name__)

@app.route('/verify_qr', methods=['POST'])
def verify_qr():
    data = request.json
    qr_code = data.get('qr_code')
    
    seller = Seller.query.filter_by(qr_code=qr_code).first()
    if not seller:
        return jsonify({"status": "Not OK", "message": "Invalid QR code"}), 400
    
    if not seller.is_active:
        return jsonify({"status": "Not OK", "message": "Seller is inactive"}), 400
    
    return jsonify({"status": "OK", "message": f"Seller verified: {seller.name}"})

@app.route('/record_goods', methods=['POST'])
def record_goods():
    data = request.json
    seller_id = data.get('seller_id')
    product_type = data.get('product_type')
    weight = data.get('weight')
    
    transaction = Transaction(seller_id=seller_id, product_type=product_type, weight=weight)
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify({"status": "OK", "message": "Goods recorded successfully"})