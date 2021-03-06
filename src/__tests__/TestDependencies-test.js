// @flow

const fs = require('fs');
const path = require('path');

// $FlowAllowDynamicImport
const topLevelPackageJson = require(path.join(
  __dirname,
  '..',
  '..',
  'package.json',
));
const packagesRoot = path.join(__dirname, '..');
const packagePaths = fs
  .readdirSync(packagesRoot)
  .map(filepath => path.join(packagesRoot, filepath))
  .filter(filepath => {
    return (
      path.basename(filepath) !== '__tests__' &&
      fs.statSync(filepath).isDirectory()
    );
  });

test('all dependencies of our workspaces', () => {
  expect.hasAssertions();

  packagePaths.forEach(packagePath => {
    // $FlowAllowDynamicImport
    const packageJson = require(path.join(packagePath, 'package.json'));
    const packageName = path.basename(packagePath);

    // same folder name
    // expect(packageJson.name).toBe(`_${packageName}`);

    // no optional deps
    expect(packageJson.optionalDependencies).toBeUndefined();

    // no bundled deps
    expect(packageJson.bundledDependencies).toBeUndefined();

    // no dev deps
    // expect(packageJson.devDependencies).toBeUndefined();

    for (const dependencyName in packageJson.dependencies) {
      // same dependency versions
      const topLevelPackageVersion = getDependency(
        topLevelPackageJson,
        dependencyName,
      );
      if (topLevelPackageVersion !== false) {
        // we allow missing dependency in the top level package.json but not version mishmash
        expect(topLevelPackageVersion).toBe(
          getDependency(packageJson, dependencyName),
        );
      }
    }

    // TODO: disallow top level dependencies completely to make sure deps of all packages are OK?
    // see: https://github.com/facebook/react/blob/master/package.json
  });
});

function getDependency(packageJson, name) {
  const version = packageJson.dependencies[name];
  // return version ? `${name}@${version}` : `(missing ${name})`;
  return version ? `${name}@${version}` : false;
}
