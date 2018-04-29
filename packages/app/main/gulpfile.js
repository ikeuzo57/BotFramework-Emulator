const gulp = require('gulp');
const shell = require('gulp-shell');
const pjson = require('./package.json');

const defaultElectronMirror = 'https://github.com/electron/electron/releases/download/v';
const defaultElectronVersion = pjson.devDependencies["electron"];
const githubAccountName = "Microsoft";
const githubRepoName = "BotFramework-Emulator";
const appId = "F3C061A6-FE81-4548-82ED-C1171D9856BB";

//============================================================================
// BUILD
//============================================================================

//----------------------------------------------------------------------------
gulp.task('clean', function () {
  const clean = require('gulp-clean');
  return gulp.src('./app/', { read: false, allowEmpty: true })
    .pipe(clean());
});

//----------------------------------------------------------------------------
gulp.task('copy-extension-stubs', function () {
  return gulp
    .src('./src/extensions/**/*')
    .pipe(gulp.dest('./app/extensions'));
});

//----------------------------------------------------------------------------
gulp.task('build-emulator-core', function () {
  return gulp
    .src('../../emulator/core/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../emulator/core' }));
});

//----------------------------------------------------------------------------
gulp.task('build-emulator-cli', function () {
  return gulp
    .src('../../emulator/cli/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../emulator/cli' }));
});

//----------------------------------------------------------------------------
gulp.task('build-emulator',
  gulp.series('build-emulator-core', 'build-emulator-cli')
);

//----------------------------------------------------------------------------
gulp.task('build-json-extension', function () {
  return Promise.resolve();
});

//----------------------------------------------------------------------------
gulp.task('build-qnamaker-extension', function () {
  return Promise.resolve();
  /*
  return gulp
    .src('../../extensions/qnamaker/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../extensions/qnamaker/' }));
    */
});

//----------------------------------------------------------------------------
gulp.task('build-luis-extension', function () {
  return gulp
    .src('../../extensions/luis/client/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../extensions/luis/client' }));
});

//----------------------------------------------------------------------------
gulp.task('build-debug-extension', function () {
  return gulp
    .src('../../extensions/debug/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../extensions/debug/' }));
});

//----------------------------------------------------------------------------
gulp.task('build-extensions',
  gulp.parallel(
    'build-json-extension',
    'build-luis-extension',
    'build-qnamaker-extension',
    'build-debug-extension')
);

//----------------------------------------------------------------------------
gulp.task('build-app', gulp.series(
  'build-emulator',
  gulp.parallel(
    'build-extensions',
    'copy-extension-stubs',
    function () {
      return gulp
        .src('./package.json', { read: false })
        .pipe(shell([
          'npm run build:electron'
        ]));
    })));

//----------------------------------------------------------------------------
gulp.task('build-sdk-shared', function () {
  return gulp
    .src('../../sdk/shared/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../sdk/shared' }));
});

//----------------------------------------------------------------------------
gulp.task('build-sdk-client', function () {
  return gulp
    .src('../../sdk/client/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../sdk/client' }));
});

//----------------------------------------------------------------------------
gulp.task('build-sdk-ui-react', function () {
  return gulp
    .src('../../sdk/ui-react/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../sdk/ui-react' }));
});

//----------------------------------------------------------------------------
gulp.task('build-sdk-main', function () {
  return gulp
    .src('../../sdk/main/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../../sdk/main' }));
});

//----------------------------------------------------------------------------
gulp.task('build-sdk',
  gulp.series('build-sdk-shared',
    gulp.parallel(
      'build-sdk-client',
      'build-sdk-main',
      'build-sdk-ui-react'))
);

//----------------------------------------------------------------------------
gulp.task('build-shared', gulp.series('build-sdk', function () {
  return gulp
    .src('../shared/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../shared' }));
}));

//----------------------------------------------------------------------------
gulp.task('build-react', function () {
  return gulp
    .src('../client/package.json', { read: false })
    .pipe(shell([
      'npm run build'
    ], { cwd: '../client' }));
});

//----------------------------------------------------------------------------
gulp.task('build',
  gulp.series('clean', 'build-shared',
    gulp.parallel(
      'build-app',
      'build-react'))
);

//============================================================================
// GET-LICENSES
//============================================================================

