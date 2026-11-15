// Invitacion para productores al final del catalogo general. Va aqui y no en
// el banner de arriba porque en celular ese banner no se muestra. Solo se usa
// en la raiz de la tienda (en la tienda de un productor la tienda es de el).
// Texto igual al de la pagina de la plataforma: cada solicitud se revisa a
// mano, por eso "pedi" y no "abri".
export default function ProducerInvite() {
  return (
    <p className="producer-invite">
      ¿Producís?{' '}
      <a href="https://www.lujourban.com/vender/">Pedí tu cuenta</a>
    </p>
  );
}
