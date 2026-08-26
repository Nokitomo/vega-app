module.exports = {
  StorageAccessFramework: {
    createFileAsync: jest.fn().mockResolvedValue('content://mock/file'),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    readDirectoryAsync: jest.fn().mockResolvedValue([]),
  },
};