//----------------------------------------------------------------------------
gulp.task('get-licenses', function () {
  const licenses = require('license-list');
  const source = require('vinyl-source-stream');
  const lerna = require('../../../lerna.json');
  const stream = source('ThirdPartyLicenses.txt');

  const formatLicense = (pkgInfo) => {
    const formatLicenseFile = () => {
      if (typeof pkgInfo.licenseFile === 'string') {
        return pkgInfo.licenseFile.split(/\n/).map(line => `\t${line}`).join('\n');
      } else {
        return '\tLICENSE file does not exist';
      }
    }
    return `${pkgInfo.name}@${pkgInfo.version} (${pkgInfo.license})\n\n${formatLicenseFile()}\n\n`;
  }

  const tasks = lerna.packages.map(package => licenses(`../../../${package}`), { dev: false });

  return Promise.all(tasks)
    .then(values => {
      const main = values[0];
      const client = values[1];
      const packages = {
        ...main,
        ...client
      };
      const keys = Object.keys(packages).sort().filter(key =>
        !key.startsWith(`${pjson.name}@`) &&
        !key.startsWith('@bfemulator'))
      keys.forEach(pkgId => {
        const pkgInfo = packages[pkgId];
        stream.write(formatLicense(pkgInfo));
      })
      stream.end();
      stream.pipe(gulp.dest('.'));
    })
    .catch(err => {
      console.log(err)
    });
});

//============================================================================
// STAGE
// Stages the application folder from which redistributables are built.
//============================================================================

//============================================================================
// STAGE:WINDOWS

//----------------------------------------------------------------------------
gulp.task('stage:windows', function () {
  var builder = require('electron-builder');
  const config = getConfig("windows", "dir");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(["dir"], builder.Arch.ia32, builder.Arch.x64),
    config
  });
});

//============================================================================
// STAGE:MAC

//----------------------------------------------------------------------------
gulp.task('stage:mac', function () {
  var builder = require('electron-builder');
  const config = getConfig("mac", "dir");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.MAC.createTarget(["dir"]),
    config
  });
});

//============================================================================
// STAGE:LINUX

//----------------------------------------------------------------------------
gulp.task('stage:linux', function () {
  var builder = require('electron-builder');
  const config = getConfig("linux", "dir");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.LINUX.createTarget(["dir"]),
    config
  });
});

//============================================================================
// REDIST
// Builds a redistributable from the staged application folder.
//============================================================================

//----------------------------------------------------------------------------
function hashFileAsync(filename, algo = 'sha512', encoding = 'base64') {
  var builderUtil = require('builder-util');
  return builderUtil.hashFile(filename, algo, encoding);
}

//----------------------------------------------------------------------------
function writeYamlMetadataFile(releaseFilename, yamlFilename, path, fileHash, releaseDate, extra = {}) {
  var fsp = require('fs-extra-p');
  var yaml = require('js-yaml');

  const ymlInfo = {
    version: pjson.version,
    releaseDate: releaseDate,
    githubArtifactName: releaseFilename,
    path: releaseFilename,
    sha512: fileHash
  };
  const obj = extend({}, ymlInfo, extra);
  const ymlStr = yaml.safeDump(obj);
  fsp.writeFileSync(`./${path}/${yamlFilename}`, ymlStr);
}

//----------------------------------------------------------------------------
function writeJsonMetadataFile(releaseFilename, jsonFilename, path, releaseDate) {
  var fsp = require('fs-extra-p');

  const jsonInfo = {
    version: pjson.version,
    releaseDate: releaseDate,
    url: `https://github.com/${githubAccountName}/${githubRepoName}/releases/v${pjson.version}/${releaseFilename}`
  };
  fsp.outputJsonSync(`./${path}/${jsonFilename}`, jsonInfo, { spaces: 2 });
}

//============================================================================
// REDIST:WINDOWS-NSIS

//----------------------------------------------------------------------------
gulp.task('redist:windows-nsis:binaries', function () {
  var wait = require('gulp-wait');
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("windows", "nsis");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(["nsis"], builder.Arch.ia32),
    config,
    prepackaged: './dist/win-ia32-unpacked'
  });
});

