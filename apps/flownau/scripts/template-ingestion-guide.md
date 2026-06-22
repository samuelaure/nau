# Ingestión de Plantillas de Marca

Este proceso permite crear automáticamente las 10 plantillas base (con sus respectivos Hooks, Scenes y Text Blocks) para cualquier marca en la plataforma.

## Paso 1: Preparar el archivo JSON

Crea un archivo JSON siguiendo la estructura exacta del archivo `example-brand-hooks.json`. 

Deberás reemplazar los siguientes campos principales:
- `brandName`: El nombre exacto de la marca tal y como está registrado en la base de datos (se usa un operador `contains` para buscarlo).
- `baseBlock`: El prompt global base que se compartirá entre todas las plantillas.
- `presentationBlock`: El prompt de presentación que se incluirá en todos los captions.
- `hooks`: Un array con los 10 hooks estandarizados. Para cada hook, proveer:
  - `name`: Nombre descriptivo del hook.
  - `systemPrompt`: Instrucciones específicas para el template prompt de este hook.
  - `captionPrompt`: Instrucciones específicas para el caption de este hook.
  - `minCap` y `maxCap`: Rango de palabras para el caption.
  - `texts`: El array de textos que corresponden a cada "Text Block" en las escenas del hook, en orden de aparición. *(Asegúrate de pasar la cantidad exacta de textos requeridos por la estructura del hook).*

## Paso 2: Ejecutar el Script

Puedes correr el script localmente apuntando a la base de datos de desarrollo o de producción.

```bash
# Navegar al directorio de la app
cd apps/flownau

# Ejecutar el script apuntando al archivo JSON que creaste
npx tsx scripts/import-brand-hooks.ts ruta/a/tu/archivo.json
```

**Nota:** Si quieres ejecutarlo contra producción, asegúrate de que la variable `DATABASE_URL` en tu archivo `.env` apunte a producción.

## Estructura de los Hooks (Referencia Interna)
El script respeta automáticamente la siguiente estructura de escenas y textos, en función del `index` (1 al 10):

- **Hook 1:** 1 Escena, 1 Texto
- **Hook 2:** 1 Escena, 2 Textos
- **Hook 3:** 1 Escena, 2 Textos
- **Hook 4:** 2 Escenas, 1 Texto cada una
- **Hook 5:** 1 Escena, 1 Texto
- **Hook 6:** 1 Escena, 2 Textos
- **Hook 7:** 1 Escena, 1 Texto
- **Hook 8:** 2 Escenas, 1 Texto cada una
- **Hook 9:** 1 Escena, 2 Textos
- **Hook 10:** 1 Escena, 1 Texto

Si la cantidad de textos en el JSON no coincide con la cantidad de bloques en la estructura del hook, el script lanzará un error.
