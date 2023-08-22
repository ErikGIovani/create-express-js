import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";
import minimist from "minimist";
import prompts from "prompts";
import { blue, yellow, red, reset } from "kolorist";
const FRAMEWORKS = [
    {
        name: "express",
        display: "Express",
        color: yellow,
    },
    {
        name: "express-esm",
        display: "Express ECMAScript Modules",
        color: yellow,
    },
    {
        name: "express-ts",
        display: "Express TypeScript",
        color: blue,
    },
];
const argv = minimist(process.argv.slice(2), { string: ["_"] });
const cwd = process.cwd();
const TEMPLATES = FRAMEWORKS.map((f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]).reduce((a, b) => a.concat(b), []);
const renameFiles = {
    _gitignore: ".gitignore",
};
const defaultTargetDir = "express-project";
async function init() {
    const argTargetDir = formatTargetDir(argv._[0]);
    const argTemplate = argv.template || argv.t;
    let targetDir = argTargetDir || defaultTargetDir;
    const getProjectName = () => targetDir === "." ? path.basename(path.resolve()) : targetDir;
    let result;
    try {
        result = await prompts([
            {
                type: argTargetDir ? null : "text",
                name: "projectName",
                message: reset("Project name:"),
                initial: defaultTargetDir,
                onState: (state) => {
                    targetDir = formatTargetDir(state.value) || defaultTargetDir;
                },
            },
            {
                type: () => !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : "confirm",
                name: "overwrite",
                message: () => (targetDir === "."
                    ? "Current directory"
                    : `Target directory "${targetDir}"`) +
                    ` is not empty. Remove existing files and continue?`,
            },
            {
                type: (_, { overwrite }) => {
                    if (overwrite === false) {
                        throw new Error(red("✖") + " Operation cancelled");
                    }
                    return null;
                },
                name: "overwriteChecker",
            },
            {
                type: () => (isValidPackageName(getProjectName()) ? null : "text"),
                name: "packageName",
                message: reset("Package name:"),
                initial: () => toValidPackageName(getProjectName()),
                validate: (dir) => isValidPackageName(dir) || "Invalid package.json name",
            },
            {
                type: argTemplate && TEMPLATES.includes(argTemplate) ? null : "select",
                name: "framework",
                message: typeof argTemplate === "string" && !TEMPLATES.includes(argTemplate)
                    ? reset(`"${argTemplate}" isn't a valid template. Please choose from below: `)
                    : reset("Select a template:"),
                initial: 0,
                choices: FRAMEWORKS.map((framework) => {
                    const frameworkColor = framework.color;
                    return {
                        title: frameworkColor(framework.display || framework.name),
                        value: framework,
                    };
                }),
            },
        ], {
            onCancel: () => {
                throw new Error(red("✖") + " Operation cancelled");
            },
        });
    }
    catch (cancelled) {
        console.log(cancelled.message);
        return;
    }
    const { framework, overwrite, packageName } = result;
    const root = path.join(cwd, targetDir);
    if (overwrite) {
        emptyDir(root);
    }
    else if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
    }
    let template = framework?.name || argTemplate;
    const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent);
    const pkgManager = pkgInfo ? pkgInfo.name : "npm";
    const isYarn1 = pkgManager === "yarn" && pkgInfo?.version.startsWith("1.");
    const { customCommand } = FRAMEWORKS.flatMap((f) => f?.variants).find((v) => v?.name === template) ??
        {};
    if (customCommand) {
        const fullCustomCommand = customCommand
            .replace(/^npm create/, `${pkgManager} create`)
            .replace("@latest", () => (isYarn1 ? "" : "@latest"))
            .replace(/^npm exec/, () => {
            if (pkgManager === "pnpm") {
                return "pnpm dlx";
            }
            if (pkgManager === "yarn" && !isYarn1) {
                return "yarn dlx";
            }
            return "npm exec";
        });
        const [command, ...args] = fullCustomCommand.split(" ");
        const replacedArgs = args.map((arg) => arg.replace("TARGET_DIR", targetDir));
        const { status } = spawn.sync(command, replacedArgs, {
            stdio: "inherit",
        });
        process.exit(status ?? 0);
    }
    console.log(`\nScaffolding project in ${root}...`);
    const templateDir = path.resolve(fileURLToPath(import.meta.url), "../..", `template-${template}`);
    const write = (file, content) => {
        const targetPath = path.join(root, renameFiles[file] ?? file);
        if (content) {
            fs.writeFileSync(targetPath, content);
        }
        else {
            copy(path.join(templateDir, file), targetPath);
        }
    };
    const files = fs.readdirSync(templateDir);
    for (const file of files.filter((f) => f !== "package.json")) {
        write(file);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, `package.json`), "utf-8"));
    pkg.name = packageName || getProjectName();
    write("package.json", JSON.stringify(pkg, null, 2) + "\n");
    const cdProjectName = path.relative(cwd, root);
    console.log(`\nDone. Now run:\n`);
    if (root !== cwd) {
        console.log(`  cd ${cdProjectName.includes(" ") ? `"${cdProjectName}"` : cdProjectName}`);
    }
    switch (pkgManager) {
        case "yarn":
            console.log("  yarn");
            console.log("  yarn dev");
            break;
        default:
            console.log(`  ${pkgManager} install`);
            console.log(`  ${pkgManager} run dev`);
            break;
    }
    console.log();
}
function formatTargetDir(targetDir) {
    return targetDir?.trim().replace(/\/+$/g, "");
}
function copy(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        copyDir(src, dest);
    }
    else {
        fs.copyFileSync(src, dest);
    }
}
function isValidPackageName(projectName) {
    return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(projectName);
}
function toValidPackageName(projectName) {
    return projectName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/^[._]/, "")
        .replace(/[^a-z\d\-~]+/g, "-");
}
function copyDir(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
        const srcFile = path.resolve(srcDir, file);
        const destFile = path.resolve(destDir, file);
        copy(srcFile, destFile);
    }
}
function isEmpty(path) {
    const files = fs.readdirSync(path);
    return files.length === 0 || (files.length === 1 && files[0] === ".git");
}
function emptyDir(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const file of fs.readdirSync(dir)) {
        if (file === ".git") {
            continue;
        }
        fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
    }
}
function pkgFromUserAgent(userAgent) {
    if (!userAgent)
        return undefined;
    const pkgSpec = userAgent.split(" ")[0];
    const pkgSpecArr = pkgSpec.split("/");
    return {
        name: pkgSpecArr[0],
        version: pkgSpecArr[1],
    };
}
init().catch((e) => {
    console.error(e);
});
