const apkInstaller = {install: jest.fn().mockResolvedValue(undefined)};

module.exports = {__esModule: true, default: apkInstaller, ...apkInstaller};
