# Clase en directo

Web para dar clase al estilo Nearpod: subes tu presentación en PDF, intercalas actividades, el alumnado entra con su cuenta del colegio y un código, y solo ve lo que tú proyectas. Al terminar tienes un informe por alumno.

## Qué hace

- **Lecciones:** subes un PDF (cada página es una diapositiva), las reordenas y añades actividades entre ellas: test, encuesta, respuesta abierta, respuesta numérica con unidad y tolerancia, y dibujo en blanco o sobre una diapositiva.
- **Clase en directo:** el alumnado entra con su cuenta @nervion.salesianas.org y el código (o escaneando el QR). Solo se admiten cuentas de ese dominio. Tú avanzas con los botones, las flechas del teclado o un pasador de diapositivas; ellos no pueden ir por su cuenta.
- **Control de actividades:** se abren solas al llegar a ellas. Puedes cerrarlas y mostrar los resultados a la clase, de forma anónima en el proyector.
- **Seguimiento:** ves quién está conectado, quién ha respondido y cuántas veces ha salido cada alumno de la pestaña.
- **Informe:** tabla por alumno con respuestas, aciertos, hora de entrada y salidas de la pestaña. Se descarga en CSV (se abre en Excel) o se imprime.

## Puesta en marcha (unos 20 minutos, una sola vez)

### 1. Crea el proyecto de Firebase

1. Entra en https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto**. Puedes desactivar Google Analytics.
2. En **Authentication → Comenzar → Método de inicio de sesión**, activa **Google**. Activa también **Anónimo** si quieres poder permitir, en alguna clase, que se entre sin cuenta.
3. En **Realtime Database → Crear base de datos**, elige la ubicación **Bélgica (europe-west1)** para que los datos queden en la UE, y empieza en **modo bloqueado**.
4. En la pestaña **Reglas** de Realtime Database, borra lo que haya, pega el contenido de `database.rules.json` y pulsa **Publicar**.
5. En el engranaje **Configuración del proyecto → Tus apps**, pulsa el icono web `</>`, ponle un nombre y regístrala (no hace falta Firebase Hosting). Copia los valores de `firebaseConfig` en el archivo `config.js`. Si no aparece `databaseURL`, cópiala de la parte superior de la pestaña **Datos** de Realtime Database.

### 2. Publica la web en GitHub Pages

1. Crea una cuenta en https://github.com si no la tienes, y un repositorio nuevo **público** (por ejemplo, `clase`).
2. Pulsa **Add file → Upload files** y sube todos los archivos de esta carpeta, con `config.js` ya rellenado.
3. En **Settings → Pages**, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`. En un par de minutos tendrás la dirección, del tipo `https://tuusuario.github.io/clase/`.
4. Vuelve a Firebase: **Authentication → Configuración → Dominios autorizados → Agregar dominio** y añade `tuusuario.github.io`.

### 3. Pide al coordinador TIC que autorice la app en Google Workspace

Google bloquea por defecto que el alumnado menor de 18 años inicie sesión en aplicaciones externas. La persona que administra Google Workspace del colegio tiene que permitirla una vez:

1. En la consola de Google Firebase, ve a **Authentication → Método de inicio de sesión → Google** y copia el **ID de cliente web** (acaba en `.apps.googleusercontent.com`).
2. Pásaselo al administrador. En la consola de administración de Google (admin.google.com) debe ir a **Seguridad → Acceso y control de datos → Controles de API → Gestionar el acceso a aplicaciones de terceros**, añadir la aplicación por ese ID de cliente y marcarla como **De confianza** para las unidades organizativas del alumnado.
3. La app solo pide nombre y correo (los permisos básicos de inicio de sesión), sin acceso a Drive, Gmail ni Classroom.

Sin este paso, el alumnado verá un aviso de Google de "Acceso bloqueado". Tú, si entras con una cuenta personal o de profesorado, no lo notarás.

Si el dominio del alumnado no fuera exactamente `nervion.salesianas.org`, cámbialo en `config.js` y en `database.rules.json` (aparece cuatro veces).

### 4. Autorízate como docente

1. Abre `https://tuusuario.github.io/clase/profesor.html` y entra con Google.
2. La web te mostrará tu identificador. Cópialo.
3. En Firebase, **Realtime Database → Datos**, pasa el ratón por la raíz y pulsa **+**. Crea la clave `teachers`, y dentro de ella otra clave con tu identificador y el valor `true` (booleano).
4. Recarga la página. Si algún compañero quiere usarla, repite el paso con su identificador.

## Uso en clase

1. En `profesor.html`, crea una lección, sube el PDF (desde PowerPoint o Google Slides: Archivo → Descargar como PDF) y añade actividades.
2. Pulsa **Empezar clase**. Se genera un código de 6 caracteres.
3. Pulsa **Abrir vista para proyectar** y lleva esa ventana al proyector. El código y el QR aparecen abajo; ocúltalos cuando todos hayan entrado.
4. Dirige la clase desde la ventana de control. Las flechas del teclado y los pasadores de diapositivas funcionan en las dos ventanas.
5. Al acabar, pulsa **Finalizar clase** y revisa el informe.

El alumnado solo necesita abrir `https://tuusuario.github.io/clase/` en el navegador.

## Cómo corrige sola

- **Test:** compara con la opción marcada. Las encuestas no se corrigen.
- **Respuesta numérica:** acepta coma decimal y potencias como `3,2·10^4` o `3,2e4`. Da por buena cualquier respuesta dentro de la tolerancia en porcentaje. Si pides la unidad, la compara respetando mayúsculas (`kg` no es `Kg`, igual que `mS` no es `ms`) y admite `m/s^2` o `m/s²`.
- **Respuesta abierta:** solo se corrige si indicas respuestas válidas, sin tener en cuenta mayúsculas, tildes ni el punto final.
- **Dibujo:** no se corrige; lo ves en la galería y en el informe.

