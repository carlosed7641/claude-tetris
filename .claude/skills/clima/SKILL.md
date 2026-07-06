---
name: clima
description: >
  Consulta el clima actual (temperatura, condición, viento, humedad) para una ciudad o
  ubicación, usando servicios gratuitos que no requieren API key, ejecutado localmente
  via curl. Usa esta skill cuando el usuario pregunte "qué clima hace", "cómo está el
  tiempo", "clima en <ciudad>", o invoque /clima.
---

Consulta el clima usando `wttr.in`, un servicio gratuito basado en texto que no requiere
API key ni configuración.

## Cómo obtener el clima

1. Determina la ciudad/ubicación:
   - Si el usuario la especificó, úsala tal cual (ej. "Madrid", "Buenos Aires").
   - Si no especificó ninguna, usa por defecto "Barranquilla, Colombia".

2. Ejecuta con Bash (reemplaza `<ciudad>` por el nombre, o déjalo vacío):

```bash
curl -s "wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f)+%h+humedad+%w+viento+%p+precipitación\n"
```

   Para un reporte más completo (3 días, más detalle), omite `?format=...`:

```bash
curl -s "wttr.in/<ciudad>?0"
```

3. Si `curl` falla (sin conexión, timeout, ciudad no reconocida), informa el error
   brevemente al usuario en vez de reintentar en bucle.

## Presentación

Responde en español, de forma breve: ciudad, temperatura, sensación térmica, condición
y viento. No repitas todo el output crudo del comando salvo que el usuario pida el
detalle completo (formato `?0`).
