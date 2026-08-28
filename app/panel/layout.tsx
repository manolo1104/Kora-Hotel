// Envoltura de TODO /panel. Existe por dos razones, las dos del tema oscuro:
//
// 1. `.panel-root` acota el tema. Los overrides oscuros de app/globals.css
//    viven dentro de esta clase, así que si el hotelero deja el modo oscuro
//    prendido y navega a la página pública, la landing NO se oscurece.
//
// 2. El script de abajo pone el atributo ANTES de que se pinte el panel. Sin
//    él, el hotelero con tema oscuro vería un fogonazo blanco en cada carga.
//    Va inline a propósito: un archivo externo llegaría tarde.

const SIN_PARPADEO = `(function(){try{if(localStorage.getItem('kora-tema')==='oscuro'){document.documentElement.setAttribute('data-tema','oscuro')}else{document.documentElement.removeAttribute('data-tema')}}catch(e){}})()`;

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="panel-root">
      <script dangerouslySetInnerHTML={{ __html: SIN_PARPADEO }} />
      {children}
    </div>
  );
}
