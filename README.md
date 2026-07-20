# Pristine Skies

A premium aerospace sustainability analysis platform for comparing aircraft geometry with a same-weight regression model, predicted cruise fuel burn, optional actual-vs-predicted fuel validation, visualizations, and smart performance insights.

## Run Locally

```bash
node server.js
```

Then open:

```text
http://localhost:4173
```

## Vercel

Vercel runs:

```bash
npm run build
```

The build copies the static site and assets into `dist`, which is configured as the deployment output directory.

## Core Workflow

1. Enter aircraft weight, wing aspect ratio, maximum lift-to-drag ratio, and fuselage slenderness.
2. Add the aircraft.
3. Review predicted fuel burn, the neutral same-weight benchmark, Geometry Efficiency Score, rankings, charts, and model limitations.
