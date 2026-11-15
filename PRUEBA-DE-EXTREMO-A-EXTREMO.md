# Prueba de extremo a extremo: de la solicitud a la plata

Esta es la prueba que hay que pasar **antes de vender la plataforma** y cada vez que se toque el flujo de productores, el checkout o las descargas. Es la unica forma de saber que todo funciona junto: ninguna prueba automatica cubre Mercado Pago, el correo y el navegador a la vez.

Hacela con un productor de prueba (o con yei, avisandole) y una compra real de monto minimo. Anota la fecha y el resultado al final del documento.

## Antes de empezar

- [ ] Hacer un respaldo: `node supabase/respaldo.mjs` (ver `supabase/README-RESPALDO.md`).
- [ ] Tener a mano: el panel (admin), un correo de prueba que puedas abrir, una ventana de incognito y un medio de pago para una compra minima.
- [ ] Confirmar que lujourban.com, tienda.lujourban.com y el panel cargan.

## 1. Solicitud del productor (lujourban.com/vender)

- [ ] Llenar el formulario desde el celular y desde el computador.
- [ ] Llega la solicitud al panel, en la lista de solicitudes de productores, con los datos tal cual se escribieron.
- [ ] Un correo repetido o un campo vacio muestra un mensaje claro, no un error generico.

## 2. Aprobacion e invitacion (panel)

- [ ] Aprobar la solicitud y crear el productor.
- [ ] Definir la comision del productor (por defecto 15 %). Revisar que quede guardada.
- [ ] Enviar la invitacion. Llega el correo (revisar tambien spam) y el enlace abre la pantalla para crear contrasena.
- [ ] El enlace de invitacion no sirve por segunda vez ni vencido.

## 3. Ingreso y perfil (/productor)

- [ ] Entrar con el correo y la contrasena nueva.
- [ ] "Tu perfil": subir una foto (jpg, png y webp). Una foto de mas de 5 MB o un archivo que no sea imagen se rechaza con mensaje claro.
- [ ] Escribir una bio de hasta 160 caracteres. Con 161 se rechaza.
- [ ] Abrir `tienda.lujourban.com/productor/<su-slug>`: aparece la foto en circulo y la bio, sin romper el diseno de la tienda.
- [ ] Quitar la foto: vuelve al estado sin foto.
- [ ] Un productor NO puede ver ni tocar datos de otro productor (probar abriendo la URL de otro slug dentro del portal).

## 4. Beats del productor

- [ ] Que el beat aparezca solo en la tienda de ese productor y en el catalogo general.
- [ ] La vista previa suena completa y no entrega el archivo final.
- [ ] El precio y el nombre coinciden con lo que se cargo.

## 5. Compra real minima (Mercado Pago)

- [ ] Desde incognito, comprar un beat del productor de prueba con una cuenta de comprador distinta a la del dueno.
- [ ] El pago pasa y se vuelve a la tienda (no a una pantalla en blanco).
- [ ] Llega el correo al comprador con el enlace de descarga.
- [ ] El enlace descarga el archivo correcto y completo (abrirlo y escucharlo).
- [ ] Usar el mismo enlace otra vez: respeta el limite de descargas definido.
- [ ] Pago rechazado o cancelado: vuelve a la tienda del productor y no se entrega nada.

## 6. Plata (lo mas importante)

- [ ] En el panel, la orden aparece como pagada, con el monto y el comprador correctos.
- [ ] Se creo una fila de ganancia del productor: `producer_amount = monto - round(monto x comision / 100)`. Con 15 %: una compra de 20 000 deja 17 000 al productor y 3 000 a la plataforma.
- [ ] En el portal del productor, "Mis ventas" muestra la misma venta y el mismo monto.
- [ ] En Mercado Pago, el movimiento coincide con la orden.
- [ ] Beats de Zaetta: comision 100 %, su portal queda en $0 (es lo esperado).

## 7. Fallas que hay que provocar a proposito

- [ ] Productor pausado: sus beats no se pueden comprar.
- [ ] Beat sin archivo final: la compra no debe cobrar algo imposible de entregar.
- [ ] Cerrar el navegador a mitad del pago y volver: la orden queda consistente.

## 8. Cierre

- [ ] Borrar o desactivar el productor de prueba y su beat de prueba.
- [ ] Hacer un reembolso de la compra de prueba desde Mercado Pago si el monto lo amerita, y anotar como se hizo (sirve para el proceso real de reembolsos).
- [ ] Anotar abajo la fecha, quien lo hizo y que fallo.

## Registro

| Fecha | Quien | Resultado | Que fallo |
| ----- | ----- | --------- | --------- |
|       |       |           |           |
