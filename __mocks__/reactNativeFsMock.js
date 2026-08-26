const resolved = value => jest.fn().mockResolvedValue(value);

module.exports = {
  CachesDirectoryPath: '/tmp/cache',
  DocumentDirectoryPath: '/tmp/documents',
  DownloadDirectoryPath: '/tmp/downloads',
  ExternalDirectoryPath: '/tmp/external',
  appendFile: resolved(undefined),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({statusCode: 200}),
  })),
  exists: resolved(false),
  mkdir: resolved(undefined),
  pickFile: resolved([]),
  readDir: resolved([]),
  readFile: resolved(''),
  stopDownload: jest.fn(),
  unlink: resolved(undefined),
  writeFile: resolved(undefined),
};
