import { qrPath } from '@/lib/artist-qr';

// "Tu codigo QR": el artista lo descarga y lo pone en flyers, camisetas o
// pantallas; quien lo escanea entra a su pagina. Solo muestra: el dibujo y los
// archivos los entrega /api/portal/qr (ver lib/artist-qr.ts), no esta vista.
// La imagen tiene medidas fijas, asi la tarjeta no cambia de alto al cargar.

type PortalQrProps = {
  // true = el QR lleva al enlace corto; false = todavia usa la direccion larga.
  isShort: boolean;
};

export function PortalQr({ isShort }: PortalQrProps) {
  return (
    <section className="pt-block" aria-labelledby="pt-qr-title">
      <h2 className="pt-h2" id="pt-qr-title">Tu código QR</h2>
      <div className="pt-qr">
        <img
          className="pt-qr-img"
          src={qrPath('svg')}
          width="176"
          height="176"
          alt="Código QR que abre tu página"
        />
        <div className="pt-qr-body">
          <p className="pt-qr-lead">
            Quien lo escanee con la cámara del celular entra a tu página. Úsalo en flyers, camisetas o en la pantalla de tus shows.
          </p>
          <div className="pt-qr-actions">
            <a className="pt-qr-btn is-main" href={qrPath('png', true)} download>Descargar PNG</a>
            <a className="pt-qr-btn" href={qrPath('svg', true)} download>Descargar SVG</a>
          </div>
          <p className="pt-qr-note">PNG para redes y pantallas. SVG para imprimir en grande sin que se pixele.</p>
          {isShort ? null : (
            <p className="pt-qr-note">Pídele a Lujo Urban tu enlace corto antes de imprimirlo: el código queda más limpio.</p>
          )}
        </div>
      </div>
    </section>
  );
}
