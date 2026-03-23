const { join } = require('path');

module.exports = {
  managerEntries(entry = []) {
    return [...entry, join(__dirname, './manager.tsx')];
  },
};
