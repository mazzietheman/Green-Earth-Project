import React, { useState } from 'react';
import axios from 'axios';

const QRVerification = () => {
    const [qrCode, setQrCode] = useState('');
    const [message, setMessage] = useState('');

    const verifyQrCode = async () => {
        try {
            const response = await axios.post('http://localhost:5000/verify_qr', { qr_code: qrCode });
            setMessage(response.data.message);
        } catch (error) {
            setMessage(error.response.data.message || 'An error occurred');
        }
    };

    return (
        <div>
            <h1>QR Verification</h1>
            <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Enter QR code"
            />
            <button onClick={verifyQrCode}>Verify</button>
            <p>{message}</p>
        </div>
    );
};

export default QRVerification;