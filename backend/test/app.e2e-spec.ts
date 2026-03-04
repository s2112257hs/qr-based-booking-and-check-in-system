/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';
import { ScanController } from '../src/scan/scan.controller';
import { ScanService } from '../src/scan/scan.service';

describe('Scan endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScanController],
      providers: [
        {
          provide: ScanService,
          useValue: {
            scan: jest.fn().mockResolvedValue({
              result: 'INVALID',
              reason: 'TOKEN_NOT_FOUND',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            id: 'scanner',
            role: 'staff_scanner',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /scan returns 400 for missing payload', () => {
    return request(app.getHttpServer()).post('/scan').send({}).expect(400);
  });
});