//----------------------------------------------------------------------------
gulp.task('redist:windows-nsis:metadata', gulp.series('redist:windows-nsis:binaries', function () {
  const config = getConfig("windows", "nsis");
  const releaseFilename = `${config.productName}-Setup-${pjson.version}.exe`;
  const sha512 = hashFileAsync(`./dist/${releaseFilename}`);
  const sha2 = hashFileAsync(`./dist/${releaseFilename}`, 'sha256', 'hex');
  const releaseDate = new Date().toISOString();

  return Promise.all([sha512, sha2])
    .then((values) => {
      writeYamlMetadataFile(releaseFilename, 'latest.yml', './dist', values[0], releaseDate, { sha2: values[1] });
    });
}));

//----------------------------------------------------------------------------
gulp.task('redist:windows-nsis', gulp.series('redist:windows-nsis:metadata'));

//============================================================================
// REDIST:WINDOWS-SQUIRREL

//----------------------------------------------------------------------------
gulp.task('redist:windows-squirrel', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("windows", "squirrel");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(["squirrel"], builder.Arch.x64),
    config,
    prepackaged: './dist/win-ia32-unpacked'
  }).then((filenames) => {
    return gulp.src(filenames, { allowEmpty: true })
      .pipe(rename(function (path) {
        path.basename = setReleaseFilename(path.basename, {
          lowerCase: false,
          replaceName: true,
          srcName: config.productName,
          dstName: config.squirrelWindows.name
        });
      }))
      .pipe(gulp.dest('./dist'));
  }).then(() => {
    // Wait for the files to be written to disk and closed.
    return delay(10000);
  });
});

//============================================================================
// REDIST:MAC

//----------------------------------------------------------------------------
gulp.task('redist:mac:binaries', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("mac");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.MAC.createTarget(["zip"]),
    config,
    prepackaged: './dist/mac'
  });
});

//----------------------------------------------------------------------------
gulp.task('redist:mac:metadata', gulp.series('redist:mac:binaries', function () {
  const config = getConfig("mac");
  const releaseFilename = `${config.productName}-${pjson.version}-mac.zip`;
  const releaseHash = hashFileAsync(`./dist/${releaseFilename}`);
  const releaseDate = new Date().toISOString();

  writeJsonMetadataFile(releaseFilename, 'latest-mac.json', './dist', releaseDate);
  return releaseHash.then((hashValue) => {
    writeYamlMetadataFile(releaseFilename, 'latest-mac.yml', './dist', hashValue, releaseDate);
  });
}));

//----------------------------------------------------------------------------
gulp.task('redist:mac', gulp.series('redist:mac:metadata'));

//============================================================================
// REDIST:LINUX

//----------------------------------------------------------------------------
gulp.task('redist:linux', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("linux");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.LINUX.createTarget(["deb", "AppImage"], builder.Arch.ia32, builder.Arch.x64),
    config,
    prepackaged: './dist/linux-unpacked'
  });
});

//============================================================================
// PACKAGE
// Stages and builds redist in a single step. 
//============================================================================

//============================================================================
// PACKAGE:WINDOWS-NSIS

//----------------------------------------------------------------------------
gulp.task('package:windows-nsis:binaries', function () {
  var wait = require('gulp-wait');
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("windows", "nsis");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(["nsis"], builder.Arch.ia32, builder.Arch.x64),
    config
  });
});

//----------------------------------------------------------------------------
gulp.task('package:windows-nsis:metadata', gulp.series('package:windows-nsis:binaries', function () {
  const config = getConfig("windows", "nsis");
  const releaseFilename = `${config.productName}-Setup-${pjson.version}.exe`;
  const sha512 = hashFileAsync(`./dist/${releaseFilename}`);
  const sha2 = hashFileAsync(`./dist/${releaseFilename}`, 'sha256', 'hex');
  const releaseDate = new Date().toISOString();

  return Promise.all([sha512, sha2])
    .then((values) => {
      writeYamlMetadataFile(releaseFilename, 'latest.yml', './dist', values[0], releaseDate, { sha2: values[1] });
    });
}));

//----------------------------------------------------------------------------
gulp.task('package:windows-nsis', gulp.series('package:windows-nsis:metadata'));

//============================================================================
// PACKAGE:WINDOWS-SQUIRREL

