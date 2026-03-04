const connectMock = jest.fn().mockResolvedValue(undefined);
const disconnectMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $connect = connectMock;
    $disconnect = disconnectMock;
  },
}));

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    connectMock.mockClear();
    disconnectMock.mockClear();
  });

  it('calls $connect during onModuleInit', async () => {
    const service = new PrismaService();

    await service.onModuleInit();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('calls $disconnect during onModuleDestroy', async () => {
    const service = new PrismaService();

    await service.onModuleDestroy();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
