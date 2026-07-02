import express from 'express';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { AXIS_IDS, type AxisId, type CalibrationProfile } from './defaults.js';
import {
  getCalibrationPath,
  loadCalibration,
  markCalibrationLimit,
  saveCalibration
} from './calibrationStore.js';
import { SerialController } from './serialController.js';

const PORT = Number(process.env.PORT || 8787);

const axisEnum = z.enum(AXIS_IDS);
const angleValue = z.number().min(0).max(180);
const angleObjectSchema = z
  .object({
    base: angleValue.optional(),
    shoulder: angleValue.optional(),
    elbow: angleValue.optional(),
    gripper: angleValue.optional()
  })
  .strict();
const connectSchema = z.object({
  path: z.string().optional(),
  baudRate: z.number().int().min(9600).max(1000000).optional()
});
const anglesSchema = z.object({
  angles: angleObjectSchema,
  durationMs: z.number().int().min(10).max(3000).optional()
});
const markLimitSchema = z.object({
  axis: axisEnum,
  side: z.enum(['min', 'max']),
  angle: z.number().min(0).max(180)
});
const detachSchema = z.object({
  axis: axisEnum.optional()
});

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

async function main(): Promise<void> {
  let calibration = await loadCalibration();
  const controller = new SerialController(calibration);
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  const broadcast = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(serialized);
    }
  };

  controller.on('state', (state) => broadcast({ type: 'state', data: state }));
  controller.on('telemetry', (line) => broadcast({ type: 'telemetry', data: line }));

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'state', data: controller.getState() }));
  });

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'ihm-mearm',
      port: PORT,
      calibrationPath: getCalibrationPath()
    });
  });

  app.get(
    '/api/ports',
    asyncRoute(async (_request, response) => {
      response.json({ ports: await controller.refreshPorts() });
    })
  );

  app.get('/api/state', (_request, response) => {
    response.json(controller.getState());
  });

  app.post(
    '/api/connect',
    asyncRoute(async (request, response) => {
      const input = connectSchema.parse(request.body ?? {});
      response.json(await controller.connect(input.path, input.baudRate));
    })
  );

  app.post(
    '/api/disconnect',
    asyncRoute(async (_request, response) => {
      await controller.disconnect();
      response.json(controller.getState());
    })
  );

  app.post(
    '/api/angles',
    asyncRoute(async (request, response) => {
      const input = anglesSchema.parse(request.body ?? {});
      response.json(await controller.move(input.angles, input.durationMs));
    })
  );

  app.post(
    '/api/home',
    asyncRoute(async (_request, response) => {
      response.json(await controller.home());
    })
  );

  app.post(
    '/api/stop',
    asyncRoute(async (_request, response) => {
      response.json(await controller.stop('Parada de emergência ativa'));
    })
  );

  app.post(
    '/api/detach',
    asyncRoute(async (request, response) => {
      const input = detachSchema.parse(request.body ?? {});
      response.json(await controller.detach(input.axis));
    })
  );

  app.get('/api/calibration', (_request, response) => {
    response.json(calibration);
  });

  app.post(
    '/api/calibration',
    asyncRoute(async (request, response) => {
      calibration = await saveCalibration(request.body as CalibrationProfile);
      controller.setCalibration(calibration);
      response.json(calibration);
    })
  );

  app.post(
    '/api/calibration/mark',
    asyncRoute(async (request, response) => {
      const input = markLimitSchema.parse(request.body ?? {});
      calibration = await markCalibrationLimit(calibration, input.axis as AxisId, input.side, input.angle);
      controller.setCalibration(calibration);
      response.json(calibration);
    })
  );

  const distPath = path.join(process.cwd(), 'dist');
  try {
    await access(distPath);
    app.use(express.static(distPath));
    app.use((request, response, next) => {
      if (request.method === 'GET' && !request.path.startsWith('/api') && !request.path.startsWith('/ws')) {
        response.sendFile(path.join(distPath, 'index.html'));
        return;
      }
      next();
    });
  } catch {
    // Vite serves the frontend during development.
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Erro interno';
    response.status(400).json({ error: message });
  });

  httpServer.listen(PORT, () => {
    console.log(`MeArm API em http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    await controller.stop('Encerrando servidor').catch(() => undefined);
    await controller.disconnect().catch(() => undefined);
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