//----------------------------------------------------------------------------
gulp.task('package:windows-squirrel', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("windows", "squirrel");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(["squirrel"], builder.Arch.x64),
    config
  }).then((filenames) => {
    return gulp.src(filenames, { allowEmpty: true })
      .pipe(rename(function (path) {
        path.basename = setReleaseFilename(path.basename, {
          lowerCase: false,
          replaceName: true,
          srcName: config.productName,
          dstName: config.squirrelWindows.name
        });
      }))
      .pipe(gulp.dest('./dist'));
  }).then(() => {
    // Wait for the files to be written to disk and closed.
    return delay(10000);
  });
});

//============================================================================
// PACKAGE:MAC

//----------------------------------------------------------------------------
gulp.task('package:mac:binaries', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("mac");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.MAC.createTarget(["zip"]),
    config
  });
});

//----------------------------------------------------------------------------
gulp.task('package:mac:metadata', gulp.series('package:mac:binaries', function () {
  const config = getConfig("mac");
  const releaseFilename = `${config.productName}-${pjson.version}-mac.zip`;
  const releaseHash = hashFileAsync(`./dist/${releaseFilename}`);
  const releaseDate = new Date().toISOString();

  writeJsonMetadataFile(releaseFilename, 'latest-mac.json', './dist', releaseDate);
  return releaseHash.then((hashValue) => {
    writeYamlMetadataFile(releaseFilename, 'latest-mac.yml', './dist', hashValue, releaseDate);
  });
}));

//----------------------------------------------------------------------------
gulp.task('package:mac', gulp.series('package:mac:metadata'));

//============================================================================
// PACKAGE:LINUX

//----------------------------------------------------------------------------
gulp.task('package:linux', function () {
  var rename = require('gulp-rename');
  var builder = require('electron-builder');
  const config = getConfig("linux");
  console.log(`Electron mirror: ${getElectronMirrorUrl()}`);
  return builder.build({
    targets: builder.Platform.LINUX.createTarget(["deb", "AppImage"], builder.Arch.ia32, builder.Arch.x64),
    config
  });
});


//============================================================================
// PUBLISH
//============================================================================

//----------------------------------------------------------------------------
function publishFiles(filelist) {
  var CancellationToken = require('electron-builder-http/out/CancellationToken').CancellationToken;
  var GitHubPublisher = require('electron-publish/out/gitHubPublisher').GitHubPublisher;
  var publishConfig = replacePublishEnvironmentVars(require('./scripts/config/publish.json'));

  const context = {
    cancellationToken: new CancellationToken(),
    progress: null
  };
  const publisher = new GitHubPublisher(
    context,
    publishConfig,
    pjson.version, {
      publish: "always",
      draft: true,
      prerelease: false
    });
  const errorlist = [];

  const uploads = filelist.map(file => {
    return publisher.upload({ file })
      .catch((err) => {
        errorlist.push(err.response ? `Failed to upload ${file}, http status code ${err.response.statusCode}` : err);
        return Promise.resolve();
      });
  });

  return Promise.all(uploads)
    .then(() => errorlist.forEach((err) => console.error(err)));
}

//----------------------------------------------------------------------------
gulp.task('publish:windows-nsis', function () {
  const filelist = getFileList("windows", "nsis");
  return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:windows-squirrel', function () {
  const basename = require('./scripts/config/windows-squirrel.json').squirrelWindows.name;
  const filelist = getFileList("windows", "squirrel", {
    basename,
  });
  return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:mac', function () {
  const filelist = getFileList("mac");
  return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:linux', function () {
  const filelist = getFileList("linux");
  return publishFiles(filelist);
});


//============================================================================
// UTILS
//============================================================================

//----------------------------------------------------------------------------
function getConfig(platform, target) {
  return extend({},
    replacePackageEnvironmentVars(require('./scripts/config/common.json')),
    replacePackageEnvironmentVars(require(`./scripts/config/${platform}.json`)),
    (target ? replacePackageEnvironmentVars(require(`./scripts/config/${platform}-${target}.json`)) : {})
  );
}

