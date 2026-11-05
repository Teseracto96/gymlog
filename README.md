# GymLog — app de entrenamiento tipo Strong

App web (PWA) en HTML, CSS y JavaScript puro. Corre en iPhone (instalada en la pantalla de inicio) y en cualquier navegador de PC. Funciona sin internet; los datos se guardan en el dispositivo.

## Publicar en GitHub Pages (una sola vez)

1. Entra a github.com → **New repository** → nombre `gymlog` → **Public** → Create.
2. En el repo: **Add file → Upload files** → arrastra **el contenido** de la carpeta `gymlog` (no la carpeta en sí: `index.html` debe quedar en la raíz) → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/gymlog/`.

## Instalar en el iPhone

1. Abre la URL en **Safari** (tiene que ser Safari).
2. Botón **Compartir → Agregar a pantalla de inicio**.
3. Ábrela siempre desde ese ícono: pantalla completa, funciona offline y sus datos están más protegidos.

## Pasar datos iPhone ↔ PC (respaldo manual)

- **Más → Descargar respaldo (JSON)**. En iPhone se abre el menú Compartir: guárdalo en *Archivos* (iCloud Drive) o mándalo por AirDrop.
- En el otro dispositivo: **Más → Importar respaldo (JSON) → Combinar**. Se queda la versión más reciente de cada entreno y no se duplican.
- *Reemplazar todo* borra lo del dispositivo y deja exactamente lo del archivo.
- Respalda al menos una vez por semana. iOS puede borrar datos de sitios web que no se usan en mucho tiempo.

## Actualizar la app

Sube los archivos modificados al repo y cambia `VERSION` en `sw.js` (ej. `gymlog-v1.0.1`). El iPhone toma la nueva versión al segundo arranque.

## Estructura del código

```
index.html               Shell: vista, barra de pestañas, capas
manifest.webmanifest     Datos de instalación (PWA)
sw.js                    Service worker: offline + caché de imágenes
css/app.css              Estilos (tema oscuro/claro con variables)
data/exercises.js        Catálogo (~920 ejercicios, EN + ES + imágenes)
data/seed-history.js     Tus 3 entrenos importados de Strong (se cargan 1 vez)
js/core/utils.js         Formatos, fechas, conversión kg/lb, 1RM, gráficas SVG
js/core/db.js            Persistencia en IndexedDB
js/core/store.js         Estado, consultas (historial, récords), respaldo/importación
js/core/ui.js            Pestañas, páginas, hojas, avisos, confirmaciones
js/modules/workout.js    Entreno en curso, timer de descanso, resumen y PRs
js/modules/templates.js  Plantillas y carpetas
js/modules/exercises.js  Catálogo, buscador, detalle, ejercicios propios
js/modules/history.js    Historial (lista y calendario)
js/modules/progress.js   Entrenos/semana, series por músculo, peso y medidas
js/modules/tools.js      Calculadora de discos, calentamiento y 1RM
js/modules/settings.js   Ajustes y respaldo
js/app.js                Arranque
```

Todos los pesos se guardan en **kg**; la unidad (kg/lb) por ejercicio sólo cambia cómo se muestran.
Imágenes de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público).