## Fórmulas, banco de preguntas y enlaces (octubre 2026)

### Fórmulas
En enunciados y opciones, escribe las fórmulas entre dólares y se ven bien en todas las pantallas:
- `$v = \frac{d}{t}$`, `$x^{2}$`, `$6{,}02\cdot 10^{23}$`
- Química: `$\ce{H2SO4}$`, `$\ce{Fe^3+}$`, `$\ce{N2 + 3H2 <=> 2NH3}$`
- `$$…$$` para una fórmula centrada en su propia línea.

En el editor hay botones para insertarlas y una vista previa de cómo lo verá el alumnado.

### Datos distintos para cada alumno
En una **respuesta numérica**, pulsa **Añadir dato** y define cada dato con su nombre, mínimo, máximo y paso (por ejemplo `V` de 100 a 500 de 50 en 50). Escribe `{{V}}` en el enunciado donde quieras que aparezca y pon como solución una fórmula, por ejemplo `c*V/1000`. Admite `+ - * / ^`, paréntesis, `sqrt`, `log` (base 10), `ln`, `exp`, `pi`.

Cada alumno recibe sus propios valores (siempre los mismos para él en esa actividad) y se le corrige con los suyos. En el directo y en el informe ves los datos y la solución de cada uno.

### Banco de preguntas
- En **Banco de preguntas** (pantalla de inicio) creas, editas, duplicas y borras preguntas, con un tema o etiqueta para filtrarlas.
- Al crear una actividad en una lección, marca **Guardar también en el banco**.
- Para reutilizarlas: **Añadir actividad → Desde el banco** y marca las que quieras. Se copian en la lección.
- **Exportar** e **Importar** guardan el banco en un archivo JSON (copia de seguridad o para pasarlo a un compañero).

### Enlaces de la presentación
Al subir el PDF se buscan los enlaces de cada página (los vínculos y las direcciones escritas en el texto) y te propone añadirlos como paso **Enlace** después de su diapositiva. También puedes añadirlos a mano: **Añadir actividad → Enlace**.
- YouTube, Genially, GeoGebra, PhET, Formularios y Presentaciones de Google, Padlet y Canva se ven dentro de la clase.
- Wordwall, Educaplay, Kahoot, Quizizz y otras webs no se dejan insertar: el alumnado tiene un botón para abrirlas en otra pestaña. Puedes marcar «Mostrarlo dentro de la clase» para probar.
- Abrir un enlace en otra pestaña cuenta como salida de la pestaña en el informe.

### Entrar sin cuenta (opcional en cada clase)
Lo normal sigue siendo entrar con la cuenta del colegio. En el directo, el botón **Permitir entrar sin cuenta** abre esa clase también a quien escriba solo el código y su nombre (enlace «Entrar sin cuenta» en la pantalla de entrada). Al volver a pulsarlo o al finalizar la clase se cierra.
- Para que funcione hay que activar **Anónimo** en Firebase: **Authentication → Método de inicio de sesión → Agregar proveedor → Anónimo**.
- No se comprueba quién es: el nombre lo escribe el alumno. En el directo y en el informe aparece como «sin cuenta».
- Útil si un alumno no puede entrar con Google o mientras el coordinador TIC no haya autorizado la app.

### Para actualizar la web publicada
1. En Firebase, **Realtime Database → Reglas**, pega el `database.rules.json` nuevo y pulsa **Publicar** (añade el banco de preguntas).
2. En GitHub, en el repositorio de la web, **Add file → Upload files** y sube: `index.html`, `profesor.html`, `alumno.js`, `profesor.js`, `lib.js`, `estilos.css`, `database.rules.json`, `logo.svg`, `logo-negativo.svg` y `simbolo.svg`. `config.js` y `firebase.js` no cambian.

## Privacidad

Al tratarse de menores, conviene comentarlo con la persona responsable de protección de datos del centro antes de usarla.

- El alumnado entra con su cuenta del colegio: se guardan su nombre y su correo corporativo, que ya gestiona el centro. No se pide ningún otro dato ni se accede a su Drive, Gmail o Classroom.
- Nadie de fuera del dominio puede entrar en una clase, ver las diapositivas ni enviar respuestas: lo impiden las reglas de la base de datos, no solo la web.
- Los datos se guardan en tu proyecto de Firebase, en la UE si elegiste Bélgica, y solo tú puedes leer respuestas e informes.
- En cada informe tienes **Eliminar datos de esta clase** para borrarlos cuando ya los hayas pasado a tu cuaderno.
- La clave `apiKey` de `config.js` no es secreta: la seguridad está en las reglas de la base de datos.

## Límites del plan gratuito de Firebase

- 100 conexiones simultáneas: sobra para una clase, o para varias a la vez.
- 1 GB de datos guardados y 10 GB de descarga al mes. Una presentación de 20 páginas ocupa unos 2–4 MB, y cada alumno la descarga una vez por clase.

## Si algo falla

- **La página se queda en "Cargando…":** ábrela desde la dirección de GitHub Pages, no con doble clic en el archivo.
- **Error al entrar con Google:** revisa que el dominio de GitHub Pages esté en los dominios autorizados.
- **El alumnado ve "Acceso bloqueado" o "Esta app está bloqueada":** falta el paso 3 (autorizar la app en la consola de administración de Google).
- **No se abre la ventana de Google en el móvil o la tablet:** hay que permitir las ventanas emergentes para la web.
- **"Permission denied" al guardar:** comprueba que publicaste las reglas y que tu identificador está en `teachers` con valor `true` (booleano, no texto).