//----------------------------------------------------------------------------
function getFileList(platform, target, options = {}) {
  const config = getConfig(platform, target);
  options = extend({}, {
    basename: config.productName,
    version: pjson.version,
  }, options);
  const path = './dist';
  const filelist = [];
  switch (`${platform}-${target || ''}`) {
    case "windows-nsis":
      filelist.push(`${path}/latest.yml`);
      filelist.push(`${path}/${options.basename}-Setup-${options.version}.exe`);
      //filelist.push(`${path}/${options.basename}-${options.version}-win.zip`);
      //filelist.push(`${path}/${options.basename}-${options.version}-ia32-win.zip`);
      break;

    case "windows-squirrel":
      filelist.push(`${path}/RELEASES`);
      //filelist.push(`${options.path}${options.basename}-Setup-${options.version}.exe`);
      filelist.push(`${path}/${options.basename}-${options.version}-full.nupkg`);
      break;

    case "mac-":
      filelist.push(`${path}/latest-mac.yml`);
      filelist.push(`${path}/latest-mac.json`);
      filelist.push(`${path}/${options.basename}-${options.version}-mac.zip`);
      //filelist.push(`${path}/${options.basename}-${options.version}.dmg`);
      break;

    case "linux-":
      filelist.push(`${path}/${pjson.name}-${options.version}-i386.AppImage`);
      filelist.push(`${path}/${pjson.name}-${options.version}-x86_64.AppImage`);
      filelist.push(`${path}/${pjson.name}_${options.version}_i386.deb`);
      filelist.push(`${path}/${pjson.name}_${options.version}_amd64.deb`);
      break;
  }
  return filelist;
}

//----------------------------------------------------------------------------
function setReleaseFilename(filename, options = {}) {
  options = extend({}, {
    lowerCase: true,
    replaceWhitespace: true,
    fixBasename: true,
    replaceName: false,
    srcName: null,
    dstName: null
  },
    options);
  if (options.replaceName && options.srcName && options.dstName) {
    filename = filename.replace(options.srcName, options.dstName);
  }
  if (options.lowerCase) {
    filename = filename.toLowerCase();
  }
  if (options.replaceWhitespace) {
    filename = filename.replace(/\s/g, '-');
  }
  if (options.fixBasename) {
    filename = filename.replace(/bot[-|\s]framework/ig, 'botframework');
  }
  return filename;
}

//----------------------------------------------------------------------------
function getEnvironmentVar(name, defaultValue = undefined) {
  return (process.env[name] === undefined) ? defaultValue : process.env[name]
}

//----------------------------------------------------------------------------
function replaceEnvironmentVar(str, name, defaultValue = undefined) {
  let value = getEnvironmentVar(name, defaultValue);
  if (value == undefined)
    throw new Error(`Required environment variable missing: ${name}`);
  return str.replace(new RegExp('\\${' + name + '}', 'g'), value);
}

//----------------------------------------------------------------------------
function replacePackageEnvironmentVars(obj) {
  let str = JSON.stringify(obj);
  str = replaceEnvironmentVar(str, "ELECTRON_MIRROR", defaultElectronMirror);
  str = replaceEnvironmentVar(str, "ELECTRON_VERSION", defaultElectronVersion);
  str = replaceEnvironmentVar(str, "appId", appId);
  return JSON.parse(str);
}

//----------------------------------------------------------------------------
function replacePublishEnvironmentVars(obj) {
  let str = JSON.stringify(obj);
  str = replaceEnvironmentVar(str, "GH_TOKEN");
  str = replaceEnvironmentVar(str, "githubAccountName", githubAccountName);
  str = replaceEnvironmentVar(str, "githubRepoName", githubRepoName);
  return JSON.parse(str);
}

//----------------------------------------------------------------------------
function getElectronMirrorUrl() {
  return `${getEnvironmentVar("ELECTRON_MIRROR", defaultElectronMirror)}${getEnvironmentVar("ELECTRON_VERSION", defaultElectronVersion)}`;
}

//----------------------------------------------------------------------------
function delay(ms, result) {
  return new Promise((resolve, reject) => setTimeout(resolve, ms, result));
}

//----------------------------------------------------------------------------
function extend1(destination, source) {
  for (var property in source) {
    if (source[property] && source[property].constructor &&
      source[property].constructor === Object) {
      destination[property] = destination[property] || {};
      arguments.callee(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
  return destination;
};

//----------------------------------------------------------------------------
function extend(...sources) {
  let output = {};
  sources.forEach(source => {
    extend1(output, source);
  });
  return output;
}
