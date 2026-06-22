# Plan de Archivo y Limpieza Automática de Videos (Nauthenticity)

Este documento detalla el plan de implementación para automatizar la limpieza de almacenamiento en Cloudflare R2 y manejar correctamente el estado de videos "archivados" o "eliminados" en el sistema.

## Contexto
Los videos originales (`.mp4`) ingeridos desde redes sociales ocupan un gran porcentaje del espacio en R2. Aquellos videos que ya han sido procesados (tienen transcripción) y que superan cierto tiempo de antigüedad (ej. 15 días) pueden ser eliminados físicamente de R2 para ahorrar costos, conservando su metadata e imágenes. 

Actualmente el valor asignado en la base de datos tras un borrado físico es `'DELETED_CLEANUP'`, dado que la columna `storageUrl` en el modelo `Media` es `NOT NULL`.

## Tareas Pendientes a Implementar

### 1. Migración de Esquema en Prisma (Opcional pero Recomendado)
La columna `storageUrl` en el modelo `Media` (`apps/nauthenticity/prisma/schema.prisma`) actualmente no admite nulos:
```prisma
model Media {
  ...
  storageUrl   String
  ...
}
```
- **Acción:** Cambiar el esquema a `storageUrl String?` y generar una migración de base de datos.
- **Beneficio:** Permitirá asignar el valor `NULL` real cuando el archivo se borra de R2, en lugar de depender del string mágico `'DELETED_CLEANUP'`.

### 2. Evitar Re-descargas en el Ingester (`ingester.ts`)
La lógica actual del scraper (`apps/nauthenticity/src/modules/ingestion/ingester.ts`) se protege comparando la URL actual del post en IG con el `storageUrl` en nuestra BD. 
- **Acción:** Aunque el valor falso `'DELETED_CLEANUP'` (o un `NULL` futuro) ya rompe esa igualdad y evita la re-descarga automáticamente, se recomienda añadir un comentario explícito o una condición clara en el bloque:
  ```typescript
  const notYetDownloaded = mediaInDb.storageUrl === mediaInDb.url && mediaInDb.storageUrl !== 'DELETED_CLEANUP';
  ```
  Esto hará que el comportamiento sea predecible para futuros desarrolladores.

### 3. Worker de Cleanup Automático
Se debe implementar un Cron Job para ejecutar esta limpieza automáticamente de forma regular, sin intervención humana.
- **Ubicación:** `apps/nauthenticity/src/queues/cleanup.worker.ts` o como un cron de NestJS (`@Cron()`).
- **Lógica:**
  - Ejecutar query diariamente a las 3:00 AM (por ejemplo).
  - Buscar `Media` donde `type = 'video'`, `createdAt < NOW() - 15 days`, y que tengan un `Transcript` exitoso en BD.
  - Generar lotes de eliminación usando `@aws-sdk/client-s3` (`DeleteObjectsCommand`) hacia R2.
  - Al recibir respuesta exitosa, actualizar la base de datos seteando el `storageUrl` a `'DELETED_CLEANUP'` (o `NULL` si se hace la migración del esquema).

### 4. Fallback Visual en el Frontend
El panel de control (`nauthenticity/dashboard`) intentará renderizar un `<video>` con el enlace roto si no agregamos protección visual.
- **Archivos:** `MediaCarousel.tsx`, `PostGrid.tsx`.
- **Lógica:**
  - Detectar el estado archivado: `const isArchived = currentMedia.storageUrl === 'DELETED_CLEANUP' || !currentMedia.storageUrl;`
  - Renderizar condicionalmente un *placeholder*: en lugar del `<video>`, mostrar la imagen almacenada en la propiedad `thumbnailUrl` (si existe), oscurecida o acompañada de un badge UI (`<Badge>Video Archivado 🗄️</Badge>`).
  - Esto evitará los errores de red (404) y advertencias de renderizado en el navegador.
