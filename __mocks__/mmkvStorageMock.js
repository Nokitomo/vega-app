const stores = new Map();

const getStore = instanceId => {
  if (!stores.has(instanceId)) {
    stores.set(instanceId, new Map());
  }

  const store = stores.get(instanceId);

  return {
    getString: key => store.get(key),
    setString: (key, value) => store.set(key, value),
    getBool: key => store.get(key),
    setBool: (key, value) => store.set(key, value),
    getInt: key => store.get(key),
    setInt: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
    clearStore: () => store.clear(),
  };
};

class MMKVLoader {
  constructor() {
    this.instanceId = 'default';
  }

  withInstanceID(instanceId) {
    this.instanceId = instanceId;
    return this;
  }

  initialize() {
    return getStore(this.instanceId);
  }
}

module.exports = {MMKVLoader};
