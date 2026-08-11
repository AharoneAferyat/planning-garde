export default function QRCode({ value, size = 180 }) {
  if (!value) return null;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&format=svg&margin=1`;
  return (
    <div className="qr-box">
      <img src={url} alt="QR code d'invitation" width={size} height={size} style={{ display: 'block' }} />
    </div>
  );
}
