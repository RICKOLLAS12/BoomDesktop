// Unsigned macOS builds must still carry a valid ad-hoc signature: repackaging changes the
// bundle, which invalidates Electron's original seal and makes Apple Silicon refuse to
// launch the app ("is damaged"). Runs after packing, before the dmg is created.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing  ${appPath}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
