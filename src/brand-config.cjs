const canonical = require('./brand-config.json');

const repository = Object.freeze({ ...canonical.repository });
const legacyDataNames = Object.freeze([...canonical.legacyDataNames]);

module.exports = Object.freeze({
  ...canonical,
  repository,
  legacyDataNames,
  issueUrl: `${repository.url}/issues`,
  helperExecutable: `${canonical.helperBaseName}.exe`,
  installerName(version, flavor) {
    const flavorSuffix = flavor ? `-${flavor}` : '';
    return `${canonical.slug}-Setup-${version}${flavorSuffix}-x64.exe`;
  },
});
